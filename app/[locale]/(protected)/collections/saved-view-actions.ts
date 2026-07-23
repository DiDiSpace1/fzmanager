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

function href(locale: string, month: string, view: string, status: string) {
  const params = new URLSearchParams({month, saved_view: status, view});
  return `${localizedPath(locale, '/collections')}?${params.toString()}`;
}

export async function saveCollectionViewAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const month = value(formData, 'month');
  const view = value(formData, 'view');
  const name = value(formData, 'name').slice(0, 60);

  if (!name || !/^\d{4}-\d{2}$/.test(month) || !['all', 'open', 'unpaid', 'partial', 'paid'].includes(view)) {
    redirect(href(locale, month, view, 'invalid'));
  }

  const {supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (!hasPaidAccess(billing) || normalizeBillingPlan(billing?.plan) !== 'portfolio') {
    redirect(href(locale, month, view, 'portfolio_required'));
  }

  const {error} = await supabase.from('collection_saved_views').upsert(
    {month, name, user_id: user.id, view, workspace_id: workspaceId},
    {onConflict: 'workspace_id,user_id,name'}
  );

  if (error) {
    redirect(href(locale, month, view, 'failed'));
  }

  revalidatePath(localizedPath(locale, '/collections'));
  redirect(href(locale, month, view, 'saved'));
}

export async function deleteCollectionViewAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const id = value(formData, 'id');
  const month = value(formData, 'month');
  const view = value(formData, 'view');
  const {supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);

  await supabase.from('collection_saved_views').delete().eq('id', id).eq('workspace_id', workspaceId).eq('user_id', user.id);
  revalidatePath(localizedPath(locale, '/collections'));
  redirect(href(locale, month, view, 'deleted'));
}
