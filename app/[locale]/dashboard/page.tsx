import Link from 'next/link';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type DashboardProperty = {
  address_line1: string | null;
  city: string | null;
  id: string;
  name: string;
  postal_code: string | null;
  property_photos: {
    file_path: string;
    is_cover: boolean;
  }[];
  leases: {
    charges_amount: number;
    monthly_rent: number;
    status: string;
    tenants: {
      full_name: string;
    } | null;
  }[];
};

type RentCharge = {
  id: string;
  status: string;
  total_due: number;
  period_month: string;
  leases: {
    properties: {
      name: string;
    } | null;
    tenants: {
      full_name: string;
    } | null;
  } | null;
};

const defaultApartmentPhoto = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80';

function currentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function formatMoney(value: number) {
  return `${value.toLocaleString('fr-FR', {maximumFractionDigits: 0})} EUR`;
}

function formatAddress(property: Pick<DashboardProperty, 'address_line1' | 'postal_code' | 'city'>) {
  return [property.address_line1, property.postal_code, property.city].filter(Boolean).join(', ') || 'Adresse a completer';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const month = currentMonthStart();
  const {data: properties} = await supabase
    .from('properties')
    .select('id, name, address_line1, postal_code, city, property_photos(file_path, is_cover), leases(status, monthly_rent, charges_amount, tenants(full_name))')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .returns<DashboardProperty[]>();
  const {data: rentCharges} = await supabase
    .from('rent_charges')
    .select('id, status, total_due, period_month, leases(tenants(full_name), properties(name))')
    .eq('workspace_id', workspaceId)
    .eq('period_month', month)
    .order('created_at', {ascending: false})
    .limit(5)
    .returns<RentCharge[]>();

  const rows = properties ?? [];
  const charges = rentCharges ?? [];
  const activeLeaseCount = rows.reduce((sum, property) => sum + property.leases.filter((lease) => lease.status === 'active').length, 0);
  const activeRentTotal = rows.reduce(
    (sum, property) =>
      sum +
      property.leases
        .filter((lease) => lease.status === 'active')
        .reduce((leaseSum, lease) => leaseSum + Number(lease.monthly_rent ?? 0) + Number(lease.charges_amount ?? 0), 0),
    0
  );
  const unpaidTotal = charges.filter((charge) => charge.status !== 'paid' && charge.status !== 'waived').reduce((sum, charge) => sum + Number(charge.total_due ?? 0), 0);
  const paidTotal = charges.filter((charge) => charge.status === 'paid').reduce((sum, charge) => sum + Number(charge.total_due ?? 0), 0);
  const signedPhotos = new Map<string, string>();

  await Promise.all(
    rows.map(async (property) => {
      const cover = property.property_photos.find((photo) => photo.is_cover) ?? property.property_photos[0];

      if (!cover) {
        return;
      }

      const {data} = await supabase.storage.from('property-photos').createSignedUrl(cover.file_path, 60 * 5);

      if (data?.signedUrl) {
        signedPhotos.set(property.id, data.signedUrl);
      }
    })
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">Tableau de bord</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Vue rapide de vos biens, baux et loyers du mois.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold" href="/documents">
            Rapport
          </Link>
          <Link className="focus-ring inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" href="/properties?new=1" style={{color: '#ffffff'}}>
            + Ajouter un bien
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard accent="teal" label="Loyers mensuels" value={formatMoney(activeRentTotal)} />
        <MetricCard accent="blue" label="Encaisses ce mois" value={formatMoney(paidTotal)} />
        <MetricCard accent="red" label="Impayes" value={formatMoney(unpaidTotal)} />
        <MetricCard accent="teal" label="Baux actifs" value={activeLeaseCount.toString()} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          <section className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--line-soft)] bg-[#f0f5f2] px-5 py-4">
              <h2 className="text-base font-semibold">Paiements du mois</h2>
              <Link className="text-sm font-semibold text-[var(--accent)]" href="/tenants?view=overdue">
                Voir tout
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead className="bg-[#f0f5f2] text-[11px] font-semibold uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-3">Locataire</th>
                    <th className="px-5 py-3">Bien</th>
                    <th className="px-5 py-3">Periode</th>
                    <th className="px-5 py-3">Montant</th>
                    <th className="px-5 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-soft)]">
                  {charges.length ? (
                    charges.map((charge) => {
                      const tenantName = charge.leases?.tenants?.full_name ?? 'Locataire';

                      return (
                        <tr className="transition hover:bg-[#f0f5f2]" key={charge.id}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dee4e1] text-xs font-bold">{initials(tenantName) || 'LO'}</span>
                              <span className="text-sm font-medium">{tenantName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm">{charge.leases?.properties?.name ?? '-'}</td>
                          <td className="px-5 py-4 text-sm tabular-nums">{charge.period_month.slice(0, 7)}</td>
                          <td className="px-5 py-4 text-sm font-semibold tabular-nums">{formatMoney(Number(charge.total_due ?? 0))}</td>
                          <td className="px-5 py-4">
                            <StatusBadge status={charge.status} />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-5 py-8 text-center text-sm text-[var(--muted)]" colSpan={5}>
                        Aucun paiement pour ce mois.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Biens crees</h2>
              <Link className="text-sm font-semibold text-[var(--accent)]" href="/properties">
                Tout voir
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {rows.length ? (
                rows.map((property) => {
                  const activeLeases = property.leases.filter((lease) => lease.status === 'active');
                  const propertyRentTotal = activeLeases.reduce((sum, lease) => sum + Number(lease.monthly_rent ?? 0) + Number(lease.charges_amount ?? 0), 0);
                  const photoUrl = signedPhotos.get(property.id) ?? defaultApartmentPhoto;

                  return (
                    <Link className="group overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm transition hover:bg-[#f8fbfa]" href={`/properties/${property.id}`} key={property.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" className="h-36 w-full object-cover" src={photoUrl} />
                      <div className="p-5">
                        <h3 className="truncate text-base font-semibold">{property.name}</h3>
                        <p className="mt-1 truncate text-sm text-[var(--muted)]">{formatAddress(property)}</p>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <span className={activeLeases.length ? 'rounded bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#047857]' : 'rounded bg-[#eef2ff] px-2.5 py-1 text-xs font-semibold text-[#3755c3]'}>
                            {activeLeases.length ? 'Loue' : 'Vacant'}
                          </span>
                          <span className="text-sm font-bold text-[var(--accent)] tabular-nums">{activeLeases.length ? `${formatMoney(propertyRentTotal)} / mois` : '暂无'}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-xl border border-[var(--line-soft)] bg-white p-6 text-sm text-[var(--muted)] md:col-span-2">Aucun bien cree pour le moment.</div>
              )}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <section className="rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Actions rapides</h2>
              <span className="text-sm text-[var(--muted)]">Checklist</span>
            </div>
            <div className="mt-5 grid gap-3">
              <QuickAction href="/bail" label="Creer un bail" note="Associer un locataire a un bien" />
              <QuickAction href="/documents" label="Ajouter un document" note="Classer bail, quittance ou impots" />
              <QuickAction href="/tax" label="Preparer le fiscal" note="Verifier les revenus et depenses" />
            </div>
          </section>

          <section className="relative overflow-hidden rounded-xl bg-[var(--accent)] p-5 text-white shadow-sm">
            <h2 className="text-base font-semibold">Preparation fiscale</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">Gardez vos loyers et justificatifs prets pour votre declaration.</p>
            <div className="mt-5 h-2 rounded-full bg-white/20">
              <div className="h-full w-3/4 rounded-full bg-white" />
            </div>
            <Link className="focus-ring mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-[var(--accent)]" href="/tax">
              Continuer
            </Link>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

function MetricCard({accent, label, value}: {accent: 'blue' | 'red' | 'teal'; label: string; value: string}) {
  const accents = {
    blue: 'bg-[#eef2ff] text-[#3755c3]',
    red: 'bg-[#ffdad6] text-[#ba1a1a]',
    teal: 'bg-[#e1faf5] text-[var(--accent)]'
  };

  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full ${accents[accent]}`}>
        <span className="h-2.5 w-2.5 rounded-full bg-current" />
      </div>
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatusBadge({status}: {status: string}) {
  const paid = status === 'paid';
  const partial = status === 'partial';
  const className = paid ? 'bg-[#ecfdf5] text-[#047857]' : partial ? 'bg-[#fff8ec] text-[#9a5a00]' : 'bg-[#ffdad6] text-[#ba1a1a]';
  const label = paid ? 'Encaisse' : partial ? 'Partiel' : 'A suivre';

  return <span className={`rounded px-2 py-1 text-[11px] font-bold uppercase ${className}`}>{label}</span>;
}

function QuickAction({href, label, note}: {href: string; label: string; note: string}) {
  return (
    <Link className="rounded-lg border-l-4 border-[var(--accent)] bg-[#f0f5f2] p-4 transition hover:bg-[#eaefed]" href={href}>
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-1 block text-sm text-[var(--muted)]">{note}</span>
    </Link>
  );
}
