'use server';

import {redirect} from 'next/navigation';

import {localizedPath} from '@/lib/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing form field: ${key}`);
  }

  return value.trim();
}

function getOptionalValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function signInAction(formData: FormData) {
  const email = getRequiredValue(formData, 'email');
  const password = getRequiredValue(formData, 'password');
  const locale = getRequiredValue(formData, 'locale');
  const supabase = await createSupabaseServerClient();

  const {error} = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`${localizedPath(locale, '/login')}?error=invalid_credentials`);
  }

  redirect(localizedPath(locale, '/dashboard'));
}

export async function signUpAction(formData: FormData) {
  const email = getRequiredValue(formData, 'email');
  const password = getRequiredValue(formData, 'password');
  const countryCode = getRequiredValue(formData, 'country');
  const locale = getRequiredValue(formData, 'locale');
  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const {data, error} = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        country_code: countryCode,
        locale
      },
      emailRedirectTo: `${appUrl}${localizedPath(locale, '/auth/callback')}`
    }
  });

  if (error) {
    console.error('Supabase signup failed', {
      code: error.code,
      message: error.message,
      status: error.status
    });
    const reason = encodeURIComponent(error.code ?? error.message);
    redirect(`${localizedPath(locale, '/signup')}?error=signup_failed&reason=${reason}`);
  }

  if (!data.session) {
    redirect(`${localizedPath(locale, '/login')}?registered=check_email`);
  }

  redirect(localizedPath(locale, '/dashboard'));
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = getRequiredValue(formData, 'email');
  const locale = getOptionalValue(formData, 'locale') || 'fr';
  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectTo = `${appUrl}${localizedPath(locale, '/reset-password')}`;

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  });

  redirect(`${localizedPath(locale, '/forgot-password')}?registered=reset_sent`);
}
