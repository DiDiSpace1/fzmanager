'use client';

import Link from 'next/link';
import {useEffect} from 'react';

type ErrorPageProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function ErrorPage({error, reset}: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-5 py-10">
      <section className="w-full max-w-lg rounded-lg border border-[var(--line)] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[var(--accent)]">Loyelio</p>
        <h1 className="mt-4 text-2xl font-semibold">La page n a pas pu se charger</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Une erreur serveur est survenue. Vous pouvez reessayer ou revenir au tableau de bord.
        </p>
        {error.digest ? <p className="mt-3 text-xs text-[var(--muted)]">Reference: {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white" onClick={reset} type="button">
            Reessayer
          </button>
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f2f0ea]" href="/dashboard">
            Tableau de bord
          </Link>
        </div>
      </section>
    </main>
  );
}
