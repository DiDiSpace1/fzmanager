import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {QuittanceForm, type QuittanceLeaseOption, type RecentReceipt} from './quittance-form';

export default async function QuittancePage() {
  const locale = await getLocale();
  const {profile, supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: leases} = await supabase
    .from('leases')
    .select('id, monthly_rent, charges_amount, properties(name), units(name), tenants(full_name)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('created_at', {ascending: false})
    .returns<QuittanceLeaseOption[]>();
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
    <AppShell>
      <QuittanceForm leases={leases ?? []} locale={locale} ownerName={profile.email ?? ''} recentReceipts={recentReceipts} />
    </AppShell>
  );
}
