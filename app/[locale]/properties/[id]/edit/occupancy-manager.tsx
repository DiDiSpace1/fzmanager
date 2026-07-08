'use client';

import {useState} from 'react';

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
  tenants
}: {
  initialStatus: string;
  tenants: TenantOption[];
}) {
  const [status, setStatus] = useState(initialStatus === 'rented' ? 'rented' : 'vacant');
  const [assignmentRows, setAssignmentRows] = useState([{id: crypto.randomUUID()}]);

  return (
    <div className="grid gap-5">
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
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto]" key={row.id}>
              <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
                Locataire
                <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="assignment_tenant_id">
                  <option value="">Choisir un locataire</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
                Date entree
                <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="assignment_start_date" type="date" />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
                Date sortie
                <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="assignment_end_date" type="date" />
              </label>
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
                  className="focus-ring md:col-span-4 justify-self-start rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                  onClick={() => setAssignmentRows((rows) => [...rows, {id: crypto.randomUUID()}])}
                  type="button"
                >
                  Ajouter un autre locataire
                </button>
              ) : null}
            </div>
          ))}
          {!tenants.length ? <p className="text-sm text-[#ba1a1a]">Ajoutez un locataire dans la page Locataires avant de continuer.</p> : null}
        </div>
      ) : null}

    </div>
  );
}

export function LeaseTerminationManager({leases, locale, propertyId}: {leases: ActiveLease[]; locale: string; propertyId: string}) {
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
          <div>
            <p className="font-medium">{lease.tenants?.full_name ?? 'Locataire'}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Depuis {lease.start_date}</p>
          </div>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Date de fin
            <input className="focus-ring min-h-10 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={lease.end_date ?? ''} name="end_date" required type="date" />
          </label>
          <button className="focus-ring self-end rounded-md border border-[#f3b4b4] px-4 py-2 text-sm font-semibold text-[#ba1a1a]" type="submit">
            Terminer le contrat
          </button>
        </form>
      ))}
    </div>
  );
}
