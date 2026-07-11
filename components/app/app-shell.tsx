import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';

import {type BillingStatus, normalizeBillingPlan} from '@/lib/billing/config';
import {localizedPath} from '@/lib/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

import {SidebarNav} from './sidebar-nav';

const navItems = [
  {href: '/dashboard', key: 'dashboard'},
  {href: '/properties', key: 'properties'},
  {href: '/tenants', key: 'tenants'},
  {href: '/bail', key: 'bail'},
  {href: '/documents', key: 'documents'},
  {href: '/tax', key: 'tax'},
  {href: '/settings', key: 'settings'}
] as const;

function forfaitLabel(billing: BillingStatus | null) {
  if (!billing) {
    return 'Free';
  }

  const plan = normalizeBillingPlan(billing.plan);
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export async function AppShell({children}: {children: React.ReactNode}) {
  const t = await getTranslations('nav');
  const common = await getTranslations('common');
  const locale = await getLocale();
  let userEmail: string | null = null;
  let userForfait = 'Free';

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: {user}
    } = await supabase.auth.getUser();

    if (!user) {
      redirect(localizedPath(locale, '/login'));
    }

    userEmail = user.email ?? null;

    const {data: profile} = await supabase.from('profiles').select('default_workspace_id').eq('id', user.id).maybeSingle<{default_workspace_id: string | null}>();

    if (profile?.default_workspace_id) {
      const {data: billing} = await supabase
        .from('workspace_billing')
        .select('current_period_end, lifetime_access, plan, status, stripe_customer_id, stripe_subscription_id')
        .eq('workspace_id', profile.default_workspace_id)
        .maybeSingle<BillingStatus>();

      userForfait = forfaitLabel(billing ?? null);
    }
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'Missing Supabase environment variables.') {
      throw error;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside className="fixed inset-y-0 left-0 hidden w-[226px] border-r border-[var(--line-soft)] bg-[var(--background)] px-4 py-6 lg:block">
        <Link href="/dashboard" className="block px-2 text-2xl font-bold leading-7 text-[var(--accent)]">
          {common('appName')}
        </Link>
        <p className="mt-1 px-2 text-sm text-[#3d4947]">Gestion immobilière</p>
        {userEmail ? (
          <div className="mt-2 px-2">
            <p className="truncate text-xs text-[var(--muted)]">{userEmail}</p>
            <div className="mt-2 inline-flex rounded-md border border-[var(--line-soft)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--accent)]">
              {userForfait}
            </div>
          </div>
        ) : null}
        {userEmail ? (
          <SidebarNav
            helpLabel="Aide"
            items={navItems.map((item) => ({...item, label: t(item.key)}))}
            logoutAction={localizedPath(locale, '/logout')}
            logoutLabel={common('logout')}
          />
        ) : null}
      </aside>
      <div className="lg:pl-[226px]">
        <header className="sticky top-0 z-10 border-b border-[var(--line-soft)] bg-[var(--background)]/95 px-5 py-4 backdrop-blur lg:hidden">
          <div className="font-semibold">{common('appName')}</div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Link className="shrink-0 rounded-md border border-[var(--line)] px-3 py-2 text-xs" href={item.href} key={item.key}>
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
