import Link from 'next/link';
import {getTranslations} from 'next-intl/server';

import {AuthFrame, AuthSubmitButton, AuthTextInput} from '@/components/auth/auth-frame';
import {localizedPath} from '@/lib/navigation';

import {signInAction} from './actions';

const errorMessages = {
  invalid_credentials: 'invalid_credentials'
} as const;

const registeredMessages = {
  check_email: 'check_email',
  password_updated: 'password_updated'
} as const;

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
  const authError = error && error in errorMessages ? errorMessages[error as keyof typeof errorMessages] : null;
  const registeredStatus =
    registered && registered in registeredMessages ? registeredMessages[registered as keyof typeof registeredMessages] : null;

  return (
    <AuthFrame
      footerText={t('footerText')}
      legal={t('legal')}
      locale={locale}
      privacy={t('privacy')}
      tagline={t('brandTagline')}
      terms={t('terms')}
    >
      <form action={signInAction} className="grid gap-4">
        <input name="locale" type="hidden" value={locale} />
        <div>
          <h1 className="text-2xl font-semibold leading-8 tracking-[-0.01em]">{t('loginTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('loginSubtitle')}</p>
        </div>

        {authError ? <Notice tone="error">{t(`errors.${authError}`)}</Notice> : null}
        {registeredStatus ? <Notice>{t(`registered.${registeredStatus}`)}</Notice> : null}

        <AuthTextInput autoComplete="email" label={t('email')} name="email" placeholder={t('emailPlaceholder')} type="email" />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">{t('password')}</span>
            <Link className="text-sm font-semibold text-[var(--accent)] hover:underline" href={localizedPath(locale, '/forgot-password')}>
              {t('forgotPassword')}
            </Link>
          </div>
          <input
            autoComplete="current-password"
            className="focus-ring w-full rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm placeholder:text-[var(--outline)]"
            minLength={6}
            name="password"
            placeholder="********"
            required
            type="password"
          />
        </div>

        <AuthSubmitButton>{t('signIn')}</AuthSubmitButton>
      </form>

      <div className="relative py-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--line-soft)]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{t('or')}</span>
        </div>
      </div>

      <p className="text-center text-sm text-[var(--muted)]">
        {t('newHere')}{' '}
        <Link className="font-bold text-[var(--accent)] hover:underline" href={localizedPath(locale, '/signup')}>
          {t('signUp')}
        </Link>
      </p>
    </AuthFrame>
  );
}

function Notice({children, tone = 'success'}: {children: React.ReactNode; tone?: 'error' | 'success'}) {
  return (
    <p
      className={
        tone === 'error'
          ? 'rounded-md border border-[#ffdad6] bg-[#fff7f6] p-3 text-sm text-[#93000a]'
          : 'rounded-md border border-[#b8ded5] bg-[#edf8f4] p-3 text-sm text-[var(--accent-strong)]'
      }
    >
      {children}
    </p>
  );
}
