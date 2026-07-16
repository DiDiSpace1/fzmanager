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

function revenueType(value: string) {
  return ['rent', 'deposit', 'other'].includes(value) ? value : 'rent';
}

function isRentPayment(payment: {revenue_type?: string | null}) {
  return !payment.revenue_type || payment.revenue_type === 'rent';
}

export async function createRevenueTransactionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const leaseId = value(formData, 'lease_id');
  const periodMonth = monthStart(value(formData, 'period_month'));
  const amount = moneyValue(formData, 'amount');
  const receivedAt = value(formData, 'received_at') || new Date().toISOString().slice(0, 10);
  const type = revenueType(value(formData, 'revenue_type'));

  if (!leaseId || !periodMonth || amount <= 0) {
    redirect(`${localizedPath(locale, '/transactions')}?error=revenue_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: lease} = await supabase
    .from('leases')
    .select('id, monthly_rent, charges_amount')
    .eq('id', leaseId)
    .eq('workspace_id', workspaceId)
    .maybeSingle<{id: string; monthly_rent: number | null; charges_amount: number | null}>();

  if (!lease) {
    redirect(`${localizedPath(locale, '/transactions')}?error=lease_missing`);
  }

  const rentAmount = Number(lease.monthly_rent ?? 0);
  const chargesAmount = Number(lease.charges_amount ?? 0);
  const totalDue = rentAmount + chargesAmount;
  const {data: existingCharge} = await supabase
    .from('rent_charges')
    .select('id, rent_payments(amount, revenue_type)')
    .eq('workspace_id', workspaceId)
    .eq('lease_id', leaseId)
    .eq('period_month', periodMonth)
    .maybeSingle<{id: string; rent_payments: {amount: number | null; revenue_type: string | null}[]}>();
  const alreadyPaid = existingCharge?.rent_payments.filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) ?? 0;
  const nextPaid = alreadyPaid + (type === 'rent' ? amount : 0);
  const remainingDue = Math.max(0, totalDue - alreadyPaid);

  if (type === 'rent' && amount > remainingDue) {
    redirect(`${localizedPath(locale, '/transactions')}?error=revenue_overpaid`);
  }

  const status = nextPaid <= 0 ? 'unpaid' : nextPaid < totalDue ? 'partial' : 'paid';
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
        total_due: totalDue,
        workspace_id: workspaceId
      },
      {onConflict: 'lease_id,period_month'}
    )
    .select('id')
    .single<{id: string}>();

  if (chargeError || !charge) {
    redirect(`${localizedPath(locale, '/transactions')}?error=revenue_failed`);
  }

  const {error: paymentError} = await supabase.from('rent_payments').insert({
    amount,
    notes: value(formData, 'notes') || null,
    paid_at: receivedAt,
    payment_method: paymentMethod(value(formData, 'payment_method')),
    revenue_type: type,
    rent_charge_id: charge.id,
    workspace_id: workspaceId
  });

  if (paymentError) {
    redirect(`${localizedPath(locale, '/transactions')}?error=payment_failed`);
  }

  revalidatePath(localizedPath(locale, '/transactions'));
  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(`${localizedPath(locale, '/transactions')}?success=transaction_created`);
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
  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(`${localizedPath(locale, '/transactions')}?success=transaction_created`);
}

async function updateRentChargeStatus(supabase: Awaited<ReturnType<typeof getCurrentUserWorkspace>>['supabase'], workspaceId: string, rentChargeId: string) {
  const {data: charge} = await supabase
    .from('rent_charges')
    .select('id, total_due, rent_payments(amount, revenue_type)')
    .eq('id', rentChargeId)
    .eq('workspace_id', workspaceId)
    .single<{id: string; total_due: number | null; rent_payments: {amount: number | null; revenue_type: string | null}[]}>();

  if (!charge) {
    return;
  }

  const paidTotal = charge.rent_payments.filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const totalDue = Number(charge.total_due ?? 0);
  const status = paidTotal <= 0 ? 'unpaid' : paidTotal >= totalDue ? 'paid' : 'partial';

  await supabase.from('rent_charges').update({status}).eq('id', rentChargeId).eq('workspace_id', workspaceId);
}

export async function updateTransactionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const type = value(formData, 'type');
  const id = value(formData, 'id');
  const amount = moneyValue(formData, 'amount');

  if (!id || amount <= 0) {
    redirect(`${localizedPath(locale, '/transactions')}?error=transaction_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);

  if (type === 'revenue') {
    const paidAt = value(formData, 'date') || new Date().toISOString().slice(0, 10);
    const {data: payment} = await supabase.from('rent_payments').select('id, amount, revenue_type, rent_charge_id, rent_charges(total_due, rent_payments(id, amount, revenue_type))').eq('id', id).eq('workspace_id', workspaceId).single<{
      amount: number | null;
      id: string;
      revenue_type: string | null;
      rent_charge_id: string;
      rent_charges: {total_due: number | null; rent_payments: {id: string; amount: number | null; revenue_type: string | null}[]} | null;
    }>();

    if (!payment) {
      redirect(`${localizedPath(locale, '/transactions')}?error=payment_not_found`);
    }

    const otherPaid = (payment.rent_charges?.rent_payments ?? []).filter((row) => row.id !== payment.id && isRentPayment(row)).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const totalDue = Number(payment.rent_charges?.total_due ?? 0);

    if (isRentPayment(payment) && amount > Math.max(0, totalDue - otherPaid)) {
      redirect(`${localizedPath(locale, '/transactions')}?error=revenue_overpaid`);
    }

    const {error} = await supabase
      .from('rent_payments')
      .update({
        amount,
        notes: value(formData, 'notes') || null,
        paid_at: paidAt,
        payment_method: paymentMethod(value(formData, 'payment_method'))
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      redirect(`${localizedPath(locale, '/transactions')}?error=payment_update_failed`);
    }

    await updateRentChargeStatus(supabase, workspaceId, payment.rent_charge_id);
  } else if (type === 'expense') {
    const expenseDate = value(formData, 'date');
    const {error} = await supabase
      .from('expenses')
      .update({
        amount,
        description: value(formData, 'description') || null,
        expense_date: expenseDate,
        property_id: value(formData, 'property_id') || null,
        tax_category_id: value(formData, 'tax_category_id') || null,
        vendor: value(formData, 'vendor') || null
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      redirect(`${localizedPath(locale, '/transactions')}?error=expense_update_failed`);
    }
  }

  revalidatePath(localizedPath(locale, '/transactions'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(`${localizedPath(locale, '/transactions')}?success=transaction_updated`);
}

export async function deleteTransactionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const type = value(formData, 'type');
  const id = value(formData, 'id');

  if (!id) {
    redirect(`${localizedPath(locale, '/transactions')}?error=transaction_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);

  if (type === 'revenue') {
    const {data: payment} = await supabase.from('rent_payments').select('rent_charge_id').eq('id', id).eq('workspace_id', workspaceId).single<{rent_charge_id: string}>();
    const {error} = await supabase.from('rent_payments').delete().eq('id', id).eq('workspace_id', workspaceId);

    if (error) {
      redirect(`${localizedPath(locale, '/transactions')}?error=payment_delete_failed`);
    }

    if (payment?.rent_charge_id) {
      await updateRentChargeStatus(supabase, workspaceId, payment.rent_charge_id);
    }
  } else if (type === 'expense') {
    const {error} = await supabase.from('expenses').delete().eq('id', id).eq('workspace_id', workspaceId);

    if (error) {
      redirect(`${localizedPath(locale, '/transactions')}?error=expense_delete_failed`);
    }
  }

  revalidatePath(localizedPath(locale, '/transactions'));
  revalidatePath(localizedPath(locale, '/dashboard'));
  revalidatePath(localizedPath(locale, '/tax'));
  redirect(`${localizedPath(locale, '/transactions')}?success=transaction_deleted`);
}
