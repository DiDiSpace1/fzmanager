import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type TenantDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type TenantDetail = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  leases: {
    id: string;
    status: string;
    start_date: string;
    end_date: string | null;
    monthly_rent: number;
    charges_amount: number;
    deposit_amount: number;
    properties: {name: string; address_line1: string | null; city: string | null} | null;
    units: {name: string} | null;
    rent_charges: {period_month: string; status: string; total_due: number}[];
  }[];
};

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'L') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '');
}

function money(value: number | null | undefined) {
  return value || value === 0 ? `${Number(value).toLocaleString('fr-FR')} EUR` : '-';
}

export default async function TenantDetailPage({params}: TenantDetailPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: tenant, error} = await supabase
    .from('tenants')
    .select(
      'id, full_name, email, phone, notes, leases(id, status, start_date, end_date, monthly_rent, charges_amount, deposit_amount, properties(name, address_line1, city), units(name), rent_charges(period_month, status, total_due))'
    )
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<TenantDetail>();

  if (error || !tenant) {
    notFound();
  }

  const activeLease = tenant.leases.find((lease) => lease.status === 'active') ?? tenant.leases[0] ?? null;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[var(--accent)]" href="/tenants">
            Retour aux locataires
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dde1ff] text-lg font-bold uppercase text-[#3755c3]">{initials(tenant.full_name)}</div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{tenant.full_name}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">{[tenant.email, tenant.phone].filter(Boolean).join(' · ') || 'Contact a completer'}</p>
            </div>
          </div>
        </div>
        <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href={`/tenants/${tenant.id}/edit`} style={{color: '#ffffff'}}>
          Modifier
        </Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <InfoCard label="Statut" value={activeLease?.status ?? 'Sans bail'} />
        <InfoCard label="Bien occupe" value={activeLease?.properties?.name ?? '-'} />
        <InfoCard label="Loyer" value={money(activeLease?.monthly_rent)} />
        <InfoCard label="Depot" value={money(activeLease?.deposit_amount)} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Coordonnees</h2>
            <dl className="mt-5 grid gap-4 md:grid-cols-2">
              <DataRow label="Email" value={tenant.email ?? '-'} />
              <DataRow label="Telephone" value={tenant.phone ?? '-'} />
            </dl>
          </section>

          <section className="rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
            <div className="border-b border-[var(--line-soft)] p-5">
              <h2 className="text-lg font-semibold">Baux</h2>
            </div>
            {tenant.leases.length ? (
              <div className="divide-y divide-[var(--line-soft)]">
                {tenant.leases.map((lease) => (
                  <div className="grid gap-3 p-5 md:grid-cols-[1fr_auto]" key={lease.id}>
                    <div>
                      <p className="font-medium">{lease.properties?.name ?? 'Bien'}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{[lease.units?.name, lease.start_date, lease.end_date].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{money(lease.monthly_rent)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-[var(--muted)]">Aucun bail enregistre pour ce locataire.</div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
            <div className="border-b border-[var(--line-soft)] p-5">
              <h2 className="text-lg font-semibold">Dernieres echeances</h2>
            </div>
            {activeLease?.rent_charges.length ? (
              <div className="divide-y divide-[var(--line-soft)]">
                {[...activeLease.rent_charges]
                  .sort((a, b) => b.period_month.localeCompare(a.period_month))
                  .slice(0, 6)
                  .map((charge) => (
                    <div className="flex items-center justify-between p-5" key={charge.period_month}>
                      <div>
                        <p className="font-medium">{charge.period_month.slice(0, 7)}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{charge.status}</p>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">{money(charge.total_due)}</div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-[var(--muted)]">Aucune echeance generee.</div>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Notes</h2>
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{tenant.notes || 'Aucune note pour le moment.'}</p>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

function InfoCard({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </div>
  );
}

function DataRow({label, value}: {label: string; value: string}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
