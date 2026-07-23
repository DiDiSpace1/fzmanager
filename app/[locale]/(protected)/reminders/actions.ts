'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function selectedLeaseIds(formData: FormData) {
  return formData
    .getAll('lease_ids')
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function reminderDay(formData: FormData) {
  const parsed = Number.parseInt(value(formData, 'rent_reminder_day'), 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : null;
}

function daysBefore(formData: FormData) {
  const parsed = Number.parseInt(value(formData, 'rent_reminder_days_before'), 10);
  return [0, 1, 3, 7].includes(parsed) ? parsed : 0;
}

function remindersHref(locale: string, key: 'error' | 'success', status: string) {
  const params = new URLSearchParams({[key]: status});
  return `${localizedPath(locale, '/reminders')}?${params.toString()}`;
}

export async function updateReminderCenterAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const operation = value(formData, 'operation');
  const leaseIds = selectedLeaseIds(formData);

  if (!leaseIds.length) {
    redirect(remindersHref(locale, 'error', 'no_selection'));
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const hasPortfolioAccess = hasPaidAccess(billing) && normalizeBillingPlan(billing?.plan) === 'portfolio';

  if (!hasPortfolioAccess) {
    redirect(remindersHref(locale, 'error', 'portfolio_required'));
  }

  const updatePayload =
    operation === 'enable'
      ? {rent_reminder_enabled: true}
      : operation === 'disable'
        ? {rent_reminder_enabled: false}
        : operation === 'update_settings'
          ? {
              rent_reminder_day: reminderDay(formData),
              rent_reminder_days_before: daysBefore(formData)
            }
          : null;

  if (!updatePayload) {
    redirect(remindersHref(locale, 'error', 'invalid_operation'));
  }

  const {error} = await supabase.from('leases').update(updatePayload).eq('workspace_id', workspaceId).eq('status', 'active').in('id', leaseIds);

  if (error) {
    redirect(remindersHref(locale, 'error', 'update_failed'));
  }

  revalidatePath(localizedPath(locale, '/reminders'));
  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(remindersHref(locale, 'success', operation));
}
