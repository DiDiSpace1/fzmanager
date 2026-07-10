'use client';

import Link from 'next/link';
import {useMemo, useState} from 'react';

import {deleteTenantAction, updateRentStatusAction, updateTenantActiveAction} from './actions';
import {DeleteTenantButton} from './delete-tenant-button';
import {TenantActionDetails} from './tenant-action-details';

export type TenantTableRow = {
  id: string;
  email: string | null;
  full_name: string;
  is_active: boolean;
  leases: {
    charges_amount: number;
    end_date: string | null;
    id: string;
    monthly_rent: number;
    properties: {name: string} | null;
    rent_charges: {period_month: string; status: string}[];
    start_date: string;
    status: string;
    units: {name: string} | null;
  }[];
  notes: string | null;
  phone: string | null;
};

const MONTH_PARAM_PATTERN = /^\d{4}-\d{2}$/;

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

function addMonths(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  return isoMonth(new Date(Date.UTC(year, monthIndex - 1 + offset, 1)));
}

function formatMonthLabel(month: string, locale: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const formatted = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'}).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function leaseCoversMonth(lease: TenantTableRow['leases'][number], month: string) {
  const start = monthStart(month);
  const nextMonth = monthStart(addMonths(month, 1));
  return lease.start_date < nextMonth && (!lease.end_date || lease.end_date >= start);
}

function displayLease(tenant: TenantTableRow, month: string) {
  const leasesInMonth = tenant.leases.filter((lease) => leaseCoversMonth(lease, month));
  return leasesInMonth.find((lease) => lease.status === 'active') ?? leasesInMonth[0] ?? null;
}

function activeLease(tenant: TenantTableRow, month: string) {
  return tenant.leases.find((lease) => lease.status === 'active' && leaseCoversMonth(lease, month)) ?? null;
}

