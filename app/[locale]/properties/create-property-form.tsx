'use client';

import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';

import {localizedPath} from '@/lib/navigation';
import {createSupabaseBrowserClient} from '@/lib/supabase/browser';

import {createPropertyDraftAction} from './actions';
import {PropertyPhotoPicker} from './property-photo-picker';

type CreatePropertyFormProps = {
  locale: string;
  maxPhotoSizeBytes: number;
  photoLimit: number;
};

function extensionFor(file: File) {
  return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
}

export function CreatePropertyForm({locale, maxPhotoSizeBytes, photoLimit}: CreatePropertyFormProps) {
  const common = useTranslations('common');
  const t = useTranslations('properties.form');
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="mt-8 grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');

        const form = event.currentTarget;
        const formData = new FormData(form);
        formData.delete('photos');

        startTransition(async () => {
          const result = await createPropertyDraftAction(formData);

          if ('error' in result) {
            setError(result.error === 'plan_limit' ? t('errors.planLimit') : t('errors.createFailed'));
            return;
          }

          if (files.length) {
            const supabase = createSupabaseBrowserClient();

            for (const [index, file] of files.entries()) {
              const filePath = `workspace/${result.workspaceId}/properties/${result.propertyId}/${crypto.randomUUID()}.${extensionFor(file)}`;
              const {error: uploadError} = await supabase.storage.from('property-photos').upload(filePath, file, {
                contentType: file.type || 'image/jpeg',
                upsert: false
              });

              if (uploadError) {
                setError(t('errors.photoUploadFailed'));
                router.push(localizedPath(locale, `/properties/${result.propertyId}/edit?error=photo_failed`));
                return;
              }

              const {error: photoError} = await supabase.from('property_photos').insert({
                file_name: file.name,
                file_path: filePath,
                is_cover: index === 0,
                mime_type: file.type || null,
                property_id: result.propertyId,
                size_bytes: file.size,
                sort_order: index,
                workspace_id: result.workspaceId
              });

              if (photoError) {
                await supabase.storage.from('property-photos').remove([filePath]);
                setError(t('errors.photoArchiveFailed'));
                router.push(localizedPath(locale, `/properties/${result.propertyId}/edit?error=photo_failed`));
                return;
              }
            }
          }

          router.push(localizedPath(locale, `/properties/${result.propertyId}`));
        });
      }}
    >
      <input name="locale" type="hidden" value={locale} />
      {error ? <div className="rounded-lg border border-[#f3b4b4] bg-[#ffdad6] p-4 text-sm font-semibold text-[#ba1a1a]">{error}</div> : null}
      <SectionCard icon="pin" title={t('generalTitle')}>
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          {t('name')}
          <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="name" placeholder={t('namePlaceholder')} required />
        </label>
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          {t('address')}
          <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="address_line1" placeholder={t('addressPlaceholder')} />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {t('postalCode')}
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="postal_code" placeholder="75002" />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {t('city')}
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="city" placeholder={t('cityPlaceholder')} />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {t('propertyType')}
            <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="property_type" defaultValue="studio">
              <option value="studio">{t('propertyTypes.studio')}</option>
              <option value="t1">T1</option>
              <option value="t2">T2</option>
              <option value="t3">T3</option>
              <option value="room">{t('propertyTypes.room')}</option>
              <option value="house">{t('propertyTypes.house')}</option>
              <option value="apartment">{t('propertyTypes.apartment')}</option>
              <option value="other">{t('propertyTypes.other')}</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {t('rentalMode')}
            <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="rental_mode" defaultValue="shared_rooms">
              <option value="shared_rooms">{t('rentalModes.sharedRooms')}</option>
              <option value="entire_place">{t('rentalModes.entirePlace')}</option>
              <option value="mixed">{t('rentalModes.mixed')}</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {t('surfaceArea')}
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" min="0" name="surface_area" placeholder="35" step="0.01" type="number" />
          </label>
        </div>
      </SectionCard>

      <SectionCard icon="camera" title={t('photosTitle')}>
        <div className="rounded-lg border border-dashed border-[var(--line)] bg-[#fbfdfc] p-6 text-center">
          <p className="text-sm font-semibold">{t('propertyPhotos')}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{photoLimit === 0 ? t('photosNotIncluded') : t('photoLimit', {limit: photoLimit})}</p>
          <PropertyPhotoPicker disabled={photoLimit === 0 || isPending} maxFiles={photoLimit} maxSizeBytes={maxPhotoSizeBytes} onFilesChange={setFiles} />
        </div>
      </SectionCard>

      <div className="flex justify-end gap-3">
        <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold" href="/properties">
          {common('cancel')}
        </Link>
        <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
          {isPending ? t('creating') : t('create')}
        </button>
      </div>
    </form>
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
