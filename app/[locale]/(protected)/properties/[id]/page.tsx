import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale, getTranslations} from 'next-intl/server';

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
  entire_place: 'entirePlace',
  mixed: 'mixed',
  shared_rooms: 'sharedRooms'
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
  return value || value === 0 ? `${Number(value).toLocaleString('fr-FR')} €` : '-';
}

function surface(value: number | null | undefined) {
  return value || value === 0 ? `${Number(value).toLocaleString('fr-FR')} m²` : '-';
}

export default async function PropertyDetailPage({params}: PropertyDetailPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const t = await getTranslations('properties.detail');
  const bailT = await getTranslations('bail.status');
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
  const isRented = activeLeases.length || property.occupancy_status === 'rented';
  const statusLabel = isRented ? t('status.rented') : t('status.vacant');
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
    <div className="-mx-5 -my-8 bg-[#f5f9f7] px-4 pb-10 pt-6 font-[Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#17201e] sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#006f61] hover:text-[#00574f]" href="/properties">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              {t('backToProperties')}
            </Link>
            <h1 className="mt-6 text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[#17201e] md:text-[28px]">{property.name}</h1>
            <p className="mt-4 flex min-w-0 items-start gap-2 text-[13px] font-normal leading-[1.45] text-[#66736f] md:text-sm">
              <span className="material-symbols-outlined mt-0.5 shrink-0 text-[20px]">location_on</span>
              <span className="min-w-0 break-words">{address || t('addressMissing')}</span>
            </p>
          </div>
          <Link
            className="focus-ring inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#006f61] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#00574f]"
            href={`/properties/${property.id}/edit`}
            style={{color: '#ffffff'}}
          >
            <span className="material-symbols-outlined text-[20px]">edit</span>
            {t('edit')}
          </Link>
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 min-[1100px]:grid-cols-4">
          <InfoCard icon="group" label={t('overview.mode')} value={t(`rentalModes.${modeLabels[property.rental_mode] ?? 'unknown'}`)} />
          <InfoCard icon="home" label={t('overview.type')} value={propertyTypeLabels[property.property_type] ?? property.property_type} />
          <InfoCard icon="straighten" label={t('overview.surface')} value={surface(property.surface_area)} />
          <InfoCard icon="verified" label={t('overview.status')} value={statusLabel} />
        </section>

        <section className="mt-8 grid gap-6 min-[1100px]:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <div className="grid content-start gap-6">
            <SectionCard icon="assignment" title={t('general.title')}>
              <div className="grid gap-x-16 gap-y-6 md:grid-cols-2">
                <DataRow label={t('general.address')} value={property.address_line1 ?? '-'} />
                <DataRow label={t('general.city')} value={[property.postal_code, property.city].filter(Boolean).join(' ') || '-'} />
                <DataRow label={t('general.taxRegime')} value={property.tax_regime} />
                <DataRow label={t('general.occupation')} value={statusLabel} />
              </div>
            </SectionCard>

            <SectionCard icon="bar_chart" title={t('financial.title')}>
              <div className="grid gap-5 md:grid-cols-3 md:divide-x md:divide-[#dce5e1]">
                <FinancialRow accent label={t('financial.monthlyRent')} value={money(firstActiveLease?.monthly_rent ?? property.monthly_rent_estimate)} />
                <FinancialRow label={t('financial.charges')} value={money(firstActiveLease?.charges_amount ?? property.charges_estimate)} />
                <FinancialRow label={t('financial.deposit')} value={money(firstActiveLease?.deposit_amount ?? property.deposit_estimate)} />
              </div>
            </SectionCard>

            <section className="overflow-hidden rounded-xl border border-[#dce5e1] bg-white p-6 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
              <div className="flex items-center justify-between gap-4">
                <CardTitle icon="description" title={t('leases.title')} />
                <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#006f61] hover:text-[#00574f]" href={`/properties/${property.id}/tenants`}>
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  {t('leases.newLease')}
                </Link>
              </div>
              {property.leases.length ? (
                <div className="mt-6 divide-y divide-[#dce5e1]">
                  {property.leases.map((lease) => (
                    <Link className="grid gap-3 py-5 transition hover:bg-[#f5faf8] sm:grid-cols-[1fr_auto]" href={`/bail/${lease.id}`} key={lease.id}>
                      <div className="min-w-0">
                        <p className="break-words text-[15px] font-semibold leading-[1.4] text-[#17201e]">{lease.tenants?.full_name ?? t('leases.tenantFallback')}</p>
                        <p className="mt-1 text-[13px] font-normal leading-[1.45] text-[#66736f]">{[lease.start_date, lease.end_date].filter(Boolean).join(' – ')}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-[15px] font-semibold tabular-nums text-[#17201e]">{money(lease.monthly_rent)}</p>
                        <span className="mt-2 inline-flex rounded-md bg-[#e4f7ed] px-2 py-1 text-xs font-semibold text-[#087a55]">{lease.status === 'active' ? bailT('active') : lease.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-6 text-[13px] font-normal leading-[1.45] text-[#66736f]">{t('leases.empty')}</div>
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

            <section className="overflow-hidden rounded-xl border border-[#dce5e1] bg-white p-6 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
              <CardTitle icon="bolt" title={t('quickActions.title')} />
              <div className="mt-5 divide-y divide-[#dce5e1]">
                <QuickAction href="/tax" icon="description" label={t('quickActions.tax')} />
                <QuickAction href={`/bail?property_id=${property.id}`} icon="group" label={t('quickActions.manageLeases')} />
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}

function MaterialIcon({children, className = ''}: {children: string; className?: string}) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function CardTitle({icon, title}: {icon: string; title: string}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#e5f6ef] text-[#00796b]">
        <MaterialIcon className="text-[20px]">{icon}</MaterialIcon>
      </span>
      <h2 className="min-w-0 text-base font-semibold leading-[1.4] text-[#17201e]">{title}</h2>
    </div>
  );
}

function InfoCard({icon, label, value}: {icon: string; label: string; value: string}) {
  return (
    <div className="flex min-h-[120px] items-center gap-5 rounded-xl border border-[#dce5e1] bg-white p-6 shadow-[0_2px_6px_rgba(20,45,38,0.08)]">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#eaf3ef] text-[#00796b]">
        <MaterialIcon className="text-[34px]">{icon}</MaterialIcon>
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.03em] text-[#53615e]">{label}</p>
        <p className="mt-2 break-words text-[19px] font-semibold leading-[1.25] text-[#17201e]">{value}</p>
      </div>
    </div>
  );
}

function SectionCard({children, icon, title}: {children: React.ReactNode; icon: string; title: string}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#dce5e1] bg-white p-6 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
      <CardTitle icon={icon} title={title} />
      <div className="mt-7">{children}</div>
    </section>
  );
}

function DataRow({label, value}: {label: string; value: string}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.03em] text-[#53615e]">{label}</dt>
      <dd className="mt-2 break-words text-sm font-medium leading-[1.45] text-[#17201e]">{value}</dd>
    </div>
  );
}

function FinancialRow({accent = false, label, value}: {accent?: boolean; label: string; value: string}) {
  return (
    <div className="min-w-0 md:px-8 first:md:pl-0 last:md:pr-0">
      <dt className="text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.03em] text-[#53615e]">{label}</dt>
      <dd className={`mt-3 break-words text-[22px] font-semibold leading-[1.2] tabular-nums ${accent ? 'text-[#00796b]' : 'text-[#17201e]'}`}>{value}</dd>
    </div>
  );
}

function QuickAction({href, icon, label}: {href: string; icon: string; label: string}) {
  return (
    <Link className="-mx-3 flex min-h-14 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#006f61] transition hover:bg-[#f5faf8]" href={href}>
      <MaterialIcon className="shrink-0 text-[24px]">{icon}</MaterialIcon>
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <MaterialIcon className="shrink-0 text-[24px] text-[#33413f]">chevron_right</MaterialIcon>
    </Link>
  );
}
