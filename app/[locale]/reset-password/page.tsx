import Link from 'next/link';
import {getTranslations} from 'next-intl/server';

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

const errorMessageKeys: Record<string, 'passwordShort' | 'sessionFailed' | 'updateFailed'> = {
  password_short: 'passwordShort',
  session_failed: 'sessionFailed',
  update_failed: 'updateFailed'
};

export default async function ResetPasswordPage({params, searchParams}: ResetPasswordPageProps) {
  const {locale} = await params;
  const {code, error} = await searchParams;
  const common = await getTranslations('common');
  const t = await getTranslations('auth.resetPassword');

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-[var(--line)] bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-[var(--accent)]">
          {common('appName')}
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{t('title')}</h1>
        <p className="mt-2 leading-7 text-[var(--muted)]">{t('subtitle')}</p>

        {error ? (
          <p className="mt-4 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-3 text-sm text-[#7a4a11]">
            {t(`errors.${errorMessageKeys[error] ?? 'default'}`)}
          </p>
        ) : null}

        <form action={updatePasswordAction} className="mt-6 grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <input name="code" type="hidden" value={code ?? ''} />
          <label className="grid gap-2 text-sm font-medium">
            {t('password')}
            <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" minLength={6} name="password" required type="password" placeholder="********" />
          </label>
          <button className="focus-ring mt-2 min-h-12 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
            {common('save')}
          </button>
        </form>
      </section>
    </main>
  );
}
