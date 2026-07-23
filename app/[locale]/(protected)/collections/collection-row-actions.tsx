'use client';

import {useState} from 'react';

type CollectionStatus = 'paid' | 'partial' | 'unpaid';

type RowActionLabels = {
  cancel: string;
  confirm: string;
  copy: string;
  open: string;
  partialAmount: string;
  partialNote: string;
  receiptWarning: string;
  statuses: Record<CollectionStatus, string>;
  title: string;
};

export function CollectionRowActions({currentStatus, labels, leaseId}: {currentStatus: CollectionStatus; labels: RowActionLabels; leaseId: string}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CollectionStatus>(currentStatus === 'paid' ? 'unpaid' : 'paid');

  return (
    <>
      <button
        aria-label={labels.open}
        className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--accent)] hover:bg-[#f5faf8]"
        onClick={() => setOpen(true)}
        title={labels.open}
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">edit</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-left shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[#171d1c]">{labels.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{labels.copy}</p>
              </div>
              <button aria-label={labels.cancel} className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] hover:bg-[#f5faf8]" onClick={() => setOpen(false)} type="button">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {(['paid', 'partial', 'unpaid'] as const).map((value) => (
                <button
                  aria-pressed={status === value}
                  className={`focus-ring min-h-11 rounded-lg border px-3 text-sm font-semibold ${
                    status === value ? 'border-[var(--accent)] bg-[#e8f5f1] text-[var(--accent)]' : 'border-[var(--line)] bg-white text-[#34413e] hover:bg-[#f5faf8]'
                  }`}
                  key={value}
                  onClick={() => setStatus(value)}
                  type="button"
                >
                  {labels.statuses[value]}
                </button>
              ))}
            </div>

            {status === 'partial' ? (
              <div className="mt-4 grid gap-3 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-3">
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a4a11]">
                  {labels.partialAmount}
                  <input className="focus-ring min-h-11 rounded-lg border border-[#d6b98e] bg-white px-3 text-sm font-semibold tabular-nums text-[#171d1c]" min="0.01" name="single_amount" required step="0.01" type="number" />
                </label>
                <p className="text-sm leading-6 text-[#7a4a11]">{labels.partialNote}</p>
              </div>
            ) : null}
            {status === 'paid' ? <p className="mt-4 rounded-lg border border-[#b8e5cf] bg-[#edf8f1] p-3 text-sm leading-6 text-[#087a55]">{labels.receiptWarning}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button className="focus-ring min-h-10 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f5faf8]" onClick={() => setOpen(false)} type="button">
                {labels.cancel}
              </button>
              <button className="focus-ring min-h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" name="single_action" style={{color: '#ffffff'}} type="submit" value={`${leaseId}:${status}`}>
                {labels.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
