'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';

const storageKey = 'petit-bailleur-cookie-choice';

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setVisible(!window.localStorage.getItem(storageKey));
    });
  }, []);

  function choose(value: 'accepted' | 'declined') {
    window.localStorage.setItem(storageKey, value);
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-lg border border-[var(--line)] bg-white p-4 shadow-lg">
      <p className="text-sm leading-6 text-[var(--foreground)]">
        Petit Bailleur utilise uniquement les cookies necessaires au fonctionnement du compte. Les outils de paiement et d authentification peuvent deposer leurs propres cookies.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="focus-ring min-h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white" onClick={() => choose('accepted')} type="button">
          Accepter
        </button>
        <button className="focus-ring min-h-10 rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f2f0ea]" onClick={() => choose('declined')} type="button">
          Refuser
        </button>
        <Link className="text-sm font-semibold text-[var(--accent)]" href="/privacy">
          Confidentialite
        </Link>
      </div>
    </div>
  );
}
