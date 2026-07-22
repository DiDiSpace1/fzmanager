import {getLocale} from 'next-intl/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {QuittanceForm, type QuittancePropertyOption, type QuittanceTenantOption, type RecentReceipt} from './quittance-form';

export const runtime = 'nodejs';

export default async function QuittancePage() {
  const locale = await getLocale();
  const {profile, supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const currentPlan = hasPaidAccess(billing) ? normalizeBillingPlan(billing?.plan) : 'free';
  const {data: properties} = await supabase
    .from('properties')
    .select('id, name, address_line1, postal_code, city, monthly_rent_estimate, charges_estimate')
    .eq('workspace_id', workspaceId)
    .order('name', {ascending: true})
    .returns<QuittancePropertyOption[]>();
  const {data: tenants} = await supabase
    .from('tenants')
    .select('id, full_name, leases(id, status, property_id, monthly_rent, charges_amount)')
    .eq('workspace_id', workspaceId)
    .order('full_name', {ascending: true})
    .returns<QuittanceTenantOption[]>();
  const {data: receipts} = await supabase
    .from('documents')
    .select('id, file_name, file_path, period_month, tenants(full_name)')
    .eq('workspace_id', workspaceId)
    .eq('document_type', 'rent_receipt')
    .order('created_at', {ascending: false})
    .limit(5)
    .returns<(RecentReceipt & {file_path: string})[]>();
  const recentReceipts: RecentReceipt[] = await Promise.all(
    (receipts ?? []).map(async (receipt) => {
      const {data} = await supabase.storage.from('documents').createSignedUrl(receipt.file_path, 60 * 10, {
        download: receipt.file_name
      });

      return {
        downloadUrl: data?.signedUrl ?? null,
        file_name: receipt.file_name,
        id: receipt.id,
        period_month: receipt.period_month,
        tenants: receipt.tenants
      };
    })
  );

  return (
    <>
      <QuittanceForm currentPlan={currentPlan} locale={locale} ownerName={profile.email ?? ''} properties={properties ?? []} recentReceipts={recentReceipts} tenants={tenants ?? []} />
    </>
  );
}