function paymentStatus(lease: TenantTableRow['leases'][number] | null, month: string) {
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

function hasOverdueRent(tenant: TenantTableRow, month: string) {
  const currentPeriod = monthStart(month);

  return tenant.leases.some((lease) => lease.rent_charges.some((rentCharge) => rentCharge.period_month <= currentPeriod && ['partial', 'unpaid'].includes(rentCharge.status)));
}

function leaseExpiresSoon(tenant: TenantTableRow, month: string) {
  const lease = activeLease(tenant, month);

  if (!lease?.end_date) {
    return false;
  }

  const start = monthStart(month);
  const limit = monthStart(addMonths(month, 3));
  return lease.end_date >= start && lease.end_date < limit;
}

function tenantMatches(tenant: TenantTableRow, query: string) {
  if (!query) {
    return true;
  }

  const searchable = [tenant.full_name, tenant.email, tenant.phone].filter(Boolean).join(' ').toLowerCase();
  return searchable.includes(query.toLowerCase());
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

function sanitizeMonth(month: string) {
  return MONTH_PARAM_PATTERN.test(month) ? month : isoMonth(new Date());
}

export function TenantTableClient({
  initialMonth,
  initialQuery,
  initialView,
  locale,
  tenants
}: {
  initialMonth: string;
  initialQuery: string;
  initialView: string;
  locale: string;
  tenants: TenantTableRow[];
}) {
  const [selectedMonth, setSelectedMonth] = useState(sanitizeMonth(initialMonth));
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const selectedView = initialView;

  const rows = useMemo(() => {
    const activeTenantRows = tenants.filter((tenant) => tenant.is_active);
    const activeRows = activeTenantRows.filter((tenant) => activeLease(tenant, selectedMonth));
    const unassignedRows = activeTenantRows.filter((tenant) => !activeLease(tenant, selectedMonth));
    const expiringRows = activeTenantRows.filter((tenant) => leaseExpiresSoon(tenant, selectedMonth));
    const overdueRows = activeTenantRows.filter((tenant) => hasOverdueRent(tenant, selectedMonth));
    const viewRows =
      selectedView === 'all'
        ? tenants
        : selectedView === 'unassigned'
          ? unassignedRows
          : selectedView === 'expiring'
            ? expiringRows
            : selectedView === 'overdue'
              ? overdueRows
              : activeRows;

    return viewRows.filter((tenant) => tenantMatches(tenant, appliedQuery));
  }, [appliedQuery, selectedMonth, selectedView, tenants]);

  function syncUrl(nextMonth = selectedMonth, nextQuery = appliedQuery) {
    const params = new URLSearchParams({month: nextMonth, view: selectedView});

    if (nextQuery) {
      params.set('q', nextQuery);
    }

    window.history.replaceState(null, '', `/${locale}/tenants?${params.toString()}`);
  }

  function changeMonth(nextMonth: string) {
    setSelectedMonth(nextMonth);
    syncUrl(nextMonth, appliedQuery);
  }

  function applySearch() {
    const nextQuery = queryInput.trim();
    setAppliedQuery(nextQuery);
    syncUrl(selectedMonth, nextQuery);
  }

  function clearSearch() {
    setQueryInput('');
    setAppliedQuery('');
    syncUrl(selectedMonth, '');
  }

  return (
    <section className="mt-6 overflow-visible rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--line-soft)] p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button aria-label="Mois precedent" className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-[#33413f] hover:bg-[#f0f5f2]" onClick={() => changeMonth(addMonths(selectedMonth, -1))} type="button">
            <ChevronLeftIcon />
          </button>
          <div className="min-w-32 text-center text-sm font-semibold text-[#171d1c]">{formatMonthLabel(selectedMonth, locale)}</div>
          <button aria-label="Mois suivant" className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-[#33413f] hover:bg-[#f0f5f2]" onClick={() => changeMonth(addMonths(selectedMonth, 1))} type="button">
            <ChevronRightIcon />
          </button>
        </div>
        <form
          className="relative w-full md:w-72"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <input className="focus-ring min-h-11 w-full rounded-full border border-transparent bg-[#eef2f7] px-4 pr-11 text-sm" onChange={(event) => setQueryInput(event.target.value)} placeholder="Rechercher un locataire..." value={queryInput} />
          {queryInput ? (
            <button aria-label="Effacer la recherche" className="focus-ring absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#33413f] hover:bg-[#dce3eb]" onClick={clearSearch} type="button">
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          ) : null}
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
                const status = tenant.is_active ? paymentStatus(lease, selectedMonth) : {className: 'bg-[#e5e7eb] text-[#4b5563]', label: 'Desactive'};

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
                        <form action={updateTenantActiveAction}>
                          <input name="locale" type="hidden" value={locale} />
                          <input name="tenant_id" type="hidden" value={tenant.id} />
                          <input name="is_active" type="hidden" value={tenant.is_active ? 'false' : 'true'} />
                          <input name="month" type="hidden" value={selectedMonth} />
                          <input name="view" type="hidden" value={selectedView} />
                          <input name="q" type="hidden" value={appliedQuery} />
                          <button className="block w-full rounded-md px-3 py-2 text-left hover:bg-[#f0f5f2]" type="submit">
                            {tenant.is_active ? 'Desactiver' : 'Activer'}
                          </button>
                        </form>
                        {tenant.is_active && lease ? (
                          <details className="group rounded-md">
                            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 hover:bg-[#f0f5f2]">
                              Changer statut
                              <span className="text-xs text-[var(--muted)]">&gt;</span>
                            </summary>
                            <div className="mt-1 grid gap-1 border-t border-[var(--line-soft)] pt-1">
                              <RentStatusForm leaseId={lease.id} locale={locale} month={selectedMonth} query={appliedQuery} status="paid" view={selectedView} />
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
                              <RentStatusForm leaseId={lease.id} locale={locale} month={selectedMonth} query={appliedQuery} status="unpaid" view={selectedView} />
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
  );
}

function RentStatusForm({leaseId, locale, month, query, status, view}: {leaseId: string; locale: string; month: string; query: string; status: 'paid' | 'unpaid'; view: string}) {
  return (
    <form action={updateRentStatusAction}>
      <input name="locale" type="hidden" value={locale} />
      <input name="lease_id" type="hidden" value={leaseId} />
      <input name="period_month" type="hidden" value={monthStart(month)} />
      <input name="status" type="hidden" value={status} />
      <input name="view" type="hidden" value={view} />
      <input name="q" type="hidden" value={query} />
      <button className={status === 'paid' ? 'block w-full rounded-md px-3 py-2 text-left text-[#047857] hover:bg-[#ecfdf5]' : 'block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]'} type="submit">
        {status === 'paid' ? 'Paye' : 'Non paye'}
      </button>
    </form>
  );
}
