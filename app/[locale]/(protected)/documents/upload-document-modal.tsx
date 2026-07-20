'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

import {uploadDocumentAction} from './actions';

type PropertyOption = {
  id: string;
  name: string;
};

type TenantOption = {
  id: string;
  full_name: string;
};

const DOCUMENT_TYPES = [
  {labelKey: 'rentReceipt', value: 'rent_receipt'},
  {labelKey: 'lease', value: 'lease'},
  {labelKey: 'tax', value: 'tax'}
];

function UploadIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M12 15V4m0 0 4 4m-4-4-4 4M5 15v4h14v-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24">
      <path
        d="M8.75 17.5H7.5a4 4 0 0 1-.42-7.98 5.5 5.5 0 0 1 10.63 1.16A3.5 3.5 0 0 1 17 17.5h-1.75M12 18V11m0 0 2.5 2.5M12 11l-2.5 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M12 3.75 18 6v5.4c0 3.3-2.2 6.35-6 8.85-3.8-2.5-6-5.55-6-8.85V6l6-2.25Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m9.5 12 1.7 1.7 3.5-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function FileArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-20 w-20 opacity-30" fill="none" viewBox="0 0 24 24">
      <path d="M6 3.75h8l4 4v12.5H6V3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M14 4v4h4M12 17v-6m0 0 2.4 2.4M12 11l-2.4 2.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

export function UploadDocumentModal({locale, properties, tenants}: {locale: string; properties: PropertyOption[]; tenants: TenantOption[]}) {
  const t = useTranslations('documents');
  const modal = useTranslations('documents.uploadModal');
  const common = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState('');
  const requiresPropertyAndTenant = documentType === 'rent_receipt' || documentType === 'lease';
  const showsTenant = documentType !== 'tax';

  return (
    <>
      <button
        className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-sm"
        onClick={() => setOpen(true)}
        style={{color: '#ffffff'}}
        type="button"
      >
        <UploadIcon />
        {t('upload')}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="upload-document-title">
          <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl md:grid-cols-[195px_1fr]">
            <aside className="hidden bg-[var(--accent)] p-7 text-white md:flex md:flex-col" style={{color: '#ffffff'}}>
              <h2 className="text-xl font-semibold leading-7">{modal('sideTitle')}</h2>
              <p className="mt-5 text-sm font-semibold leading-6 text-white/90">{modal('sideCopy')}</p>
              <div className="mt-10 grid gap-5 text-sm font-semibold text-white/85">
                <div className="flex items-center gap-3">
                  <ShieldIcon />
                  {modal('secureStorage')}
                </div>
                <div className="flex items-center gap-3">
                  <CloudUploadIcon />
                  {modal('access')}
                </div>
              </div>
              <div className="mt-auto text-white">
                <FileArrowIcon />
              </div>
            </aside>

            <form action={uploadDocumentAction} className="overflow-y-auto p-6">
              <input name="locale" type="hidden" value={locale} />
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-semibold text-[#171d1c]" id="upload-document-title">
                  {modal('title')}
                </h2>
                <button className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full text-[#171d1c] transition hover:bg-[#f0f5f2]" onClick={() => setOpen(false)} type="button" aria-label={common('close')}>
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>

              <label className="mt-6 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--line)] bg-[#f8fbfa] px-4 text-center hover:bg-[#f0f5f2]">
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-white" style={{color: '#ffffff'}}>
                  <CloudUploadIcon />
                </span>
                <span className="text-sm font-semibold text-[#171d1c]">{modal('dropTitle')}</span>
                <span className="mt-1 text-xs text-[var(--muted)]">{modal('dropHint')}</span>
                <input accept=".pdf,image/png,image/jpeg" className="sr-only" name="file" required type="file" />
              </label>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-2 text-xs font-medium text-[#33413f]">
                  {modal('documentType')}
                  <select className="focus-ring min-h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal" name="document_type" onChange={(event) => setDocumentType(event.target.value)} required value={documentType}>
                    <option disabled value="">
                      {modal('selectType')}
                    </option>
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {t(`types.${type.labelKey}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-xs font-medium text-[#33413f]">
                  {requiresPropertyAndTenant ? modal('associatedPropertyRequired') : modal('associatedProperty')}
                  <select className="focus-ring min-h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal" name="property_id" required={requiresPropertyAndTenant}>
                    <option value="">{modal('chooseProperty')}</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </label>

                {showsTenant ? (
                  <label className="grid gap-2 text-xs font-medium text-[#33413f]">
                    {requiresPropertyAndTenant ? modal('tenantRequired') : modal('tenantOptional')}
                    <select className="focus-ring min-h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-sm font-normal" name="tenant_id" required={requiresPropertyAndTenant}>
                      <option value="">{requiresPropertyAndTenant ? modal('chooseTenant') : modal('noSpecificTenant')}</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-[var(--line-soft)] pt-5">
                <button className="focus-ring min-h-10 rounded-lg px-4 text-sm font-semibold text-[#171d1c] hover:bg-[#f0f5f2]" onClick={() => setOpen(false)} type="button">
                  {common('cancel')}
                </button>
                <button className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
                  <UploadIcon />
                  {t('upload')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
