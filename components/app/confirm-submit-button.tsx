'use client';

import {useState} from 'react';

type ConfirmSubmitButtonProps = {
  cancelLabel?: string;
  children: React.ReactNode;
  className?: string;
  confirmLabel?: string;
  description: string;
  title: string;
};

export function ConfirmSubmitButton({
  cancelLabel = 'Annuler',
  children,
  className,
  confirmLabel = 'Confirmer',
  description,
  title
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={className} onClick={() => setOpen(true)} type="button">
        {children}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-[#171d1c]/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-[var(--line-soft)] bg-white shadow-2xl">
            <div className="border-b border-[var(--line-soft)] px-5 py-4">
              <h2 className="text-lg font-semibold text-[#171d1c]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4">
              <button className="focus-ring min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[#171d1c] hover:bg-[#f0f5f2]" onClick={() => setOpen(false)} type="button">
                {cancelLabel}
              </button>
              <button className="focus-ring min-h-10 rounded-md bg-[#ba1a1a] px-4 text-sm font-semibold text-white hover:bg-[#9f1515]" style={{color: '#ffffff'}} type="submit">
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
