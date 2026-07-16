'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {canCreateResource} from '@/lib/billing/limits';
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

function tenantsHref(locale: string, formData: FormData) {
  const params = new URLSearchParams();
  const month = value(formData, 'month');
  const view = value(formData, 'view');
  const query = value(formData, 'q');

  if (month) {
    params.set('month', month);
  }

  if (view) {
    params.set('view', view);
  }

  if (query) {
    params.set('q', query);
  }

  const suffix = params.toString();
  return `${localizedPath(locale, '/tenants')}${suffix ? `?${suffix}` : ''}`;
}

function withStatus(url: string, key: 'error' | 'success', value: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${value}`;
}

export async function createTenantAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const fullName = value(formData, 'full_name');

  if (!fullName) {
    redirect(`${localizedPath(locale, '/tenants')}?error=missing_name`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const planGate = await canCreateResource(supabase, workspaceId, 'tenants');

  if (!planGate.allowed) {
    redirect(`${localizedPath(locale, '/tenants')}?error=plan_limit`);
  }

  const {error} = await supabase.from('tenants').insert({
    email: value(formData, 'email') || null,
    full_name: fullName,
    is_active: true,
    notes: value(formData, 'notes') || null,
    phone: value(formData, 'phone') || null,
    workspace_id: workspaceId
  });

  if (error) {
    redirect(`${localizedPath(locale, '/tenants')}?error=create_failed`);
  }

  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(`${localizedPath(locale, '/tenants')}?success=tenant_created`);
}

export async function updateTenantAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const tenantId = value(formData, 'tenant_id');
  const fullName = value(formData, 'full_name');

  if (!tenantId || !fullName) {
    redirect(`${localizedPath(locale, `/tenants/${tenantId}`)}?error=missing_name`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {error} = await supabase
    .from('tenants')
    .update({
      email: value(formData, 'email') || null,
      full_name: fullName,
      notes: value(formData, 'notes') || null,
      phone: value(formData, 'phone') || null
    })
    .eq('id', tenantId)
    .eq('workspace_id', workspaceId);

  if (error) {
    redirect(`${localizedPath(locale, `/tenants/${tenantId}/edit`)}?error=update_failed`);
  }

  revalidatePath(localizedPath(locale, '/tenants'));
  revalidatePath(localizedPath(locale, `/tenants/${tenantId}`));
  redirect(`${localizedPath(locale, `/tenants/${tenantId}`)}?success=tenant_updated`);
}

export async function deleteTenantAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const tenantId = value(formData, 'tenant_id');

  if (!tenantId) {
    redirect(`${localizedPath(locale, '/tenants')}?error=missing_tenant`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {error} = await supabase.from('tenants').delete().eq('id', tenantId).eq('workspace_id', workspaceId);

  if (error) {
    redirect(`${localizedPath(locale, '/tenants')}?error=delete_failed`);
  }

  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(`${localizedPath(locale, '/tenants')}?success=tenant_deleted`);
}

export async function updateTenantActiveAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const tenantId = value(formData, 'tenant_id');
  const isActive = value(formData, 'is_active') === 'true';

  if (!tenantId) {
    redirect(`${localizedPath(locale, '/tenants')}?error=missing_tenant`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {error} = await supabase.from('tenants').update({is_active: isActive}).eq('id', tenantId).eq('workspace_id', workspaceId);

  if (error) {
    redirect(`${localizedPath(locale, '/tenants')}?error=tenant_status_failed`);
  }

  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(withStatus(tenantsHref(locale, formData), 'success', 'tenant_status_updated'));
}

export async function updateRentStatusAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const leaseId = value(formData, 'lease_id');
  const periodMonth = value(formData, 'period_month');
  const status = value(formData, 'status');
  const paidAmount = moneyValue(formData, 'paid_amount');

  if (!leaseId || !/^\d{4}-\d{2}-\d{2}$/.test(periodMonth) || !['paid', 'partial', 'unpaid'].includes(status)) {
    redirect(`${localizedPath(locale, '/tenants')}?error=rent_status_missing`);
  }

  if (status === 'partial' && paidAmount <= 0) {
    redirect(`${localizedPath(locale, '/tenants')}?error=partial_amount_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: lease, error: leaseError} = await supabase
    .from('leases')
    .select('id, monthly_rent, charges_amount')
    .eq('id', leaseId)
    .eq('workspace_id', workspaceId)
    .single();

  if (leaseError || !lease) {
    redirect(`${localizedPath(locale, '/tenants')}?error=lease_missing`);
  }

  const totalDue = Number(lease.monthly_rent ?? 0) + Number(lease.charges_amount ?? 0);
  const {data: rentCharge, error} = await supabase
    .from('rent_charges')
    .upsert(
      {
        charges_amount: Number(lease.charges_amount ?? 0),
        lease_id: leaseId,
        period_month: periodMonth,
        rent_amount: Number(lease.monthly_rent ?? 0),
        status,
        total_due: totalDue,
        workspace_id: workspaceId
      },
      {onConflict: 'lease_id,period_month'}
    )
    .select('id')
    .single();

  if (error || !rentCharge) {
    redirect(`${localizedPath(locale, '/tenants')}?error=rent_status_failed`);
  }

  if (status === 'partial' || status === 'paid') {
    const amount = status === 'paid' ? totalDue : paidAmount;
    await supabase.from('rent_payments').insert({
      amount,
      paid_at: new Date().toISOString().slice(0, 10),
      payment_method: 'bank_transfer',
      revenue_type: 'rent',
      rent_charge_id: rentCharge.id,
      workspace_id: workspaceId
    });
  }

  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(localizedPath(locale, `/tenants?month=${periodMonth.slice(0, 7)}&success=rent_status_updated`));
}
