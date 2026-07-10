import Link from 'next/link';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type BailListViewProps = {
  query?: string;
};

type LeaseCard = {
  charges_amount: number;
  end_date: string | null;
  id: string;
  monthly_rent: number;
  start_date: string;
  status: string;
  properties: {
    address_line1: string | null;
    city: string | null;
    id: string;
    name: string;
    postal_code: string | null;
  } | null;
  tenants: {
    full_name: string;
  } | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T00:00:00Z`));
}

function formatMoney(value: number) {
  return `${Number(value ?? 0).toLocaleString('fr-FR', {maximumFractionDigits: 0})}€`;
}

function formatPropertyAddress(property: LeaseCard['properties']) {
  if (!property) {
    return '-';
  }

  return [property.address_line1, property.city].filter(Boolean).join(' - ') || property.name;
}

function leaseMatches(lease: LeaseCard, query: string) {
  const searchable = [lease.properties?.name, lease.properties?.address_line1, lease.properties?.city, lease.properties?.postal_code, lease.tenants?.full_name].filter(Boolean).join(' ').toLowerCase();

  return searchable.includes(query.toLowerCase());
}

function statusBadge(status: string) {
  if (status === 'active') {
    return {
      className: 'bg-[#ecfdf5] text-[#047857]',
      label: 'Actif'
    };
  }

  if (status === 'terminated') {
    return {
      className: 'bg-[#eef2ff] text-[#3755c3]',
      label: 'Termine'
    };
  }

  return {
    className: 'bg-[#fff4db] text-[#9a5a00]',
    label: 'Clauses a definir'
  };
}

export async function BailListView({query = ''}: BailListViewProps) {
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data} = await supabase
    .from('leases')
    .select('id, status, start_date, end_date, monthly_rent, charges_amount, tenants(full_name), properties(id, name, address_line1, postal_code, city)')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .returns<LeaseCard[]>();
  const normalizedQuery = query.trim();
  const leases = (data ?? []).filter((lease) => (normalizedQuery ? leaseMatches(lease, normalizedQuery) : true));

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">Bail</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Retrouvez vos contrats et creez un nouveau bail depuis un bien.</p>
        </div>
        <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-white shadow-sm" href="/bail/new" style={{color: '#ffffff'}}>
          + Nouveau bail
        </Link>
      </div>

      <section className="mt-8 rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <form action={`/${locale}/bail`} className="relative w-full md:max-w-sm">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">Q</span>
            <input className="focus-ring min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-11 text-sm" defaultValue={query} name="q" placeholder="Rechercher..." />
          </form>
        </div>
      </section>

      <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {leases.length ? (
          leases.map((lease) => {
            const badge = statusBadge(lease.status);

            return (
              <Link className="block rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href={lease.properties?.id ? `/bail?property_id=${lease.properties.id}` : '/bail/new'} key={lease.id}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate text-xl font-semibold text-[#17211f]">{lease.properties?.name ?? 'Bail sans bien'}</h2>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[#53615f]">
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#c7d2ce] text-[10px] font-bold">P</span>
                    <span className="truncate">{lease.tenants?.full_name ?? 'Locataire a definir'}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#c7d2ce] text-[10px] font-bold">B</span>
                    <span className="truncate">{formatPropertyAddress(lease.properties)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded border border-[#c7d2ce] text-[10px] font-bold">D</span>
                    <span>
                      Du {formatDate(lease.start_date)} au {formatDate(lease.end_date)}
                    </span>
                  </p>
                </div>
                <dl className="mt-5 grid gap-2 border-t border-[var(--line-soft)] pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">Loyer</dt>
                    <dd className="font-semibold text-[#00796b] tabular-nums">{formatMoney(lease.monthly_rent)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">Provision sur charges</dt>
                    <dd className="font-semibold text-[#00796b] tabular-nums">{formatMoney(lease.charges_amount)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">Frequence</dt>
                    <dd className="font-medium">mensuelle</dd>
                  </div>
                </dl>
              </Link>
            );
          })
        ) : (
          <div className="rounded-xl border border-[var(--line-soft)] bg-white p-6 text-sm text-[var(--muted)] sm:col-span-2 xl:col-span-3">Aucun bail trouve.</div>
        )}
      </section>
    </AppShell>
  );
}
