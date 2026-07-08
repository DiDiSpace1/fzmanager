import Link from 'next/link';
import {getTranslations} from 'next-intl/server';

import {AuthFrame, AuthSubmitButton, AuthTextInput} from '@/components/auth/auth-frame';
import {localizedPath} from '@/lib/navigation';

import {requestPasswordResetAction} from '../login/actions';

type ForgotPasswordPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    registered?: string;
  }>;
};

export default async function ForgotPasswordPage({params, searchParams}: ForgotPasswordPageProps) {
  const {locale} = await params;
  const {registered} = await searchParams;
  const t = await getTranslations('auth');

  return (
    <AuthFrame
      footerText={t('footerText')}
      legal={t('legal')}
      locale={locale}
      privacy={t('privacy')}
      tagline={t('brandTagline')}
      terms={t('terms')}
    >
      <form action={requestPasswordResetAction} className="grid gap-4">
        <input name="locale" type="hidden" value={locale} />
        <div>
          <h1 className="text-2xl font-semibold leading-8 tracking-[-0.01em]">{t('forgotTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('forgotSubtitle')}</p>
        </div>

        {registered === 'reset_sent' ? (
          <p className="rounded-md border border-[#b8ded5] bg-[#edf8f4] p-3 text-sm text-[var(--accent-strong)]">
            {t('registered.reset_sent')}
          </p>
        ) : null}

        <AuthTextInput autoComplete="email" label={t('email')} name="email" placeholder={t('emailPlaceholder')} type="email" />
        <AuthSubmitButton>{t('sendResetLink')}</AuthSubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        <Link className="font-bold text-[var(--accent)] hover:underline" href={localizedPath(locale, '/login')}>
          {t('backToLogin')}
        </Link>
      </p>
    </AuthFrame>
  );
}
