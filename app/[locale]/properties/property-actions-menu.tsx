'use client';

import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useEffect, useRef, useState} from 'react';

import {ConfirmSubmitButton} from '@/components/app/confirm-submit-button';

import {deletePropertyAction} from './actions';

const MENU_WIDTH = 176;
const MENU_HEIGHT_ESTIMATE = 180;

export function PropertyActionsMenu({locale, propertyId}: {locale: string; propertyId: string}) {
  const common = useTranslations('common');
  const t = useTranslations('properties.actions');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({left: 0, top: 0});

  useEffect(() => {
    const close = (event: Event) => {
      if (event.target !== detailsRef.current) {
        detailsRef.current?.removeAttribute('open');
      }
    };

    window.addEventListener('property-actions-open', close);
    return () => window.removeEventListener('property-actions-open', close);
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
    <details
      className="relative inline-block"
      ref={detailsRef}
      onToggle={() => {
        if (detailsRef.current?.open) {
          window.dispatchEvent(new Event('property-actions-open'));
          detailsRef.current.open = true;
          placeMenu();
        }
      }}
    >
      <summary
        className="focus-ring flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-xl text-[var(--muted)] hover:bg-[#eaefed]"
        ref={summaryRef}
        onClick={() => window.setTimeout(placeMenu, 0)}
      >
        ...
      </summary>
      <div className="fixed z-[9999] w-44 rounded-lg border border-[var(--line-soft)] bg-white p-1 text-left text-sm shadow-xl" style={{left: position.left, top: position.top}}>
        <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/properties/${propertyId}`}>
          {common('view')}
        </Link>
        <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/properties/${propertyId}/edit`}>
          {common('edit')}
        </Link>
        <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/properties/${propertyId}/tenants`}>
          {t('manageTenants')}
        </Link>
        <form action={deletePropertyAction}>
          <input name="locale" type="hidden" value={locale} />
          <input name="property_id" type="hidden" value={propertyId} />
          <ConfirmSubmitButton
            className="block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]"
            confirmLabel={common('delete')}
            description={t('deleteDescription')}
            title={t('deleteTitle')}
          >
            {common('delete')}
          </ConfirmSubmitButton>
        </form>
      </div>
    </details>
  );
}
