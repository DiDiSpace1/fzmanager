import Link from 'next/link';
import {getTranslations} from 'next-intl/server';

import {AuthFrame, AuthSubmitButton, AuthTextInput} from '@/components/auth/auth-frame';
import {localizedPath} from '@/lib/navigation';

import {signUpAction} from '../login/actions';

const signupReasonMessages: Record<string, string> = {
  database_error: 'La creation du compte a echoue pendant la preparation de votre espace. Contactez le support si cela se reproduit.',
  email_address_invalid: 'Cette adresse email n est pas acceptee.',
  email_exists: 'Un compte existe deja pour cet email. Essayez de vous connecter ou de reinitialiser le mot de passe.',
  over_email_send_rate_limit: 'Trop d emails ont ete envoyes recemment. Attendez quelques minutes puis reessayez.',
  signup_disabled: 'Les nouvelles inscriptions sont desactivees dans Supabase.',
  user_already_exists: 'Un compte existe deja pour cet email. Essayez de vous connecter ou de reinitialiser le mot de passe.',
  weak_password: 'Le mot de passe ne respecte pas la politique de securite.'
};

type SignupPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    error?: string;
    reason?: string;
  }>;
};

export default async function SignupPage({params, searchParams}: SignupPageProps) {
  const {locale} = await params;
  const {error, reason} = await searchParams;
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
      <form action={signUpAction} className="grid gap-4">
        <input name="locale" type="hidden" value={locale} />
        <div>
          <h1 className="text-2xl font-semibold leading-8 tracking-[-0.01em]">{t('signupTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('signupSubtitle')}</p>
        </div>

        {error === 'signup_failed' ? (
          <p className="rounded-md border border-[#ffdad6] bg-[#fff7f6] p-3 text-sm text-[#93000a]">
            {t('errors.signup_failed')}
            {reason ? <span className="mt-2 block">{signupReasonMessages[reason] ?? `Detail technique: ${reason}`}</span> : null}
          </p>
        ) : null}

        <AuthTextInput autoComplete="email" label={t('email')} name="email" placeholder={t('emailPlaceholder')} type="email" />
        <AuthTextInput autoComplete="new-password" label={t('password')} name="password" placeholder="********" type="password" />
        <label className="grid gap-2 text-sm font-medium">
          {t('country')}
          <select className="focus-ring rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm" defaultValue="FR" name="country">
            <option value="FR">{t('countryFrance')}</option>
          </select>
        </label>

        <AuthSubmitButton>{t('signUp')}</AuthSubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        {t('alreadyAccount')}{' '}
        <Link className="font-bold text-[var(--accent)] hover:underline" href={localizedPath(locale, '/login')}>
          {t('signIn')}
        </Link>
      </p>
    </AuthFrame>
  );
}
