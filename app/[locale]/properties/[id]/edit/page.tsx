import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {updatePropertyAction} from '../../actions';
import {LeaseTerminationManager, OccupancyManager} from './occupancy-manager';

type EditPropertyPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type EditableProperty = {
  id: string;
  name: string;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  property_type: string;
  rental_mode: string;
  surface_area: number | null;
  monthly_rent_estimate: number | null;
  charges_estimate: number | null;
  deposit_estimate: number | null;
  occupancy_status: string;
  leases: {
    id: string;
    end_date: string | null;
    start_date: string;
    status: string;
    tenants: {
      full_name: string;
    } | null;
  }[];
};

type TenantOption = {
  id: string;
  full_name: string;
};

export default async function EditPropertyPage({params}: EditPropertyPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: property, error} = await supabase
    .from('properties')
    .select('id, name, address_line1, postal_code, city, property_type, rental_mode, surface_area, monthly_rent_estimate, charges_estimate, deposit_estimate, occupancy_status, leases(id, status, start_date, end_date, tenants(full_name))')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<EditableProperty>();

  if (error || !property) {
    notFound();
  }

  const {data: tenants} = await supabase
    .from('tenants')
    .select('id, full_name')
    .eq('workspace_id', workspaceId)
    .order('full_name', {ascending: true})
    .returns<TenantOption[]>();
  const activeLeases = property.leases.filter((lease) => lease.status === 'active');

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[var(--accent)]" href={`/properties/${property.id}`}>
            Retour au bien
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">Modifier le bien</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{property.name}</p>
        </div>
      </div>

      <form action={updatePropertyAction} className="mt-8 grid gap-5">
        <input name="locale" type="hidden" value={locale} />
        <input name="property_id" type="hidden" value={property.id} />

        <SectionCard icon="pin" title="1. Informations Generales">
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Nom du bien
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={property.name} name="name" required />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Adresse complete
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={property.address_line1 ?? ''} name="address_line1" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              Code postal
              <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={property.postal_code ?? ''} name="postal_code" />
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              Ville
              <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={property.city ?? ''} name="city" />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              Type de bien
              <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={property.property_type} name="property_type">
                <option value="studio">Studio</option>
                <option value="t1">T1</option>
                <option value="t2">T2</option>
                <option value="t3">T3</option>
                <option value="room">Chambre</option>
                <option value="house">Maison</option>
                <option value="apartment">Appartement</option>
                <option value="other">Autre</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              Mode de location
              <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={property.rental_mode} name="rental_mode">
                <option value="shared_rooms">colocation</option>
                <option value="entire_place">entier</option>
                <option value="mixed">mixte</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              Surface habitable (m2)
              <input
                className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal"
                defaultValue={property.surface_area ?? ''}
                min="0"
                name="surface_area"
                step="0.01"
                type="number"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard icon="money" title="2. Aspects Financiers">
          <div className="grid gap-4 md:grid-cols-3">
            <MoneyInput defaultValue={property.monthly_rent_estimate} label="Loyer mensuel HC" name="monthly_rent_estimate" />
            <MoneyInput defaultValue={property.charges_estimate} label="Charges provisionnelles" name="charges_estimate" />
            <MoneyInput defaultValue={property.deposit_estimate} label="Depot de garantie" name="deposit_estimate" />
          </div>
        </SectionCard>

        <SectionCard icon="key" title="3. Etat d'occupation">
          <OccupancyManager initialStatus={activeLeases.length ? 'rented' : property.occupancy_status} tenants={tenants ?? []} />
        </SectionCard>

        <SectionCard icon="camera" title="4. Photos & Documents">
          <p className="text-sm leading-6 text-[var(--muted)]">La gestion des photos existantes sera ajoutee dans une etape separee. Les photos envoyees a la creation restent visibles sur la page de consultation.</p>
        </SectionCard>

        <div className="flex justify-end gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold" href={`/properties/${property.id}`}>
            Annuler
          </Link>
          <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
            Enregistrer
          </button>
        </div>
      </form>
      <section className="mt-5 rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
        <h2 className="mb-5 flex items-center gap-3 text-base font-semibold">
          <SmallIcon name="key" />
          Gestion des contrats existants
        </h2>
        <LeaseTerminationManager leases={activeLeases} locale={locale} propertyId={property.id} />
        {!activeLeases.length ? <p className="text-sm text-[var(--muted)]">Aucun contrat actif pour ce bien.</p> : null}
      </section>
    </AppShell>
  );
}

function SectionCard({children, icon, title}: {children: React.ReactNode; icon: string; title: string}) {
  return (
    <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <h2 className="mb-5 flex items-center gap-3 text-base font-semibold">
        <SmallIcon name={icon} />
        {title}
      </h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function MoneyInput({defaultValue, label, name}: {defaultValue: number | null; label: string; name: string}) {
  return (
    <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
      {label}
      <span className="flex min-h-11 items-center rounded-md border border-[var(--line)] bg-white px-3">
        <input className="min-w-0 flex-1 border-0 bg-transparent text-sm font-normal outline-none" defaultValue={defaultValue ?? ''} min="0" name={name} step="0.01" type="number" />
        <span className="text-sm font-semibold">EUR</span>
      </span>
    </label>
  );
}

function SmallIcon({name}: {name: string}) {
  const path =
    name === 'money'
      ? 'M4 7h16v10H4z M7 10h2 M15 14h2 M12 12a2 2 0 1 0 0 .01'
      : name === 'key'
        ? 'M7 14a4 4 0 1 1 3.5-2.1H21v3h-3v2h-3v-2h-4.5A4 4 0 0 1 7 14z'
        : name === 'camera'
          ? 'M5 7h3l1.5-2h5L16 7h3v12H5z M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
          : 'M12 21s7-5.1 7-11a7 7 0 0 0-14 0c0 5.9 7 11 7 11z M12 10h.01';

  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--accent)]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}
