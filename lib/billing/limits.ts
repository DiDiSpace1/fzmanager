import type {SupabaseClient} from '@supabase/supabase-js';

import {type BillableResource, type BillingStatus, getPlanLimits, hasPaidAccess, normalizeBillingPlan} from './config';

const resourceTables: Record<BillableResource, string> = {
  documents: 'documents',
  properties: 'properties',
  tenants: 'tenants'
};

export async function getWorkspaceBilling(supabase: SupabaseClient, workspaceId: string) {
  const {data} = await supabase
    .from('workspace_billing')
    .select('current_period_end, lifetime_access, plan, status, stripe_customer_id, stripe_subscription_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle<BillingStatus>();

  return data ?? null;
}

export function canUseRentReminders(billing: BillingStatus | null | undefined) {
  if (!hasPaidAccess(billing)) {
    return false;
  }

  return ['plus', 'portfolio'].includes(normalizeBillingPlan(billing?.plan));
}

export function canUseAutoQuittance(billing: BillingStatus | null | undefined) {
  if (!hasPaidAccess(billing)) {
    return false;
  }

  return normalizeBillingPlan(billing?.plan) === 'portfolio';
}

export async function getPlanUsage(supabase: SupabaseClient, workspaceId: string, resource: BillableResource) {
  const {count} = await supabase
    .from(resourceTables[resource])
    .select('*', {count: 'exact', head: true})
    .eq('workspace_id', workspaceId);

  return count ?? 0;
}

export async function canCreateResource(supabase: SupabaseClient, workspaceId: string, resource: BillableResource) {
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const limits = getPlanLimits(hasPaidAccess(billing) ? billing?.plan : 'free');
  const usage = await getPlanUsage(supabase, workspaceId, resource);
  const limit = limits[resource];

  return {
    allowed: usage < limit,
    billing,
    limit,
    usage
  };
}

export async function getDocumentStorageUsage(supabase: SupabaseClient, workspaceId: string) {
  const {data} = await supabase.from('documents').select('size_bytes').eq('workspace_id', workspaceId);

  return (data ?? []).reduce((sum, document) => sum + Number(document.size_bytes ?? 0), 0);
}

export async function canStoreDocument(supabase: SupabaseClient, workspaceId: string, fileSize: number) {
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const limits = getPlanLimits(hasPaidAccess(billing) ? billing?.plan : 'free');
  const usage = await getDocumentStorageUsage(supabase, workspaceId);

  if (fileSize > limits.maxDocumentSizeBytes) {
    return {
      allowed: false,
      billing,
      limit: limits.maxDocumentSizeBytes,
      reason: 'file_size' as const,
      usage
    };
  }

  return {
    allowed: usage + fileSize <= limits.storageBytes,
    billing,
    limit: limits.storageBytes,
    reason: 'storage' as const,
    usage
  };
}
