'use client';

import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {useState, useTransition} from 'react';

import {createSupabaseBrowserClient} from '@/lib/supabase/browser';

import {deletePropertyPhotoAction} from './actions';
import {PropertyPhotoPicker} from './property-photo-picker';

type PhotoItem = {
  fileName: string;
  filePath: string;
  id: string;
  isCover: boolean;
  signedUrl: string | null;
};

type PropertyPhotoGalleryProps = {
  existingCount: number;
  locale: string;
  maxPhotoSizeBytes: number;
  photoLimit: number;
  photos: PhotoItem[];
  propertyId: string;
  workspaceId: string;
};

function extensionFor(file: File) {
  return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
}

export function PropertyPhotoGallery({existingCount, locale, maxPhotoSizeBytes, photoLimit, photos, propertyId, workspaceId}: PropertyPhotoGalleryProps) {
  const common = useTranslations('common');
  const t = useTranslations('properties.photos');
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function uploadSelectedPhotos() {
    if (!files.length) {
      return;
    }

    setError('');
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();

      for (const [index, file] of files.entries()) {
        const filePath = `workspace/${workspaceId}/properties/${propertyId}/${crypto.randomUUID()}.${extensionFor(file)}`;
        const {error: uploadError} = await supabase.storage.from('property-photos').upload(filePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false
        });

        if (uploadError) {
          setError(t('uploadFailed'));
          return;
        }

        const {error: photoError} = await supabase.from('property_photos').insert({
          file_name: file.name,
          file_path: filePath,
          is_cover: existingCount + index === 0,
          mime_type: file.type || null,
          property_id: propertyId,
          size_bytes: file.size,
          sort_order: existingCount + index,
          workspace_id: workspaceId
        });

        if (photoError) {
          await supabase.storage.from('property-photos').remove([filePath]);
          setError(t('archiveFailed'));
          return;
        }
      }

      router.refresh();
      setFiles([]);
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#dce5e1] bg-white p-6 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#e5f6ef] text-[#00796b]">
            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
          </span>
          <h2 className="min-w-0 text-base font-semibold leading-[1.4] text-[#17201e]">{t('title')}</h2>
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-[#17201e]">
          {existingCount}/{photoLimit}
        </span>
      </div>
      {photos.length ? (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <div className="group relative aspect-square overflow-hidden rounded-md bg-[#dee4e1]" key={photo.id}>
              {photo.signedUrl ? (
                <button className="h-full w-full" onClick={() => setPreviewUrl(photo.signedUrl)} type="button">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" src={photo.signedUrl} />
                </button>
              ) : null}
              <form action={deletePropertyPhotoAction}>
                <input name="locale" type="hidden" value={locale} />
                <input name="property_id" type="hidden" value={propertyId} />
                <input name="photo_id" type="hidden" value={photo.id} />
                <button
                  aria-label={t('deletePhoto')}
                  className="focus-ring absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full bg-[#ba1a1a] text-sm font-bold text-white shadow group-hover:flex"
                  type="submit"
                >
                  x
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-normal leading-[1.45] text-[#66736f]">{t('empty')}</p>
      )}

      <div className="mt-6 rounded-xl border border-dashed border-[#74938b] bg-[#fbfdfc] px-5 py-7 text-center">
        <span className="material-symbols-outlined text-[36px] text-[#00796b]">cloud_upload</span>
        <p className="mt-3 text-sm font-semibold text-[#17201e]">{t('addPhotos')}</p>
        <PropertyPhotoPicker disabled={existingCount >= photoLimit || isPending} existingCount={existingCount} maxFiles={photoLimit} maxSizeBytes={maxPhotoSizeBytes} onFilesChange={setFiles} />
        {files.length ? (
          <button className="focus-ring mt-3 min-h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} onClick={uploadSelectedPhotos} type="button">
            {isPending ? t('uploading') : common('add')}
          </button>
        ) : null}
        {error ? <p className="mt-3 text-sm font-semibold text-[#ba1a1a]">{error}</p> : null}
      </div>

      {previewUrl ? (
        <button className="fixed inset-0 z-[10000] flex cursor-zoom-out items-center justify-center bg-black/75 p-6" onClick={() => setPreviewUrl(null)} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" src={previewUrl} />
        </button>
      ) : null}
    </section>
  );
}
