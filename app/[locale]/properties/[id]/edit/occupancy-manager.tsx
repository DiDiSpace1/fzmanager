'use client';

import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';

import {DateDisplayInput, isoDateToDisplay} from '@/components/forms/date-display-input';

import {terminateLeaseAction} from '../../actions';

type TenantOption = {
  id: string;
  full_name: string;
};

type ActiveLease = {
  id: string;
  end_date: string | null;
  start_date: string;
  tenants: {
    full_name: string;
  } | null;
};

export function OccupancyManager({
  initialStatus,
  initialTenantId = '',
  tenants
}: {
  initialStatus: string;
  initialTenantId?: string;
  tenants: TenantOption[];
}) {
  const managerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState(initialStatus === 'rented' ? 'rented' : 'vacant');
  const [assignmentRows, setAssignmentRows] = useState([{id: crypto.randomUUID()}]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const form = managerRef.current?.closest('form');
    if (!form) {
      return undefined;
    }

    const validateAssignments = (event: SubmitEvent) => {
      if (status !== 'rented') {
        setInvalidFields(new Set());
        return;
      }

      const formData = new FormData(form);
      const tenantIds = formData.getAll('assignment_tenant_id').map((entry) => (typeof entry === 'string' ? entry.trim() : ''));
      const startDates = formData.getAll('assignment_start_date').map((entry) => (typeof entry === 'string' ? entry.trim() : ''));
      const monthlyRents = formData.getAll('assignment_monthly_rent').map((entry) => (typeof entry === 'string' ? Number.parseFloat(entry.replace(',', '.')) : 0));
      const nextInvalidFields = new Set<string>();

      assignmentRows.forEach((_, index) => {
        if (!tenantIds[index]) {
          nextInvalidFields.add(`${index}:tenant`);
        }

        if (!startDates[index]) {
          nextInvalidFields.add(`${index}:start`);
        }

        if (!Number.isFinite(monthlyRents[index]) || monthlyRents[index] <= 0) {
          nextInvalidFields.add(`${index}:rent`);
        }
      });

      if (nextInvalidFields.size) {
        event.preventDefault();
        setInvalidFields(nextInvalidFields);
        const firstInvalidKey = Array.from(nextInvalidFields)[0];
        form.querySelector<HTMLElement>(`[data-validation-key="${firstInvalidKey}"]`)?.focus();
      } else {
        setInvalidFields(new Set());
      }
    };

    form.addEventListener('submit', validateAssignments);
    return () => form.removeEventListener('submit', validateAssignments);
  }, [assignmentRows, status]);

  return (
    <div className="grid gap-5" ref={managerRef}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex min-h-20 cursor-pointer items-center justify-between rounded-lg border border-[var(--accent)] bg-[#f5faf8] px-4">
          <span>
            <span className="block font-semibold text-[var(--accent)]">Vacant</span>
            <span className="text-sm text-[var(--muted)]">Pret a etre loue</span>
          </span>
          <input className="h-4 w-4 accent-[var(--accent)]" checked={status === 'vacant'} name="occupancy_status" onChange={() => setStatus('vacant')} type="radio" value="vacant" />
        </label>
        <label className="flex min-h-20 cursor-pointer items-center justify-between rounded-lg border border-[var(--line-soft)] px-4">
          <span>
            <span className="block font-semibold">Loue</span>
            <span className="text-sm text-[var(--muted)]">Occupe par un locataire</span>
          </span>
          <input className="h-4 w-4 accent-[var(--accent)]" checked={status === 'rented'} name="occupancy_status" onChange={() => setStatus('rented')} type="radio" value="rented" />
        </label>
      </div>

      {status === 'rented' ? (
        <div className="grid gap-5 rounded-lg border border-[var(--line-soft)] bg-[#fbfdfc] p-4">
          <div>
            <h3 className="text-sm font-semibold">Ajouter des locataires</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Selectionnez un ou plusieurs locataires et renseignez les dates du contrat.</p>
          </div>
          {assignmentRows.map((row, index) => (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(150px,1.2fr)_repeat(2,minmax(112px,0.75fr))_repeat(3,minmax(108px,0.65fr))_auto]" key={row.id}>
              <label className="grid min-w-0 gap-2 text-xs font-semibold text-[#33413f]">
                Locataire
                <select
                  className={`focus-ring min-h-11 min-w-0 rounded-md border px-3 text-sm font-normal ${invalidFields.has(`${index}:tenant`) ? 'border-[#ba1a1a] bg-[#fff7f6]' : 'border-[var(--line)]'}`}
                  data-validation-key={`${index}:tenant`}
                  defaultValue={index === 0 ? initialTenantId : ''}
                  name="assignment_tenant_id"
                  onChange={() => setInvalidFields((fields) => withoutField(fields, `${index}:tenant`))}
                >
                  <option value="">Choisir un locataire</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-xs font-semibold text-[#33413f]">
                Date entree
                <DateDisplayInput
                  className={`focus-ring h-11 min-h-11 w-full rounded-md border px-3 text-sm font-normal ${invalidFields.has(`${index}:start`) ? 'border-[#ba1a1a] bg-[#fff7f6]' : 'border-[var(--line)]'}`}
                  name="assignment_start_date"
                  onIsoChange={() => setInvalidFields((fields) => withoutField(fields, `${index}:start`))}
                  validationKey={`${index}:start`}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-xs font-semibold text-[#33413f]">
                Date sortie
                <DateDisplayInput className="focus-ring h-11 min-h-11 w-full rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="assignment_end_date" />
              </label>
              <MoneyField invalid={invalidFields.has(`${index}:rent`)} label="Montant loyer" name="assignment_monthly_rent" onChange={() => setInvalidFields((fields) => withoutField(fields, `${index}:rent`))} required validationKey={`${index}:rent`} />
              <MoneyField label="Charge" name="assignment_charges_amount" />
              <MoneyField label="Caution" name="assignment_deposit_amount" />
              <button
                className="focus-ring self-end rounded-md border border-[var(--line)] px-3 py-3 text-sm font-semibold disabled:opacity-40"
                disabled={assignmentRows.length === 1}
                onClick={() => setAssignmentRows((rows) => rows.filter((item) => item.id !== row.id))}
                type="button"
              >
                Retirer
              </button>
              {index === assignmentRows.length - 1 ? (
                <button
                  className="focus-ring justify-self-start rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold md:col-span-2 2xl:col-span-7"
                  onClick={() => setAssignmentRows((rows) => [...rows, {id: crypto.randomUUID()}])}
                  type="button"
                >
                  Ajouter un autre locataire
                </button>
              ) : null}
            </div>
          ))}
          {!tenants.length ? (
            <Link className="text-sm font-medium text-[#ba1a1a] underline-offset-2 hover:underline" href="/tenants?new=1">
              Ajoutez un locataire dans la page Locataires avant de continuer.
            </Link>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}

function withoutField(fields: Set<string>, field: string) {
  if (!fields.has(field)) {
    return fields;
  }

  const nextFields = new Set(fields);
  nextFields.delete(field);
  return nextFields;
}

function MoneyField({invalid = false, label, name, onChange, required = false, validationKey}: {invalid?: boolean; label: string; name: string; onChange?: () => void; required?: boolean; validationKey?: string}) {
  return (
    <label className="grid min-w-0 gap-2 text-xs font-semibold text-[#33413f]">
      {label}
      <span className={`relative min-h-11 min-w-0 rounded-md border bg-white ${invalid ? 'border-[#ba1a1a] bg-[#fff7f6]' : 'border-[var(--line)]'}`}>
        <input className="h-11 w-full min-w-0 border-0 bg-transparent px-3 pr-12 text-sm font-normal outline-none" data-validation-key={validationKey} defaultValue="0" min="0" name={name} onChange={onChange} required={required} step="0.01" type="number" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold">EUR</span>
      </span>
    </label>
  );
}

export function LeaseTerminationManager({leases, locale, propertyId, returnTo}: {leases: ActiveLease[]; locale: string; propertyId: string; returnTo?: string}) {
  if (!leases.length) {
    return null;
  }

  return (
    <div className="grid gap-3 rounded-lg border border-[var(--line-soft)] bg-white p-4">
      <h3 className="text-sm font-semibold">Locataires existants</h3>
      {leases.map((lease) => (
        <form
          action={terminateLeaseAction}
          className="grid gap-3 rounded-md border border-[var(--line-soft)] p-3 md:grid-cols-[1fr_170px_auto]"
          key={lease.id}
          onSubmit={(event) => {
            if (!window.confirm('Confirmer la fin du contrat pour ce locataire ?')) {
              event.preventDefault();
            }
          }}
        >
          <input name="locale" type="hidden" value={locale} />
          <input name="property_id" type="hidden" value={propertyId} />
          <input name="lease_id" type="hidden" value={lease.id} />
          {returnTo ? <input name="return_to" type="hidden" value={returnTo} /> : null}
          <div>
            <p className="font-medium">{lease.tenants?.full_name ?? 'Locataire'}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Depuis {isoDateToDisplay(lease.start_date)}</p>
          </div>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Date de fin
            <DateDisplayInput className="focus-ring h-10 min-h-10 w-full rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={lease.end_date ?? ''} name="end_date" required />
          </label>
          <button className="focus-ring self-end rounded-md border border-[#f3b4b4] px-4 py-2 text-sm font-semibold text-[#ba1a1a]" type="submit">
            Terminer le contrat
          </button>
        </form>
      ))}
    </div>
  );
}
