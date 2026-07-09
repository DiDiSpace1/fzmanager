import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createTenantAction, deleteTenantAction, updateRentStatusAction} from './actions';
import {DeleteTenantButton} from './delete-tenant-button';
import {TenantActionDetails} from './tenant-action-details';

type TenantRow = {
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
    charges_amount: number;
    monthly_rent: number;
    properties: {name: string} | null;
    units: {name: string} | null;
    rent_charges: {status: string; period_month: string}[];
  }[];
};

type TenantsPageProps = {
  searchParams: Promise<{
    error?: string;
    month?: string;
    new?: string;
    q?: string;
    view?: string;
  }>;
};

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;
const TENANT_VIEWS = new Set(['all', 'active', 'unassigned', 'expiring', 'overdue']);

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'L') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '');
}

function isoMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthStart(month: string) {
  return `${month}-01`;
}

function parseMonthParam(month?: string) {
  if (month && MONTH_PARAM_PATTERN.test(month)) {
    return month;
  }

  return isoMonth(new Date());
}

function addMonths(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  return isoMonth(new Date(Date.UTC(year, monthIndex - 1 + offset, 1)));
}

function formatMonthLabel(month: string, locale: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const formatted = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'}).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function monthHref(month: string, queryText: string, view: string) {
  const params = new URLSearchParams({month, view});

  if (queryText) {
    params.set('q', queryText);
  }

  return `/tenants?${params.toString()}`;
}

function viewHref(view: string, month: string, queryText: string) {
  const params = new URLSearchParams({month, view});

  if (queryText) {
    params.set('q', queryText);
  }

  return `/tenants?${params.toString()}`;
}

function leaseCoversMonth(lease: TenantRow['leases'][number], month: string) {
  const start = monthStart(month);
  const nextMonth = monthStart(addMonths(month, 1));
  return lease.start_date < nextMonth && (!lease.end_date || lease.end_date >= start);
}

function displayLease(tenant: TenantRow, month: string) {
  const leasesInMonth = tenant.leases.filter((lease) => leaseCoversMonth(lease, month));
  return leasesInMonth.find((lease) => lease.status === 'active') ?? leasesInMonth[0] ?? null;
}

function activeLease(tenant: TenantRow, month: string) {
  return tenant.leases.find((lease) => lease.status === 'active' && leaseCoversMonth(lease, month)) ?? null;
}

function paymentStatus(lease: TenantRow['leases'][number] | null, month: string) {
  if (!lease) {
    return {className: 'bg-[#eef2ff] text-[#3755c3]', label: 'Sans bail'};
  }

  const charge = lease.rent_charges.find((rentCharge) => rentCharge.period_month === monthStart(month));

  if (!charge) {
    return {className: 'bg-[#eef2ff] text-[#3755c3]', label: lease.status === 'active' ? 'Actif' : lease.status};
  }

  if (charge.status === 'paid') {
    return {className: 'bg-[#ecfdf5] text-[#047857]', label: 'Paye'};
  }

  if (charge.status === 'partial') {
    return {className: 'bg-[#fff7ed] text-[#b45309]', label: 'Partiel'};
  }

  return {className: 'bg-[#fee2e2] text-[#ba1a1a]', label: 'Non paye'};
}

function hasOverdueRent(tenant: TenantRow, month: string) {
  const currentPeriod = monthStart(month);

  return tenant.leases.some((lease) =>
    lease.rent_charges.some((rentCharge) => rentCharge.period_month <= currentPeriod && ['partial', 'unpaid'].includes(rentCharge.status))
  );
}

function earliestOverdueMonth(tenants: TenantRow[], month: string) {
  const currentPeriod = monthStart(month);
  const overdueMonths = tenants.flatMap((tenant) =>
    tenant.leases.flatMap((lease) =>
      lease.rent_charges
        .filter((rentCharge) => rentCharge.period_month <= currentPeriod && ['partial', 'unpaid'].includes(rentCharge.status))
        .map((rentCharge) => rentCharge.period_month.slice(0, 7))
    )
  );

  return overdueMonths.sort()[0] ?? month;
}

