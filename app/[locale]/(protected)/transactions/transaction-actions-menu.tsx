'use client';

import {useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {useTranslations} from 'next-intl';

import {ConfirmSubmitButton} from '@/components/app/confirm-submit-button';
import {DateDisplayInput, isoDateToDisplay} from '@/components/forms/date-display-input';

import {deleteTransactionAction, updateTransactionAction} from './actions';

export type TransactionActionRow = {
  amount: number;
  category: string;
  date: string;
  description?: string | null;
  id: string;
  meta: string;
  notes?: string | null;
  paymentMethod?: string | null;
  propertyId?: string | null;
  revenueType?: string | null;
  taxCategoryId?: string | null;
  type: 'expense' | 'revenue';
  vendor?: string | null;
};

export type TransactionActionOption = {
  id: string;
  label: string;
};

function moneyValue(value: number) {
  return Number(value || 0).toFixed(2);
}

const MENU_WIDTH = 176;
const MENU_HEIGHT_ESTIMATE = 132;

export function TransactionActionsMenu({
  initialViewOpen = false,
  locale,
  properties,
  row,
  taxCategories
}: {
  initialViewOpen?: boolean;
  locale: string;
  properties: TransactionActionOption[];
  row: TransactionActionRow;
  taxCategories: TransactionActionOption[];
}) {
  const common = useTranslations('common');
  const t = useTranslations('transactions');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [viewOpen, setViewOpen] = useState(initialViewOpen);
  const [editOpen, setEditOpen] = useState(false);
  const [position, setPosition] = useState({left: 0, top: 0});

  useEffect(() => {
    const close = (event: Event) => {
      if (event.target !== detailsRef.current) {
        detailsRef.current?.removeAttribute('open');
      }
    };

    window.addEventListener('transaction-actions-open', close);
    return () => window.removeEventListener('transaction-actions-open', close);
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.removeAttribute('open');
      }
    };

    document.addEventListener('click', closeOnOutsideClick);
    return () => document.removeEventListener('click', closeOnOutsideClick);
  }, []);

  function placeMenu() {
    const rect = summaryRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const left = Math.min(Math.max(12, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 12);
    const top = Math.min(Math.max(12, rect.bottom + 8), window.innerHeight - MENU_HEIGHT_ESTIMATE - 12);
    setPosition({left, top});
  }

  return (
    <div className="relative flex justify-end">
      <details
        className="relative inline-block"
        ref={detailsRef}
        onToggle={() => {
          if (detailsRef.current?.open) {
            window.dispatchEvent(new Event('transaction-actions-open'));
            detailsRef.current.open = true;
            placeMenu();
          }
        }}
        data-transaction-actions
      >
        <summary className="focus-ring flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-[#33413f] hover:bg-[#eef2f0]" ref={summaryRef} onClick={() => window.setTimeout(placeMenu, 0)}>
          <span className="material-symbols-outlined text-xl">more_horiz</span>
        </summary>
        <div className="fixed z-[9999] w-44 rounded-lg border border-[var(--line-soft)] bg-white p-1 text-left text-sm shadow-xl" style={{left: position.left, top: position.top}}>
          <button className="w-full rounded-md px-3 py-2 text-left hover:bg-[#f0f5f2]" onClick={() => setViewOpen(true)} type="button">
            {common('view')}
          </button>
          <button className="w-full rounded-md px-3 py-2 text-left hover:bg-[#f0f5f2] cursor-pointer" onClick={() => setEditOpen(true)} type="button">
            {common('edit')}
          </button>
          <form action={deleteTransactionAction}>
            <input name="locale" type="hidden" value={locale} />
            <input name="type" type="hidden" value={row.type} />
            <input name="revenue_type" type="hidden" value={row.revenueType ?? 'rent'} />
            <input name="id" type="hidden" value={row.id} />
            <ConfirmSubmitButton
              className="w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff3f0] cursor-pointer"
              confirmLabel={common('delete')}
              description={t('deleteDescription')}
              title={t('deleteTitle')}
            >
              {common('delete')}
            </ConfirmSubmitButton>
          </form>
        </div>
      </details>

      {viewOpen ? (
        <Modal title={t('detailTitle')} onClose={() => setViewOpen(false)}>
          <dl className="grid gap-3 text-sm">
            <Info label={t('type')} value={row.type === 'revenue' ? t('revenue') : t('expense')} />
            <Info label={t('date')} value={isoDateToDisplay(row.date)} />
            <Info label={t('category')} value={row.category} />
            <Info label={t('propertyTenant')} value={row.meta} />
            <Info label={t('amount')} value={`${moneyValue(row.amount)} EUR`} />
            {row.vendor ? <Info label={t('vendor')} value={row.vendor} /> : null}
            {row.description ? <Info label={t('description')} value={row.description} /> : null}
            {row.notes ? <Info label={t('additionalNote')} value={row.notes} /> : null}
          </dl>
        </Modal>
      ) : null}

      {editOpen ? (
        <Modal title={t('editTitle')} onClose={() => setEditOpen(false)}>
          <form action={updateTransactionAction} className="grid gap-4">
            <input name="locale" type="hidden" value={locale} />
            <input name="type" type="hidden" value={row.type} />
            <input name="id" type="hidden" value={row.id} />
            <label className="grid gap-2 text-sm text-[#3d4947]">
              {t('date')}
              <DateDisplayInput className="focus-ring h-11 min-h-11 w-full rounded-md border border-[var(--line)] px-3" defaultValue={row.date} name="date" required />
            </label>
            <label className="grid gap-2 text-sm text-[#3d4947]">
              {t('amount')}
              <span className="flex min-h-11 items-center rounded-md border border-[var(--line)] bg-white px-3">
                <input className="min-w-0 flex-1 border-0 bg-transparent outline-none" defaultValue={moneyValue(row.amount)} min="0.01" name="amount" required step="0.01" type="number" />
                <span className="text-sm font-semibold">EUR</span>
              </span>
            </label>
            {row.type === 'revenue' ? (
              <>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  {t('paymentMethod')}
                  <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.paymentMethod ?? 'bank_transfer'} name="payment_method">
                    <option value="bank_transfer">{t('bankTransfer')}</option>
                    <option value="card">{t('card')}</option>
                    <option value="cash">{t('cash')}</option>
                    <option value="cheque">{t('cheque')}</option>
                    <option value="other">{t('other')}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  {t('additionalNote')}
                  <textarea className="focus-ring min-h-24 rounded-md border border-[var(--line)] px-3 py-3" defaultValue={row.notes ?? ''} name="notes" />
                </label>
              </>
            ) : (
              <>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  {t('category')}
                  <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.taxCategoryId ?? ''} name="tax_category_id">
                    {taxCategories.length ? null : <option value="">{t('otherFees')}</option>}
                    {taxCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  {t('property')}
                  <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.propertyId ?? ''} name="property_id">
                    <option value="">{t('global')}</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  {t('vendor')}
                  <input autoComplete="off" className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.vendor ?? ''} name="vendor" />
                </label>
                <label className="grid gap-2 text-sm text-[#3d4947]">
                  {t('description')}
                  <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3" defaultValue={row.description ?? ''} name="description" />
                </label>
              </>
            )}
            <div className="flex justify-end gap-3 border-t border-[var(--line-soft)] pt-4">
              <button className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-5 text-sm font-semibold" onClick={() => setEditOpen(false)} type="button">
                {common('cancel')}
              </button>
              <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
                {common('save')}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Info({label, value}: {label: string; value: string}) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#53615f]">{label}</dt>
      <dd className="font-medium text-[#171d1c]">{value}</dd>
    </div>
  );
}

function Modal({children, onClose, title}: {children: ReactNode; onClose: () => void; title: string}) {
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-white text-left shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="focus-ring rounded-md p-2" onClick={onClose} type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
