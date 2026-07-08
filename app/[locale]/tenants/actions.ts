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
    notes: value(formData, 'notes') || null,
    phone: value(formData, 'phone') || null,
    workspace_id: workspaceId
  });

  if (error) {
    redirect(`${localizedPath(locale, '/tenants')}?error=create_failed`);
  }

  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(localizedPath(locale, '/tenants'));
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
  redirect(localizedPath(locale, `/tenants/${tenantId}`));
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
  redirect(localizedPath(locale, '/tenants'));
}
