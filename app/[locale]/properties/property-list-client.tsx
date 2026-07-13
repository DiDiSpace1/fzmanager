'use client';

import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useMemo, useState} from 'react';

import {PropertyActionsMenu} from './property-actions-menu';

export type PropertyListRow = {
  address_line1: string | null;
  city: string | null;
  id: string;
  leases: {
    monthly_rent: number;
    status: string;
    tenants: {full_name: string} | null;
  }[];
  monthly_rent_estimate: number | null;
  name: string;
  occupancy_status: string;
  photoUrl: string | null;
  postal_code: string | null;
  rental_mode: string;
};

const modeLabelKeys: Record<string, 'entirePlace' | 'mixed' | 'sharedRooms'> = {
  entire_place: 'entirePlace',
  mixed: 'mixed',
  shared_rooms: 'sharedRooms'
};

const modeOptions = [
  {labelKey: 'allModes', value: ''},
  {labelKey: 'sharedRooms', value: 'shared_rooms'},
  {labelKey: 'entirePlace', value: 'entire_place'},
  {labelKey: 'mixed', value: 'mixed'}
];

function formatAddress(property: Pick<PropertyListRow, 'address_line1' | 'postal_code' | 'city'>) {
  return [property.address_line1, property.postal_code, property.city].filter(Boolean).join(', ');
}

function statusFor(property: PropertyListRow) {
  const activeLeases = property.leases.filter((lease) => lease.status === 'active');

  if (activeLeases.length > 0 || property.occupancy_status === 'rented') {
    return {
      className: 'bg-[#ecfdf5] text-[#047857]',
      labelKey: 'rented'
    };
  }

  return {
    className: 'bg-[#eef2ff] text-[#3755c3]',
    labelKey: 'vacant'
  };
}

function propertyMatches(property: PropertyListRow, query: string) {
  if (!query) {
    return true;
  }

  const searchable = [property.name, property.address_line1, property.city, property.postal_code].filter(Boolean).join(' ').toLowerCase();
  return searchable.includes(query.toLowerCase());
}

export function PropertyListClient({
  initialMode,
  initialQuery,
  locale,
  rows
}: {
  initialMode: string;
  initialQuery: string;
  locale: string;
  rows: PropertyListRow[];
}) {
  const common = useTranslations('common');
  const t = useTranslations('properties');
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [selectedMode, setSelectedMode] = useState(initialMode);
  const filteredRows = useMemo(
    () => rows.filter((property) => (!selectedMode || property.rental_mode === selectedMode) && propertyMatches(property, appliedQuery)),
    [appliedQuery, rows, selectedMode]
  );

  function syncUrl(nextQuery = appliedQuery, nextMode = selectedMode) {
    const params = new URLSearchParams();

    if (nextQuery) {
      params.set('q', nextQuery);
    }

    if (nextMode) {
      params.set('mode', nextMode);
    }

    const query = params.toString();
    window.history.replaceState(null, '', `/${locale}/properties${query ? `?${query}` : ''}`);
  }

  function applySearch() {
    const nextQuery = queryInput.trim();
    setAppliedQuery(nextQuery);
    syncUrl(nextQuery, selectedMode);
  }

  function clearSearch() {
    setQueryInput('');
    setAppliedQuery('');
    syncUrl('', selectedMode);
  }

  function changeMode(nextMode: string) {
    setSelectedMode(nextMode);
    syncUrl(appliedQuery, nextMode);
  }

  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[var(--line-soft)] bg-white p-4 md:flex-row">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <input className="focus-ring min-h-11 w-full rounded-full border border-transparent bg-[#eef2f7] px-4 pr-11 text-sm" onChange={(event) => setQueryInput(event.target.value)} placeholder={t('searchPlaceholder')} value={queryInput} />
          {queryInput ? (
            <button aria-label={common('clearSearch')} className="focus-ring absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#33413f] hover:bg-[#dce3eb]" onClick={clearSearch} type="button">
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          ) : null}
        </form>
        <select className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-[#f0f5f2] px-3 text-sm md:w-44" onChange={(event) => changeMode(event.target.value)} value={selectedMode}>
          {modeOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {t(`rentalModes.${option.labelKey}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="border-b border-[var(--line-soft)] bg-[#eaefed] text-[11px] font-semibold uppercase text-[var(--muted)]">
              <tr>
                <th className="px-5 py-4">{t('table.property')}</th>
                <th className="px-5 py-4">{t('table.mode')}</th>
                <th className="px-5 py-4">{t('table.tenant')}</th>
                <th className="px-5 py-4">{t('table.rent')}</th>
                <th className="px-5 py-4">{common('status')}</th>
                <th className="px-5 py-4 text-right">{common('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-soft)]">
              {filteredRows.length ? (
                filteredRows.map((property) => {
                  const activeLease = property.leases.find((lease) => lease.status === 'active');
                  const status = statusFor(property);
                  const displayedRent = activeLease?.monthly_rent ?? property.monthly_rent_estimate;

                  return (
                    <tr className="transition hover:bg-[#f0f5f2]" key={property.id}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {property.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt="" className="h-11 w-11 rounded-md object-cover" src={property.photoUrl} />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#dee4e1] text-xs font-semibold text-[var(--muted)]">HL</div>
                          )}
                          <div>
                            <Link className="font-semibold hover:text-[var(--accent)]" href={`/properties/${property.id}`}>
                              {property.name}
                            </Link>
                            <p className="mt-1 text-sm text-[var(--muted)]">{formatAddress(property) || t('addressMissing')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm">{modeLabelKeys[property.rental_mode] ? t(`rentalModes.${modeLabelKeys[property.rental_mode]}`) : property.rental_mode}</td>
                      <td className="px-5 py-4 text-sm text-[var(--muted)]">{activeLease?.tenants?.full_name ?? '-'}</td>
                      <td className="px-5 py-4 text-sm tabular-nums">{displayedRent ? `${Number(displayedRent).toFixed(0)} EUR` : '-'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${status.className}`}>{t(`status.${status.labelKey}`)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <PropertyActionsMenu locale={locale} propertyId={property.id} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-[var(--muted)]" colSpan={6}>
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--line-soft)] px-5 py-4 text-sm text-[var(--muted)]">
          {t('pagination', {range: filteredRows.length ? `1-${filteredRows.length}` : '0', count: filteredRows.length})}
        </div>
      </div>
    </section>
  );
}
