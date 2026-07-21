import {NextResponse, type NextRequest} from 'next/server';

import {getWorkspaceBilling} from '@/lib/billing/limits';
import {syncWorkspaceBillingFromStripe} from '@/lib/billing/sync';
import {localizedPath} from '@/lib/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

type CallbackParams = {
  params: Promise<{
    locale: string;
  }>;
};

export async function GET(request: NextRequest, {params}: CallbackParams) {
  const {locale} = await params;
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? localizedPath(locale, '/dashboard');

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
    const {
      data: {user}
    } = await supabase.auth.getUser();

    if (user) {
      const {data: profile} = await supabase.from('profiles').select('default_workspace_id').eq('id', user.id).maybeSingle<{default_workspace_id: string | null}>();

      if (profile?.default_workspace_id) {
        const billing = await getWorkspaceBilling(supabase, profile.default_workspace_id);

        if (billing?.stripe_subscription_id) {
          try {
            await syncWorkspaceBillingFromStripe(profile.default_workspace_id, billing.stripe_subscription_id);
          } catch (error) {
            console.error('Stripe billing sync on login failed', error);
          }
        }
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
