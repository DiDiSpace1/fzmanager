import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {assignPropertyTenantsAction} from '../properties/actions';
import {LeaseTerminationManager, OccupancyManager} from '../properties/[id]/edit/occupancy-manager';
import {ExistingLeaseEditor} from './existing-lease-editor';
import {PropertySelector} from './property-selector';

type BailManagerViewProps = {
  selectedPropertyId?: string;
  selectedTenantId?: string;
  source?: 'bail' | 'property';
};

type PropertyOption = {
  id: string;
  name: string;
};

type PropertyForTenantManagement = {
  id: string;
  name: string;
  occupancy_status: string;
  leases: {
    charges_amount: number | null;
    deposit_amount: number | null;
    id: string;
    monthly_rent: number | null;
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

export async function BailManagerView({selectedPropertyId, selectedTenantId = '', source = 'bail'}: BailManagerViewProps) {
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: properties} = await supabase.from('properties').select('id, name').eq('workspace_id', workspaceId).order('created_at', {ascending: false}).returns<PropertyOption[]>();
  const propertyOptions = properties ?? [];
  const propertyId = selectedPropertyId || undefined;
  let selectedProperty: PropertyForTenantManagement | null = null;

  if (propertyId) {
    const {data: property, error} = await supabase
      .from('properties')
      .select('id, name, occupancy_status, leases(id, status, start_date, end_date, monthly_rent, charges_amount, deposit_amount, tenants(full_name))')
      .eq('workspace_id', workspaceId)
      .eq('id', propertyId)
      .single<PropertyForTenantManagement>();

    if (error || !property) {
      notFound();
    }

    selectedProperty = property;
  }

  const {data: tenants} = await supabase.from('tenants').select('id, full_name').eq('workspace_id', workspaceId).order('full_name', {ascending: true}).returns<TenantOption[]>();
  const activeLeases = selectedProperty?.leases.filter((lease) => lease.status === 'active') ?? [];
  const backHref = source === 'property' ? '/properties' : '/dashboard';
  const backLabel = source === 'property' ? 'Retour aux biens' : 'Retour au tableau de bord';

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[var(--accent)]" href={backHref}>
            {backLabel}
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">Bail</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{selectedProperty?.name ?? 'Selectionnez un bien pour gerer les locataires.'}</p>
        </div>
        {selectedProperty ? (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] px-5 text-sm font-semibold text-[#171d1c]" href={`/properties/${selectedProperty.id}`}>
            Voir le bien
          </Link>
        ) : null}
      </div>

      <form action={assignPropertyTenantsAction} className="mt-8 grid gap-5">
        <input name="locale" type="hidden" value={locale} />
        <input name="property_id" type="hidden" value={selectedProperty?.id ?? ''} />
        <input name="return_to" type="hidden" value={source === 'bail' ? 'bail' : 'tenant_management'} />
        <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
          <div className="mb-5">
            <PropertySelector locale={locale} properties={propertyOptions} selectedPropertyId={selectedProperty?.id} selectedTenantId={selectedTenantId} />
          </div>
          {selectedProperty ? (
            <>
              <ExistingLeaseEditor leases={activeLeases} locale={locale} propertyId={selectedProperty.id} />
              <h2 className="mb-5 text-base font-semibold">Ajouter des locataires</h2>
              <OccupancyManager initialStatus={activeLeases.length ? 'rented' : selectedProperty.occupancy_status} initialTenantId={selectedTenantId} tenants={tenants ?? []} />
            </>
          ) : (
            <p className="text-sm leading-6 text-[var(--muted)]">Choisissez un bien pour ajouter un locataire et creer un bail.</p>
          )}
        </section>
        {selectedProperty ? (
          <div className="flex justify-end gap-3">
            <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold" href={source === 'property' ? `/properties/${selectedProperty.id}` : '/bail'}>
              Annuler
            </Link>
            <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
              Enregistrer
            </button>
          </div>
        ) : null}
      </form>

      {selectedProperty ? (
        <section className="mt-5 rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
          <h2 className="mb-5 text-base font-semibold">Contrats existants</h2>
          <LeaseTerminationManager leases={activeLeases} locale={locale} propertyId={selectedProperty.id} returnTo={source === 'bail' ? 'bail' : 'tenant_management'} />
          {!activeLeases.length ? <p className="text-sm text-[var(--muted)]">Aucun contrat actif pour ce bien.</p> : null}
        </section>
      ) : null}
    </AppShell>
  );
}
