'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';

type NameOnboardingPromptProps = {
  copy: string;
  cta: string;
  dismiss: string;
  href: string;
  shouldShow: boolean;
  title: string;
};

const DISMISS_KEY = 'loyelio:name-onboarding-dismissed';

export function NameOnboardingPrompt({copy, cta, dismiss, href, shouldShow, title}: NameOnboardingPromptProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!shouldShow) {
      return;
    }

    setIsOpen(sessionStorage.getItem(DISMISS_KEY) !== 'true');
  }, [shouldShow]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-[#17201e] shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy}</p>
          </div>
          <button
            aria-label={dismiss}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-sm hover:bg-[#f0f5f2]"
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, 'true');
              setIsOpen(false);
            }}
            type="button"
          >
            x
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="min-h-10 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]"
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, 'true');
              setIsOpen(false);
            }}
            type="button"
          >
            {dismiss}
          </button>
          <Link className="inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" href={href} style={{color: '#ffffff'}}>
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
