import type {SupabaseClient} from '@supabase/supabase-js';

export async function recordAutoQuittanceEvent(
  supabase: SupabaseClient,
  input: {
    documentId?: string | null;
    leaseId: string;
    message?: string | null;
    periodMonth: string;
    status: 'created' | 'failed' | 'skipped';
    tenantId: string;
    workspaceId: string;
  }
) {
  const {error} = await supabase.from('automation_events').insert({
    automation_type: 'auto_quittance',
    document_id: input.documentId ?? null,
    lease_id: input.leaseId,
    message: input.message ?? null,
    period_month: input.periodMonth,
    status: input.status,
    tenant_id: input.tenantId,
    workspace_id: input.workspaceId
  });

  if (error) {
    console.error('Automation event insert failed', {error, leaseId: input.leaseId, workspaceId: input.workspaceId});
  }
}
