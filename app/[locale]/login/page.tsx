import Link from 'next/link';
import {getTranslations} from 'next-intl/server';

import {requestPasswordResetAction, signInAction, signUpAction} from './actions';

const authErrorKeys = ['invalid_credentials', 'signup_failed'] as const;
const registeredKeys = ['check_email', 'password_updated', 'reset_sent'] as const;
const registeredMessages: Record<(typeof registeredKeys)[number], string> = {
  check_email: '',
  password_updated: 'Mot de passe mis a jour. Vous pouvez vous connecter.',
  reset_sent: 'Si ce compte existe, un email de reinitialisation vient d etre envoye.'
};

type LoginPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    error?: string;
    registered?: string;
  }>;
};

export default async function LoginPage({params, searchParams}: LoginPageProps) {
  const {locale} = await params;
  const {error, registered} = await searchParams;
  const t = await getTranslations('auth');
  const common = await getTranslations('common');
  const authError = authErrorKeys.find((key) => key === error);
  const registeredStatus = registeredKeys.find((key) => key === registered);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-[var(--line)] bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-[var(--accent)]">
          {common('appName')}
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{t('title')}</h1>
        <p className="mt-2 leading-7 text-[var(--muted)]">{t('subtitle')}</p>

        {authError ? (
          <p className="mt-4 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-3 text-sm text-[#7a4a11]">
            {t(`errors.${authError}`)}
          </p>
        ) : null}

        {registeredStatus ? (
          <p className="mt-4 rounded-md border border-[#b8ded5] bg-[#edf8f4] p-3 text-sm text-[var(--accent-strong)]">
            {registeredStatus === 'check_email' ? t(`registered.${registeredStatus}`) : registeredMessages[registeredStatus]}
          </p>
        ) : null}

        <form action={signInAction} className="mt-6 grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <label className="grid gap-2 text-sm font-medium">
            {t('email')}
            <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="email" required type="email" placeholder="vous@example.com" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {t('password')}
            <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" minLength={6} name="password" required type="password" placeholder="********" />
          </label>
          <button className="focus-ring mt-2 min-h-12 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
            {t('signIn')}
          </button>
        </form>

        <form action={requestPasswordResetAction} className="mt-4 grid gap-3 rounded-md border border-[var(--line)] bg-[#fbfaf7] p-4">
          <input name="locale" type="hidden" value={locale} />
          <p className="text-sm font-semibold">Mot de passe oublie</p>
          <label className="grid gap-2 text-sm font-medium">
            {t('email')}
            <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="email" required type="email" placeholder="vous@example.com" />
          </label>
          <button className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold" type="submit">
            Envoyer le lien
          </button>
        </form>

        <div className="my-6 border-t border-[var(--line)]" />

        <form action={signUpAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <label className="grid gap-2 text-sm font-medium">
            {t('email')}
            <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="email" required type="email" placeholder="vous@example.com" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {t('password')}
            <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" minLength={6} name="password" required type="password" placeholder="********" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {t('country')}
            <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue="FR" name="country">
              <option value="FR">{t('countryFrance')}</option>
            </select>
          </label>
          <button className="focus-ring mt-2 min-h-12 rounded-md border border-[var(--line)] bg-white px-5 text-sm font-semibold" type="submit">
            {t('signUp')}
          </button>
        </form>
      </section>
    </main>
  );
}
