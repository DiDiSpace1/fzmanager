import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getPlanLimits, getPropertyPhotoLimit} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {PropertyPhotoGallery} from '../property-photo-gallery';

type PropertyDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PropertyDetail = {
  address_line1: string | null;
  charges_estimate: number | null;
  city: string | null;
  deposit_estimate: number | null;
  id: string;
  monthly_rent_estimate: number | null;
  name: string;
  occupancy_status: string;
  postal_code: string | null;
  property_photos: {
    file_name: string;
    file_path: string;
    id: string;
    is_cover: boolean;
  }[];
  property_type: string;
  rental_mode: string;
  surface_area: number | null;
  tax_regime: string;
  leases: {
    charges_amount: number;
    deposit_amount: number;
    end_date: string | null;
    id: string;
    monthly_rent: number;
    start_date: string;
    status: string;
    tenants: {
      full_name: string;
    } | null;
  }[];
};

const modeLabels: Record<string, string> = {
  entire_place: 'entier',
  mixed: 'mixte',
  shared_rooms: 'colocation'
};

const propertyTypeLabels: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  other: 'Autre',
  room: 'Chambre',
  studio: 'Studio',
  t1: 'T1',
  t2: 'T2',
  t3: 'T3',
  t4: 'T4'
};

function money(value: number | null | undefined) {
  return value || value === 0 ? `${Number(value).toLocaleString('fr-FR')} EUR` : '-';
}

export default async function PropertyDetailPage({params}: PropertyDetailPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data, error} = await supabase
    .from('properties')
    .select(
      'id, name, address_line1, postal_code, city, property_type, rental_mode, surface_area, monthly_rent_estimate, charges_estimate, deposit_estimate, occupancy_status, tax_regime, property_photos(id, file_name, file_path, is_cover), leases(id, status, start_date, end_date, monthly_rent, charges_amount, deposit_amount, tenants(full_name))'
    )
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<PropertyDetail>();

  if (error || !data) {
    notFound();
  }

  const property = data;
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const photoLimit = getPropertyPhotoLimit(billing?.plan);
  const planLimits = getPlanLimits(billing?.plan);
  const address = [property.address_line1, property.postal_code, property.city].filter(Boolean).join(', ');
  const activeLeases = property.leases.filter((lease) => lease.status === 'active');
  const firstActiveLease = activeLeases[0];
  const statusLabel = activeLeases.length || property.occupancy_status === 'rented' ? 'Loue' : 'Vacant';
  const signedPhotos = await Promise.all(
    property.property_photos.map(async (photo) => {
      const {data: signed} = await supabase.storage.from('property-photos').createSignedUrl(photo.file_path, 60 * 5);

      return {
        fileName: photo.file_name,
        filePath: photo.file_path,
        id: photo.id,
        isCover: photo.is_cover,
        signedUrl: signed?.signedUrl ?? null
      };
    })
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link className="inline-flex items-center text-sm font-semibold text-[var(--accent)]" href="/properties">
            Retour aux biens
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">{property.name}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{address || 'Adresse a completer'}</p>
        </div>
        <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white cursor-pointer" href={`/properties/${property.id}/edit`} style={{color: '#ffffff'}}>
          Modifier
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Mode" value={modeLabels[property.rental_mode] ?? property.rental_mode} />
        <InfoCard label="Type" value={propertyTypeLabels[property.property_type] ?? property.property_type} />
        <InfoCard label="Surface" value={property.surface_area ? `${Number(property.surface_area).toLocaleString('fr-FR')} m2` : '-'} />
        <InfoCard label="Statut" value={statusLabel} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-6">
          <SectionCard title="Informations generales">
            <div className="grid gap-5 md:grid-cols-2">
              <DataRow label="Adresse" value={property.address_line1 ?? '-'} />
              <DataRow label="Ville" value={[property.postal_code, property.city].filter(Boolean).join(' ') || '-'} />
              <DataRow label="Regime fiscal" value={property.tax_regime} />
              <DataRow label="Occupation" value={statusLabel} />
            </div>
          </SectionCard>

          <SectionCard title="Aspects financiers">
            <div className="grid gap-5 md:grid-cols-3">
              <DataRow label="Loyer mensuel HC" value={money(firstActiveLease?.monthly_rent ?? property.monthly_rent_estimate)} valueClassName="text-[var(--accent)]" />
              <DataRow label="Charges" value={money(firstActiveLease?.charges_amount ?? property.charges_estimate)} />
              <DataRow label="Depot de garantie" value={money(firstActiveLease?.deposit_amount ?? property.deposit_estimate)} />
            </div>
          </SectionCard>

          <section className="overflow-hidden rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--line-soft)] bg-[#f0f5f2] px-5 py-4">
              <h2 className="text-base font-semibold">Baux</h2>
              <Link className="text-sm font-semibold text-[var(--accent)]" href={`/properties/${property.id}/tenants`}>
                Nouveau bail
              </Link>
            </div>
            {property.leases.length ? (
              <div className="divide-y divide-[var(--line-soft)]">
                {property.leases.map((lease) => (
                  <div className="grid gap-3 p-5 transition hover:bg-[#f0f5f2] md:grid-cols-[1fr_auto]" key={lease.id}>
                    <div>
                      <p className="font-semibold">{lease.tenants?.full_name ?? 'Locataire'}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{[lease.start_date, lease.end_date].filter(Boolean).join(' - ')}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-base font-semibold tabular-nums">{money(lease.monthly_rent)}</p>
                      <span className={lease.status === 'active' ? 'rounded bg-[#ecfdf5] px-2 py-1 text-xs font-semibold text-[#047857]' : 'rounded bg-[#eef2ff] px-2 py-1 text-xs font-semibold text-[#3755c3]'}>
                        {lease.status === 'active' ? 'Actif' : lease.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-sm text-[var(--muted)]">Aucun bail enregistre.</div>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <PropertyPhotoGallery
            existingCount={property.property_photos.length}
            locale={locale}
            maxPhotoSizeBytes={planLimits.maxDocumentSizeBytes}
            photoLimit={photoLimit}
            photos={signedPhotos}
            propertyId={property.id}
            workspaceId={workspaceId}
          />

          <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Actions rapides</h2>
            <div className="mt-3 grid gap-2">
              <Link className="rounded-md px-3 py-3 text-sm font-medium hover:bg-[#f0f5f2]" href="/tax">
                Bordereau fiscal
              </Link>
              <Link className="rounded-md px-3 py-3 text-sm font-medium hover:bg-[#f0f5f2]" href={`/bail?property_id=${property.id}`}>
                Gerer les baux
              </Link>
            </div>
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

function SectionCard({children, title}: {children: React.ReactNode; title: string}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
      <div className="border-b border-[var(--line-soft)] bg-[#f0f5f2] px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DataRow({label, value, valueClassName = ''}: {label: string; value: string; valueClassName?: string}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</dt>
      <dd className={['mt-1 text-sm font-semibold tabular-nums', valueClassName].join(' ')}>{value}</dd>
    </div>
  );
}
