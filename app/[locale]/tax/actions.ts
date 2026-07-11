'use server';

import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {canCreateResource, canStoreDocument} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

const ALLOWED_RECEIPT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export async function attachExpenseReceiptAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const expenseId = value(formData, 'expense_id');
  const file = formData.get('receipt_file');

  if (!expenseId) {
    redirect(`${localizedPath(locale, '/tax')}?error=expense_missing`);
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect(`${localizedPath(locale, '/tax')}?error=file_missing`);
  }

  if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
    redirect(`${localizedPath(locale, '/tax')}?error=file_type`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const [{data: expense}, storageGate, planGate] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, amount, description, expense_date, property_id, unit_id')
      .eq('id', expenseId)
      .eq('workspace_id', workspaceId)
      .single<{
        amount: number;
        description: string | null;
        expense_date: string;
        id: string;
        property_id: string | null;
        unit_id: string | null;
      }>(),
    canStoreDocument(supabase, workspaceId, file.size),
    canCreateResource(supabase, workspaceId, 'documents')
  ]);

  if (!expense) {
    redirect(`${localizedPath(locale, '/tax')}?error=expense_not_found`);
  }

  if (!storageGate.allowed) {
    redirect(`${localizedPath(locale, '/tax')}?error=${storageGate.reason === 'file_size' ? 'file_too_large' : 'storage_limit'}`);
  }

  if (!planGate.allowed) {
    redirect(`${localizedPath(locale, '/tax')}?error=plan_limit`);
  }

  const documentId = randomUUID();
  const year = new Date(expense.expense_date).getUTCFullYear();
  const filePath = `workspace/${workspaceId}/documents/${year}/${documentId}-${safeFileName(file.name)}`;
  const {error: uploadError} = await supabase.storage.from('documents').upload(filePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });

  if (uploadError) {
    redirect(`${localizedPath(locale, '/tax')}?error=upload_failed`);
  }

  const {error: documentError} = await supabase.from('documents').insert({
    document_type: 'invoice',
    extracted_amount: Number(expense.amount ?? 0),
    extracted_date: expense.expense_date,
    file_name: file.name,
    file_path: filePath,
    id: documentId,
    mime_type: file.type || null,
    property_id: expense.property_id,
    size_bytes: file.size,
    unit_id: expense.unit_id,
    workspace_id: workspaceId
  });

  if (documentError) {
    await supabase.storage.from('documents').remove([filePath]);
    redirect(`${localizedPath(locale, '/tax')}?error=document_failed`);
  }

  const {error: updateError} = await supabase
    .from('expenses')
    .update({
      document_id: documentId,
      receipt_status: 'attached'
    })
    .eq('id', expense.id)
    .eq('workspace_id', workspaceId);

  if (updateError) {
    await supabase.from('documents').delete().eq('id', documentId).eq('workspace_id', workspaceId);
    await supabase.storage.from('documents').remove([filePath]);
    redirect(`${localizedPath(locale, '/tax')}?error=receipt_failed`);
  }

  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(localizedPath(locale, '/tax'));
}