function leaseExpiresSoon(tenant: TenantRow, month: string) {
  const lease = activeLease(tenant, month);

  if (!lease?.end_date) {
    return false;
  }

  const start = monthStart(month);
  const limit = monthStart(addMonths(month, 3));
  return lease.end_date >= start && lease.end_date < limit;
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export default async function TenantsPage({searchParams}: TenantsPageProps) {
  const t = await getTranslations('tenants');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const queryText = (params.q ?? '').trim();
  const selectedMonth = parseMonthParam(params.month);
  const selectedView = TENANT_VIEWS.has(params.view ?? '') ? params.view ?? 'active' : 'active';
  const previousMonth = addMonths(selectedMonth, -1);
  const nextMonth = addMonths(selectedMonth, 1);
  const showCreate = params.new === '1';

  let query = supabase
    .from('tenants')
    .select(
      'id, full_name, email, phone, notes, leases(id, status, start_date, end_date, monthly_rent, charges_amount, properties(name), units(name), rent_charges(status, period_month))'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false});

  if (queryText) {
    query = query.or(`full_name.ilike.%${queryText}%,email.ilike.%${queryText}%,phone.ilike.%${queryText}%`);
  }

  const {data: tenants, error} = await query.returns<TenantRow[]>();
  const allRows = tenants ?? [];
  const activeRows = allRows.filter((tenant) => activeLease(tenant, selectedMonth));
  const unassignedRows = allRows.filter((tenant) => !activeLease(tenant, selectedMonth));
  const expiringRows = allRows.filter((tenant) => leaseExpiresSoon(tenant, selectedMonth));
  const overdueRows = allRows.filter((tenant) => hasOverdueRent(tenant, selectedMonth));
  const overdueMonth = earliestOverdueMonth(allRows, selectedMonth);
  const rows =
    selectedView === 'all'
      ? allRows
      : selectedView === 'unassigned'
        ? unassignedRows
        : selectedView === 'expiring'
          ? expiringRows
          : selectedView === 'overdue'
            ? overdueRows
            : activeRows;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        {showCreate ? (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] px-5 text-sm font-semibold text-[#171d1c]" href="/tenants">
            Retour
          </Link>
        ) : (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href="/tenants?new=1" style={{color: '#ffffff'}}>
            + Ajouter un locataire
          </Link>
        )}
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Impossible de charger les locataires. Verifiez que les migrations Supabase sont bien appliquees.
        </div>
      ) : null}

      {params.error === 'plan_limit' ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Le plan gratuit inclut 3 locataires. Passez a Solo depuis les parametres pour continuer.
        </div>
      ) : null}

      {showCreate ? (
        <CreateTenantView locale={locale} />
      ) : (
        <>
          <section className="mt-8 grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard
                active={selectedView === 'unassigned'}
                href={viewHref('unassigned', selectedMonth, queryText)}
                label="Non assignes"
                note="A rattacher a un bien"
                tone="neutral"
                value={unassignedRows.length.toString()}
              />
              <SummaryCard
                active={selectedView === 'expiring'}
                href={viewHref('expiring', selectedMonth, queryText)}
                label="Baux < 3 mois"
                note="A renouveler bientot"
                tone="warning"
                value={expiringRows.length.toString()}
              />
              <SummaryCard
                active={selectedView === 'overdue'}
                href={viewHref('overdue', overdueMonth, queryText)}
                label="Retards"
                note="Paiements a suivre"
                tone="danger"
                value={overdueRows.length.toString()}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryCard active={selectedView === 'all'} href={viewHref('all', selectedMonth, queryText)} label="Tous les locataires" note="Passes, futurs et non assignes" value={allRows.length.toString()} />
              <SummaryCard active={selectedView === 'active'} href={viewHref('active', selectedMonth, queryText)} label="Baux actifs" note="Assignes et en periode" value={activeRows.length.toString()} />
            </div>
          </section>

          <section className="mt-6 overflow-visible rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--line-soft)] p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Link
                  aria-label="Mois precedent"
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-[#33413f] hover:bg-[#f0f5f2]"
                  href={monthHref(previousMonth, queryText, selectedView)}
                >
                  <ChevronLeftIcon />
                </Link>
                <div className="min-w-32 text-center text-sm font-semibold text-[#171d1c]">{formatMonthLabel(selectedMonth, locale)}</div>
                <Link
                  aria-label="Mois suivant"
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-[#33413f] hover:bg-[#f0f5f2]"
                  href={monthHref(nextMonth, queryText, selectedView)}
                >
                  <ChevronRightIcon />
                </Link>
              </div>
              <form className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                <input name="month" type="hidden" value={selectedMonth} />
                <input name="view" type="hidden" value={selectedView} />
                <input
                  className="focus-ring min-h-11 w-full rounded-lg border border-[var(--line)] bg-[#f0f5f2] px-3 text-sm md:w-72"
                  defaultValue={queryText}
                  name="q"
                  placeholder="Rechercher un locataire..."
                />
                <button className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[#171d1c]" type="submit">
                  Filtrer
                </button>
              </form>
            </div>

            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full min-w-[920px] border-collapse text-left">
                <thead className="border-b border-[var(--line-soft)] bg-[#eaefed] text-[11px] font-semibold uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-4">Nom & prenom</th>
                    <th className="px-5 py-4">Bien occupe</th>
                    <th className="px-5 py-4">Date entree</th>
                    <th className="px-5 py-4">Fin du contrat</th>
                    <th className="px-5 py-4">Statut</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-soft)]">
                  {rows.length ? (
                    rows.map((tenant) => {
                      const lease = displayLease(tenant, selectedMonth);
                      const status = paymentStatus(lease, selectedMonth);

                      return (
                        <tr className="transition hover:bg-[#f0f5f2]" key={tenant.id}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dde1ff] text-sm font-bold uppercase text-[#3755c3]">{initials(tenant.full_name)}</div>
                              <div>
                                <Link className="font-semibold hover:text-[var(--accent)]" href={`/tenants/${tenant.id}`}>
                                  {tenant.full_name}
                                </Link>
                                <p className="mt-1 text-sm text-[var(--muted)]">{tenant.email ?? tenant.phone ?? 'Contact a completer'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            <p>{lease?.properties?.name ?? '-'}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{lease?.units?.name ?? ''}</p>
                          </td>
                          <td className="px-5 py-4 text-sm tabular-nums">{lease?.start_date ?? '-'}</td>
                          <td className="px-5 py-4 text-sm tabular-nums">{lease?.end_date ?? '-'}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <TenantActionDetails>
                                <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/tenants/${tenant.id}`}>
                                  Voir
                                </Link>
                                <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/tenants/${tenant.id}/edit`}>
                                  Modifier
                                </Link>
                                {lease ? (
                                  <details className="group rounded-md">
                                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 hover:bg-[#f0f5f2]">
                                      Changer statut
                                      <span className="text-xs text-[var(--muted)]">&gt;</span>
                                    </summary>
                                    <div className="mt-1 grid gap-1 border-t border-[var(--line-soft)] pt-1">
                                      <form action={updateRentStatusAction}>
                                        <input name="locale" type="hidden" value={locale} />
                                        <input name="lease_id" type="hidden" value={lease.id} />
                                        <input name="period_month" type="hidden" value={monthStart(selectedMonth)} />
                                        <input name="status" type="hidden" value="paid" />
                                        <button className="block w-full rounded-md px-3 py-2 text-left text-[#047857] hover:bg-[#ecfdf5]" type="submit">
                                          Paye
                                        </button>
                                      </form>
                                      <form action={updateRentStatusAction} className="rounded-md px-3 py-2 hover:bg-[#fff7ed]">
                                        <input name="locale" type="hidden" value={locale} />
                                        <input name="lease_id" type="hidden" value={lease.id} />
                                        <input name="period_month" type="hidden" value={monthStart(selectedMonth)} />
                                        <input name="status" type="hidden" value="partial" />
                                        <label className="grid gap-1 text-xs font-semibold text-[#7a4a11]">
                                          Paye partiel
                                          <input className="focus-ring min-h-9 w-full rounded-md border border-[var(--line)] px-2 text-sm font-normal text-[#171d1c]" min="0" name="paid_amount" placeholder="Montant" step="0.01" type="number" />
                                        </label>
                                        <button className="mt-2 text-xs font-semibold text-[#b45309]" type="submit">
                                          Valider
                                        </button>
                                      </form>
                                      <form action={updateRentStatusAction}>
                                        <input name="locale" type="hidden" value={locale} />
                                        <input name="lease_id" type="hidden" value={lease.id} />
                                        <input name="period_month" type="hidden" value={monthStart(selectedMonth)} />
                                        <input name="status" type="hidden" value="unpaid" />
                                        <button className="block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]" type="submit">
                                          Non paye
                                        </button>
                                      </form>
                                    </div>
                                  </details>
                                ) : null}
                                <form action={deleteTenantAction}>
                                  <input name="locale" type="hidden" value={locale} />
                                  <input name="tenant_id" type="hidden" value={tenant.id} />
                                  <DeleteTenantButton />
                                </form>
                            </TenantActionDetails>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-5 py-10 text-center text-sm text-[var(--muted)]" colSpan={6}>
                        Aucun locataire pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--line-soft)] px-5 py-4 text-sm text-[var(--muted)]">
              Affichage {rows.length ? `1-${rows.length}` : '0'} sur {rows.length} locataire(s)
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

function SummaryCard({
  active = false,
  href,
  label,
  note,
  tone = 'neutral',
  value
}: {
  active?: boolean;
  href: string;
  label: string;
  note: string;
  tone?: 'danger' | 'neutral' | 'warning';
  value: string;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-[#fecaca] text-[#ba1a1a]'
      : tone === 'warning'
        ? 'border-[#fed7aa] text-[#b45309]'
        : 'border-[var(--line-soft)] text-[var(--muted)]';

  return (
    <Link className={['focus-ring rounded-lg border bg-white p-5 shadow-sm transition hover:bg-[#f8fbfa]', toneClass, active ? 'ring-2 ring-[var(--accent)]' : ''].join(' ')} href={href}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{note}</p>
    </Link>
  );
}

function CreateTenantView({locale}: {locale: string}) {
  return (
    <form action={createTenantAction} className="mt-8 grid gap-5">
      <input name="locale" type="hidden" value={locale} />
      <SectionCard title="1. Identite du locataire">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Nom complet
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="full_name" placeholder="Marie Dupont" required />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Email
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="email" placeholder="marie@example.com" type="email" />
          </label>
        </div>
      </SectionCard>
      <SectionCard title="2. Coordonnees">
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          Telephone
          <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="phone" placeholder="+33 ..." />
        </label>
      </SectionCard>
      <SectionCard title="3. Notes internes">
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          Notes
          <textarea className="focus-ring min-h-28 rounded-md border border-[var(--line)] px-3 py-3 text-sm font-normal" name="notes" placeholder="Informations utiles" />
        </label>
      </SectionCard>
      <div className="flex justify-end gap-3">
        <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold" href="/tenants">
          Annuler
        </Link>
        <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
          Ajouter
        </button>
      </div>
    </form>
  );
}

function SectionCard({children, title}: {children: React.ReactNode; title: string}) {
  return (
    <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-base font-semibold">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
