'use client';

import {useEffect, useRef, useState} from 'react';

const MENU_WIDTH = 224;
const MENU_HEIGHT_ESTIMATE = 340;

export function TenantActionDetails({children}: {children: React.ReactNode}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({left: 0, top: 0});

  useEffect(() => {
    const close = (event: Event) => {
      if (event.target !== detailsRef.current) {
        detailsRef.current?.removeAttribute('open');
      }
    };

    window.addEventListener('tenant-actions-open', close);
    return () => window.removeEventListener('tenant-actions-open', close);
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

    const left = Math.max(12, rect.left - MENU_WIDTH - 12);
    const top = Math.min(Math.max(12, rect.top), window.innerHeight - MENU_HEIGHT_ESTIMATE - 12);
    setPosition({left, top});
  }

  return (
    <details
      className="relative inline-block"
      ref={detailsRef}
      onToggle={() => {
        if (detailsRef.current?.open) {
          window.dispatchEvent(new Event('tenant-actions-open'));
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
      <div
        className="fixed z-[9999] w-56 rounded-lg border border-[var(--line-soft)] bg-white p-1 text-left text-sm shadow-xl"
        style={{left: position.left, top: position.top}}
      >
        {children}
      </div>
    </details>
  );
}
