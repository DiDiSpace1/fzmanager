'use server';

import {redirect} from 'next/navigation';

import {localizedPath} from '@/lib/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

export async function updatePasswordAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const password = value(formData, 'password');
  const code = value(formData, 'code');

  if (password.length < 6) {
    redirect(`${localizedPath(locale, '/reset-password')}?error=password_short`);
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    const {error: codeError} = await supabase.auth.exchangeCodeForSession(code);

    if (codeError) {
      redirect(`${localizedPath(locale, '/reset-password')}?error=session_failed`);
    }
  }

  const {error} = await supabase.auth.updateUser({
    password
  });

  if (error) {
    redirect(`${localizedPath(locale, '/reset-password')}?error=update_failed`);
  }

  redirect(`${localizedPath(locale, '/login')}?registered=password_updated`);
}
