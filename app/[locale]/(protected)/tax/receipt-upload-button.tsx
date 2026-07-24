'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {PendingSubmitButton} from '@/components/app/pending-submit-button';

import {attachExpenseReceiptAction} from './actions';

export function ReceiptUploadButton({expenseId, locale}: {expenseId: string; locale: string}) {
  const t = useTranslations('documents.receiptUpload');
  const common = useTranslations('common');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--accent)] bg-white px-4 text-xs font-semibold text-[var(--accent)] hover:bg-[#eef7f4]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
        {t('button')}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby={`receipt-upload-${expenseId}`}>
          <form action={attachExpenseReceiptAction} className="w-full max-w-md rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-xl">
            <input name="locale" type="hidden" value={locale} />
            <input name="expense_id" type="hidden" value={expenseId} />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[#171d1c]" id={`receipt-upload-${expenseId}`}>
                  {t('title')}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{t('hint')}</p>
              </div>
              <button className="focus-ring rounded-md p-1 text-xl leading-none text-[#33413f] hover:bg-[#f0f5f2]" onClick={() => setOpen(false)} type="button" aria-label={common('close')}>
                x
              </button>
            </div>
            <label className="mt-5 grid gap-2 text-sm font-medium text-[#33413f]">
              {t('file')}
              <input accept=".pdf,image/png,image/jpeg" className="focus-ring rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm" name="receipt_file" required type="file" />
            </label>
            <div className="mt-6 flex justify-end gap-3 border-t border-[var(--line-soft)] pt-4">
              <button className="focus-ring min-h-10 rounded-md px-4 text-sm font-semibold text-[#171d1c] hover:bg-[#f0f5f2]" onClick={() => setOpen(false)} type="button">
                {common('cancel')}
              </button>
              <PendingSubmitButton className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70" style={{color: '#ffffff'}}>
                <span className="material-symbols-outlined text-[20px]">upload</span>
                {common('upload')}
              </PendingSubmitButton>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
