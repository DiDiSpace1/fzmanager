import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getPropertyPhotoLimit} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {deletePropertyPhotoAction, updatePropertyAction} from '../../actions';
type EditPropertyPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
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
  property_photos: {
    file_name: string;
    file_path: string;
    id: string;
    is_cover: boolean;
    size_bytes: number | null;
  }[];
};

export default async function EditPropertyPage({params, searchParams}: EditPropertyPageProps) {
  const {id} = await params;
  const query = await searchParams;
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: property, error} = await supabase
    .from('properties')
    .select('id, name, address_line1, postal_code, city, property_type, rental_mode, surface_area, monthly_rent_estimate, charges_estimate, deposit_estimate, occupancy_status, property_photos(id, file_name, file_path, is_cover, size_bytes)')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<EditableProperty>();

  if (error || !property) {
    notFound();
  }

  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const photoLimit = getPropertyPhotoLimit(billing?.plan);
  const signedPhotos = await Promise.all(
    property.property_photos.map(async (photo) => {
      const {data: signed} = await supabase.storage.from('property-photos').createSignedUrl(photo.file_path, 60 * 5);
      return {...photo, signedUrl: signed?.signedUrl ?? null};
    })
  );

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

      <form action={updatePropertyAction} className="mt-8 grid gap-5" encType="multipart/form-data">
        <input name="locale" type="hidden" value={locale} />
        <input name="property_id" type="hidden" value={property.id} />

        {query.error === 'photo_limit' ? (
          <div className="rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
            Votre forfait autorise {photoLimit} photo(s) pour ce bien.
          </div>
        ) : null}

        {query.error === 'photo_size' ? (
          <div className="rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
            La photo est trop lourde pour votre forfait. Choisissez une image plus legere ou reduisez sa taille avant l&apos;envoi.
          </div>
        ) : null}

        {query.error === 'photo_failed' || query.error === 'photo_delete_failed' ? (
          <div className="rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
            Impossible de modifier les photos pour le moment. Verifiez les droits Storage Supabase puis reessayez.
          </div>
        ) : null}

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

        <SectionCard icon="camera" title="2. Photos & Documents">
          {signedPhotos.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {signedPhotos.map((photo) => (
                <div className="flex items-center gap-3 rounded-lg border border-[var(--line-soft)] bg-[#fbfdfc] p-3" key={photo.id}>
                  {photo.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-16 w-20 rounded-md object-cover" src={photo.signedUrl} />
                  ) : (
                    <div className="h-16 w-20 rounded-md bg-[#dee4e1]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{photo.file_name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{photo.size_bytes ? `${Math.round(photo.size_bytes / 1024)} KB` : 'Photo'}</p>
                  </div>
                  <button
                    className="focus-ring rounded-md border border-[#f3b4b4] px-3 py-2 text-sm font-semibold text-[#ba1a1a]"
                    form={`delete-photo-${photo.id}`}
                    type="submit"
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[var(--muted)]">Aucune photo pour ce bien.</p>
          )}
          <div className="rounded-lg border border-dashed border-[var(--line)] bg-[#fbfdfc] p-6 text-center">
            <p className="text-sm font-semibold">Ajouter des photos</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{photoLimit === 0 ? 'Les photos ne sont pas incluses dans le plan Free.' : `${property.property_photos.length}/${photoLimit} photo(s) utilisee(s).`}</p>
            <input className="focus-ring mt-4 w-full rounded-md border border-[var(--line-soft)] bg-white px-3 py-3 text-sm" disabled={photoLimit === 0 || property.property_photos.length >= photoLimit} multiple name="photos" type="file" accept="image/*" />
          </div>
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
      {signedPhotos.map((photo) => (
        <form action={deletePropertyPhotoAction} id={`delete-photo-${photo.id}`} key={photo.id}>
          <input name="locale" type="hidden" value={locale} />
          <input name="property_id" type="hidden" value={property.id} />
          <input name="photo_id" type="hidden" value={photo.id} />
        </form>
      ))}
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

function SmallIcon({name}: {name: string}) {
  const path =
    name === 'camera'
      ? 'M5 7h3l1.5-2h5L16 7h3v12H5z M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
      : 'M12 21s7-5.1 7-11a7 7 0 0 0-14 0c0 5.9 7 11 7 11z M12 10h.01';

  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--accent)]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}
