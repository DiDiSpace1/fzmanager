'use server';

import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {canStoreDocument} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function moneyValue(formData: FormData, key: string) {
  const parsed = Number.parseFloat(value(formData, key).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

function monthStart(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value.slice(0, 7)}-01`;
  }

  return '';
}

function paymentMethod(value: string) {
  return ['bank_transfer', 'cash', 'cheque', 'card', 'other'].includes(value) ? value : 'bank_transfer';
}

export async function createRevenueTransactionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const leaseId = value(formData, 'lease_id');
  const periodMonth = monthStart(value(formData, 'period_month'));
  const amount = moneyValue(formData, 'amount');
  const receivedAt = value(formData, 'received_at') || new Date().toISOString().slice(0, 10);
  const status = value(formData, 'status') === 'paid' ? 'paid' : 'unpaid';

  if (!leaseId || !periodMonth || amount <= 0) {
    redirect(`${localizedPath(locale, '/transactions')}?error=revenue_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: lease} = await supabase.from('leases').select('id, charges_amount').eq('id', leaseId).eq('workspace_id', workspaceId).maybeSingle<{id: string; charges_amount: number | null}>();

  if (!lease) {
    redirect(`${localizedPath(locale, '/transactions')}?error=lease_missing`);
  }

  const chargesAmount = Number(lease.charges_amount ?? 0);
  const rentAmount = Math.max(0, amount - chargesAmount);
  const {data: charge, error: chargeError} = await supabase
    .from('rent_charges')
    .upsert(
      {
        charges_amount: chargesAmount,
        due_date: receivedAt,
        lease_id: leaseId,
        notes: value(formData, 'notes') || null,
        period_month: periodMonth,
        rent_amount: rentAmount,
        status,
        total_due: amount,
        workspace_id: workspaceId
      },
      {onConflict: 'lease_id,period_month'}
    )
    .select('id')
    .single<{id: string}>();

  if (chargeError || !charge) {
    redirect(`${localizedPath(locale, '/transactions')}?error=revenue_failed`);
  }

  if (status === 'paid') {
    const {error: paymentError} = await supabase.from('rent_payments').insert({
      amount,
      notes: value(formData, 'notes') || null,
      paid_at: receivedAt,
      payment_method: paymentMethod(value(formData, 'payment_method')),
      rent_charge_id: charge.id,
      workspace_id: workspaceId
    });

    if (paymentError) {
      redirect(`${localizedPath(locale, '/transactions')}?error=payment_failed`);
    }
  }

  revalidatePath(localizedPath(locale, '/transactions'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(localizedPath(locale, '/transactions'));
}

export async function createExpenseTransactionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const amount = moneyValue(formData, 'amount');
  const expenseDate = value(formData, 'expense_date');

  if (!expenseDate || amount <= 0) {
    redirect(`${localizedPath(locale, '/transactions')}?error=expense_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const file = formData.get('receipt');
  let documentId: string | null = null;

  if (file instanceof File && file.size > 0) {
    const storageGate = await canStoreDocument(supabase, workspaceId, file.size);

    if (!storageGate.allowed) {
      redirect(`${localizedPath(locale, '/transactions')}?error=${storageGate.reason === 'file_size' ? 'file_too_large' : 'storage_limit'}`);
    }

    documentId = randomUUID();
    const year = new Date(expenseDate).getUTCFullYear();
    const filePath = `workspace/${workspaceId}/documents/${year}/${documentId}-${safeFileName(file.name)}`;
    const {error: uploadError} = await supabase.storage.from('documents').upload(filePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    });

    if (uploadError) {
      redirect(`${localizedPath(locale, '/transactions')}?error=upload_failed`);
    }

    const {error: documentError} = await supabase.from('documents').insert({
      document_type: 'invoice',
      extracted_amount: amount,
      extracted_date: expenseDate,
      extracted_vendor: value(formData, 'vendor') || null,
      file_name: file.name,
      file_path: filePath,
      id: documentId,
      mime_type: file.type || null,
      property_id: value(formData, 'property_id') || null,
      size_bytes: file.size,
      workspace_id: workspaceId
    });

    if (documentError) {
      await supabase.storage.from('documents').remove([filePath]);
      redirect(`${localizedPath(locale, '/transactions')}?error=document_failed`);
    }
  }

  const {error} = await supabase.from('expenses').insert({
    amount,
    currency: 'EUR',
    description: value(formData, 'description') || null,
    document_id: documentId,
    expense_date: expenseDate,
    payment_method: paymentMethod(value(formData, 'payment_method')),
    payment_status: value(formData, 'payment_status') === 'pending' ? 'pending' : 'paid',
    property_id: value(formData, 'property_id') || null,
    receipt_status: documentId ? 'attached' : 'missing',
    tax_category_id: value(formData, 'tax_category_id') || null,
    vendor: value(formData, 'vendor') || null,
    workspace_id: workspaceId
  });

  if (error) {
    redirect(`${localizedPath(locale, '/transactions')}?error=expense_failed`);
  }

  revalidatePath(localizedPath(locale, '/transactions'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(localizedPath(locale, '/transactions'));
}
