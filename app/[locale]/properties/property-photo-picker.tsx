'use client';

import {useRef, useState} from 'react';
import {useTranslations} from 'next-intl';

type PropertyPhotoPickerProps = {
  disabled?: boolean;
  existingCount?: number;
  maxFiles: number;
  maxSizeBytes: number;
  onFilesChange?: (files: File[]) => void;
};

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function PropertyPhotoPicker({disabled = false, existingCount = 0, maxFiles, maxSizeBytes, onFilesChange}: PropertyPhotoPickerProps) {
  const common = useTranslations('common');
  const t = useTranslations('properties.photos');
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const remainingSlots = Math.max(0, maxFiles - existingCount);

  function syncInput(nextFiles: File[]) {
    const dataTransfer = new DataTransfer();
    nextFiles.forEach((file) => dataTransfer.items.add(file));

    if (inputRef.current) {
      inputRef.current.files = dataTransfer.files;
    }
  }

  function setNextFiles(nextFiles: File[]) {
    setFiles(nextFiles);
    syncInput(nextFiles);
    onFilesChange?.(nextFiles);
  }

  return (
    <div className="mt-4 grid gap-3 text-left">
      <input
        ref={inputRef}
        accept="image/*"
        className="focus-ring w-full rounded-md border border-[var(--line-soft)] bg-white px-3 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || remainingSlots === 0}
        multiple
        name="photos"
        onChange={(event) => {
          const pickedFiles = Array.from(event.target.files ?? []);

          if (!pickedFiles.length) {
            return;
          }

          const mergedByKey = new Map(files.map((file) => [fileKey(file), file]));
          pickedFiles.forEach((file) => mergedByKey.set(fileKey(file), file));
          const nextFiles = Array.from(mergedByKey.values());

          if (nextFiles.length > remainingSlots) {
            setError(t('remainingLimit', {count: remainingSlots}));
            syncInput(files);
            return;
          }

          const oversized = nextFiles.find((file) => file.size > maxSizeBytes);

          if (oversized) {
            setError(t('fileTooLarge', {name: oversized.name, size: formatSize(maxSizeBytes)}));
            syncInput(files);
            return;
          }

          setError('');
          setNextFiles(nextFiles);
        }}
        type="file"
      />
      <p className="text-xs text-[var(--muted)]">
        {t('selectionSummary', {selected: existingCount + files.length, max: maxFiles, size: formatSize(maxSizeBytes)})}
      </p>
      {error ? <p className="text-sm font-semibold text-[#ba1a1a]">{error}</p> : null}
      {files.length ? (
        <div className="grid gap-2">
          {files.map((file) => (
            <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--line-soft)] bg-white px-3 py-2 text-sm" key={fileKey(file)}>
              <span className="min-w-0 truncate">{file.name}</span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-[var(--muted)]">{formatSize(file.size)}</span>
                <button
                  className="focus-ring rounded px-2 py-1 text-xs font-semibold text-[#ba1a1a]"
                  onClick={() => {
                    const nextFiles = files.filter((item) => fileKey(item) !== fileKey(file));
                    setError('');
                    setNextFiles(nextFiles);
                  }}
                  type="button"
                >
                  {common('remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
