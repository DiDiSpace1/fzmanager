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

function moneyValue(formData: FormData, key: string) {
  const raw = value(formData, key).replace(',', '.');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

const ALLOWED_DOCUMENT_TYPES = new Set(['rent_receipt', 'tax']);
export async function uploadDocumentAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const file = formData.get('file');
  const documentType = value(formData, 'document_type');

  if (!(file instanceof File) || file.size === 0) {
    redirect(`${localizedPath(locale, '/documents')}?error=file_missing`);
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    redirect(`${localizedPath(locale, '/documents')}?error=document_type`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const storageGate = await canStoreDocument(supabase, workspaceId, file.size);

  if (!storageGate.allowed) {
    redirect(`${localizedPath(locale, '/documents')}?error=${storageGate.reason === 'file_size' ? 'file_too_large' : 'storage_limit'}`);
  }

  const planGate = await canCreateResource(supabase, workspaceId, 'documents');

  if (!planGate.allowed) {
    redirect(`${localizedPath(locale, '/documents')}?error=plan_limit`);
  }

  const documentId = randomUUID();
  const year = new Date().getUTCFullYear();
  const filePath = `workspace/${workspaceId}/documents/${year}/${documentId}-${safeFileName(file.name)}`;
  const {error: uploadError} = await supabase.storage.from('documents').upload(filePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });

  if (uploadError) {
    redirect(`${localizedPath(locale, '/documents')}?error=upload_failed`);
  }

  const propertyId = value(formData, 'property_id') || null;
  const tenantId = value(formData, 'tenant_id') || null;
  const unitId = value(formData, 'unit_id') || null;
  const {error} = await supabase.from('documents').insert({
    document_type: documentType,
    extracted_amount: null,
    file_name: file.name,
    file_path: filePath,
    id: documentId,
    mime_type: file.type || null,
    period_month: value(formData, 'period_month') || null,
    property_id: propertyId,
    tenant_id: tenantId,
    unit_id: unitId,
    size_bytes: file.size,
    workspace_id: workspaceId
  });

  if (error) {
    await supabase.storage.from('documents').remove([filePath]);
    redirect(`${localizedPath(locale, '/documents')}?error=document_failed`);
  }

  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(localizedPath(locale, '/documents'));
}

export async function createExpenseAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const documentId = value(formData, 'document_id');
  const amount = moneyValue(formData, 'amount');
  const expenseDate = value(formData, 'expense_date');

  if (!expenseDate || amount <= 0) {
    redirect(`${localizedPath(locale, '/documents')}?error=expense_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {error} = await supabase.from('expenses').insert({
    amount,
    currency: 'EUR',
    description: value(formData, 'description') || null,
    document_id: documentId || null,
    expense_date: expenseDate,
    property_id: value(formData, 'property_id') || null,
    unit_id: value(formData, 'unit_id') || null,
    receipt_status: documentId ? 'attached' : 'missing',
    tax_category_id: value(formData, 'tax_category_id') || null,
    vendor: value(formData, 'vendor') || null,
    workspace_id: workspaceId
  });

  if (error) {
    redirect(`${localizedPath(locale, '/documents')}?error=expense_failed`);
  }

  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(localizedPath(locale, '/documents'));
}

export async function deleteDocumentAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const documentId = value(formData, 'document_id');

  if (!documentId) {
    redirect(`${localizedPath(locale, '/documents')}?error=document_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: document, error: findError} = await supabase
    .from('documents')
    .select('id, file_path')
    .eq('id', documentId)
    .eq('workspace_id', workspaceId)
    .single();

  if (findError || !document) {
    redirect(`${localizedPath(locale, '/documents')}?error=document_not_found`);
  }

  await supabase.storage.from('documents').remove([document.file_path]);

  const {error} = await supabase.from('documents').delete().eq('id', document.id).eq('workspace_id', workspaceId);

  if (error) {
    redirect(`${localizedPath(locale, '/documents')}?error=document_delete_failed`);
  }

  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(localizedPath(locale, '/documents'));
}
