import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-5 py-10">
      <section className="w-full max-w-lg rounded-lg border border-[var(--line)] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[var(--accent)]">Loyelio</p>
        <h1 className="mt-4 text-2xl font-semibold">Page introuvable</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Cette page n existe pas ou vous n avez plus acces a cette ressource.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white" href="/dashboard">
            Tableau de bord
          </Link>
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f2f0ea]" href="/">
            Accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
