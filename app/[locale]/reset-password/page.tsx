import Link from 'next/link';

import {updatePasswordAction} from './actions';

type ResetPasswordPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    code?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  password_short: 'Le mot de passe doit contenir au moins 6 caracteres.',
  session_failed: 'Le lien de reinitialisation a expire ou a deja ete utilise.',
  update_failed: 'Impossible de mettre a jour le mot de passe. Relancez le lien de reinitialisation.'
};

export default async function ResetPasswordPage({params, searchParams}: ResetPasswordPageProps) {
  const {locale} = await params;
  const {code, error} = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-[var(--line)] bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-[var(--accent)]">
          Loyelio
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Nouveau mot de passe</h1>
        <p className="mt-2 leading-7 text-[var(--muted)]">Choisissez un nouveau mot de passe pour votre compte.</p>

        {error ? (
          <p className="mt-4 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-3 text-sm text-[#7a4a11]">
            {errorMessages[error] ?? 'Le mot de passe n a pas pu etre modifie.'}
          </p>
        ) : null}

        <form action={updatePasswordAction} className="mt-6 grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <input name="code" type="hidden" value={code ?? ''} />
          <label className="grid gap-2 text-sm font-medium">
            Mot de passe
            <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" minLength={6} name="password" required type="password" placeholder="********" />
          </label>
          <button className="focus-ring mt-2 min-h-12 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
            Enregistrer
          </button>
        </form>
      </section>
    </main>
  );
}
