import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {getLocale, getTranslations} from 'next-intl/server';

import {getPlanLimits, hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getDocumentStorageUsage, getPlanUsage, getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createBillingPortalSessionAction, createCheckoutSessionAction, deleteAccountAction, updateAccountSettingsAction} from './actions';

type SettingsPageProps = {
  searchParams: Promise<{
    checkout?: string;
    error?: string;
    saved?: string;
    tab?: string;
  }>;
};

type SettingsTab = 'abonnement' | 'donnees' | 'profil' | 'securite';

const tabs: SettingsTab[] = ['profil', 'abonnement', 'securite', 'donnees'];

const planCards = [
  {documents: 150, label: 'Solo', monthlyPrice: 4.9, plan: 'solo', properties: 5, storage: '500 MB', tenants: 20, yearlyPrice: 39},
  {documents: 400, label: 'Plus', monthlyPrice: 7.9, plan: 'plus', properties: 10, storage: '1.5 GB', tenants: 40, yearlyPrice: 59},
  {documents: 1000, label: 'Portfolio', monthlyPrice: 12.9, plan: 'portfolio', properties: 20, storage: '4 GB', tenants: 80, yearlyPrice: 89}
] as const;

const errorMessages: Record<string, string> = {
  billing_customer_missing: 'Aucun client Stripe n est encore associe a cet espace.',
  checkout_failed: 'Impossible de creer la session Stripe. Reessayez dans un instant.',
  delete_confirmation: 'Saisissez SUPPRIMER pour confirmer la suppression du compte.',
  delete_failed: 'Impossible de supprimer le compte. Reessayez dans un instant.',
  settings_failed: 'Impossible d enregistrer les parametres du compte.',
  stripe_price_missing: 'Les Price IDs Stripe ne sont pas configures.'
};

function parseTab(value: string | undefined): SettingsTab {
  return tabs.includes(value as SettingsTab) ? (value as SettingsTab) : 'profil';
}

function tabHref(tab: SettingsTab) {
  return `/settings?tab=${tab}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: 'EUR',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    style: 'currency'
  }).format(value);
}

function usagePercent(usage: number, limit: number) {
  if (!limit) {
    return 0;
  }

  return Math.min(100, Math.round((usage / limit) * 100));
}

function planLabel(plan: string | null | undefined) {
  const normalized = normalizeBillingPlan(plan);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const value = name || email || 'Loyelio';
  const parts = value.split(/\s+|@/).filter(Boolean);
  return `${parts[0]?.[0] ?? 'H'}${parts[1]?.[0] ?? parts[0]?.[1] ?? 'L'}`.toUpperCase();
}

export default async function SettingsPage({searchParams}: SettingsPageProps) {
  const t = await getTranslations('settings');
  const locale = await getLocale();
  const params = await searchParams;
  const activeTab = parseTab(params.tab);
  const {profile, supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const {data: workspace} = await supabase.from('workspaces').select('country_code, tax_regime').eq('id', workspaceId).single();
  const paid = hasPaidAccess(billing);
  const currentPlan = paid ? normalizeBillingPlan(billing?.plan) : 'free';
  const currentLimits = getPlanLimits(currentPlan);
  const [propertyUsage, tenantUsage, documentUsage, storageUsage] = await Promise.all([
    getPlanUsage(supabase, workspaceId, 'properties'),
    getPlanUsage(supabase, workspaceId, 'tenants'),
    getPlanUsage(supabase, workspaceId, 'documents'),
    getDocumentStorageUsage(supabase, workspaceId)
  ]);
  const fullName = profile.full_name ?? '';

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
      </div>

      <SettingsTabs activeTab={activeTab} labels={{abonnement: t('tabs.abonnement'), donnees: t('tabs.donnees'), profil: t('tabs.profil'), securite: t('tabs.securite')}} />

      <StatusMessages checkout={params.checkout} error={params.error} saved={params.saved} />

      {activeTab === 'profil' ? (
        <ProfileTab
          countryCode={workspace?.country_code ?? profile.country_code ?? 'FR'}
          email={user.email ?? profile.email ?? ''}
          fullName={fullName}
          initials={initials(fullName, user.email ?? profile.email)}
          labels={{
            fullName: t('profile.fullName'),
            landlord: t('profile.landlord'),
            phone: t('profile.phone'),
            save: t('profile.save'),
            taxRegime: t('profile.taxRegime')
          }}
          locale={locale}
          taxRegime={workspace?.tax_regime ?? 'LMNP'}
        />
      ) : null}

      {activeTab === 'abonnement' ? (
        <SubscriptionTab
          billingCustomerId={billing?.stripe_customer_id ?? null}
          currentPlan={currentPlan}
          documentUsage={documentUsage}
          locale={locale}
          propertyUsage={propertyUsage}
          storageUsage={storageUsage}
          tenantUsage={tenantUsage}
          limits={currentLimits}
        />
      ) : null}

      {activeTab === 'securite' ? <SecurityTab /> : null}

      {activeTab === 'donnees' ? <DataTab locale={locale} storageLimit={currentLimits.storageBytes} storageUsage={storageUsage} /> : null}
    </>
  );
}

function SettingsTabs({activeTab, labels}: {activeTab: SettingsTab; labels: Record<SettingsTab, string>}) {
  return (
    <div className="mb-8 border-b border-[var(--line-soft)]">
      <nav className="flex gap-8 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            className={[
              'shrink-0 border-b-2 px-0 pb-4 text-sm font-semibold transition',
              activeTab === tab ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[#33413f] hover:text-[var(--accent)]'
            ].join(' ')}
            href={tabHref(tab)}
            key={tab}
          >
            {labels[tab]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function StatusMessages({checkout, error, saved}: {checkout?: string; error?: string; saved?: string}) {
  const t = useTranslations('settings.status');

  return (
    <>
      {checkout === 'success' ? <Message tone="success">{t('checkoutSuccess')}</Message> : null}
      {checkout === 'scheduled' ? <Message tone="success">{t('checkoutScheduled')}</Message> : null}
      {checkout === 'cancelled' ? <Message tone="warning">{t('checkoutCancelled')}</Message> : null}
      {error ? <Message tone="danger">{errorMessages[error] ?? t('billingError')}</Message> : null}
      {saved === 'settings' ? <Message tone="success">{t('saved')}</Message> : null}
    </>
  );
}

function Message({children, tone}: {children: React.ReactNode; tone: 'danger' | 'success' | 'warning'}) {
  const className =
    tone === 'success'
      ? 'border-[#b8d8c5] bg-[#f0fbf3] text-[#215d35]'
      : tone === 'warning'
        ? 'border-[#f0d6b6] bg-[#fff8ec] text-[#7a4a11]'
        : 'border-[#f0b6b6] bg-[#fff2f2] text-[#842020]';

  return <div className={`mb-6 rounded-lg border p-4 text-sm leading-6 ${className}`}>{children}</div>;
}

function ProfileTab({
  countryCode,
  email,
  fullName,
  initials: avatarInitials,
  labels,
  locale,
  taxRegime
}: {
  countryCode: string;
  email: string;
  fullName: string;
  initials: string;
  labels: {
    fullName: string;
    landlord: string;
    phone: string;
    save: string;
    taxRegime: string;
  };
  locale: string;
  taxRegime: string;
}) {
  return (
    <form action={updateAccountSettingsAction} className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
      <input name="current_locale" type="hidden" value={locale} />
      <input name="country_code" type="hidden" value={countryCode} />
      <input name="locale" type="hidden" value={locale} />
      <input name="tax_regime" type="hidden" value={taxRegime} />

      <div className="flex items-center gap-6">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#89f5e7] bg-[#dde1ff] text-xl font-bold text-[#3755c3]">
          {avatarInitials}
          <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-[var(--accent)] text-sm text-white">?</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#171d1c]">{fullName || email || labels.landlord}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{labels.landlord}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-[#33413f]">
          {labels.fullName}
          <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-[#f5faf8] px-4 text-sm font-normal" defaultValue={fullName} name="full_name" placeholder="Jean Dupont" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#33413f]">
          Email
          <input className="min-h-11 rounded-lg border border-[var(--line)] bg-[#f0f5f2] px-4 text-sm font-normal text-[var(--muted)]" defaultValue={email} disabled type="email" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#33413f]">
          {labels.phone}
          <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-[#f5faf8] px-4 text-sm font-normal" placeholder="+33 6 12 34 56 78" type="tel" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#33413f]">
          {labels.taxRegime}
          <input className="min-h-11 rounded-lg border border-[var(--line)] bg-[#f0f5f2] px-4 text-sm font-normal text-[var(--muted)]" defaultValue={taxRegime} disabled />
        </label>
      </div>

      <div className="mt-8 flex justify-end border-t border-[var(--line-soft)] pt-6">
        <button className="focus-ring min-h-11 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-white" type="submit">
          {labels.save}
        </button>
      </div>
    </form>
  );
}

function SubscriptionTab({
  billingCustomerId,
  currentPlan,
  documentUsage,
  limits,
  locale,
  propertyUsage,
  storageUsage,
  tenantUsage
}: {
  billingCustomerId: string | null;
  currentPlan: string;
  documentUsage: number;
  limits: ReturnType<typeof getPlanLimits>;
  locale: string;
  propertyUsage: number;
  storageUsage: number;
  tenantUsage: number;
}) {
  const t = useTranslations('settings.subscription');
  const currentPlanLabel = planLabel(currentPlan);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <section className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--line-soft)] bg-[#f0f5f2] px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">{t('currentPlan')}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{t('planDetails')}</p>
            </div>
            <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-bold uppercase text-[#047857]">{currentPlan === 'free' ? 'Free' : t('active')}</span>
          </div>
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
            <div>
              <p className="text-3xl font-semibold text-[var(--accent)]">{currentPlan === 'free' ? '0 EUR' : currentPlanLabel}</p>
              <h3 className="mt-5 text-xl font-semibold">{t('plan', {plan: currentPlanLabel})}</h3>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#33413f]">{t('currentPlanDescription')}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#33413f]">{t('included')}</p>
              <ul className="mt-5 grid gap-4 text-sm">
                <FeatureItem>{t('propertiesLimit', {count: limits.properties})}</FeatureItem>
                <FeatureItem>{t('tenantsLimit', {count: limits.tenants})}</FeatureItem>
                <FeatureItem>{t('documentsLimit', {count: limits.documents})}</FeatureItem>
                <FeatureItem>{t('storageLimit', {value: formatBytes(limits.storageBytes)})}</FeatureItem>
              </ul>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-5">
            <h2 className="text-lg font-semibold">{t('comparePlans')}</h2>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-3">
            {planCards.map((plan) => {
              const isCurrent = plan.plan === currentPlan;
              const cardContent = (
                <>
                  {!isCurrent ? (
                    <>
                      <input name="locale" type="hidden" value={locale} />
                      <input name="plan" type="hidden" value={plan.plan} />
                      <input name="return_path" type="hidden" value="/settings?tab=abonnement" />
                    </>
                  ) : null}
                <h3 className="font-semibold">{plan.label}</h3>
                <div className="mt-4 grid gap-2">
                  <label className={['flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-sm', isCurrent ? 'cursor-default' : 'cursor-pointer'].join(' ')}>
                    <span className="font-semibold">{t('monthly')}</span>
                    <span className="font-semibold text-[var(--accent)]">{t('monthlyPrice', {price: formatMoney(plan.monthlyPrice, locale)})}</span>
                    {!isCurrent ? <input className="ml-2" name="billing_interval" type="radio" value="monthly" /> : null}
                  </label>
                  <label className={['flex items-center justify-between rounded-lg border border-[var(--accent)] bg-[#eef7f4] px-3 py-2 text-sm', isCurrent ? 'cursor-default' : 'cursor-pointer'].join(' ')}>
                    <span className="font-semibold">{t('yearly')}</span>
                    <span className="font-semibold text-[var(--accent)]">{t('yearlyPrice', {price: formatMoney(plan.yearlyPrice, locale)})}</span>
                    {!isCurrent ? <input className="ml-2" defaultChecked name="billing_interval" type="radio" value="yearly" /> : null}
                  </label>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t('planSummary', {documents: plan.documents, properties: plan.properties, storage: plan.storage, tenants: plan.tenants})}</p>
                <button
                  className={[
                    'mt-5 min-h-10 w-full rounded-lg px-4 text-sm font-semibold',
                    isCurrent ? 'cursor-not-allowed bg-[#f0f5f2] text-[var(--muted)]' : 'focus-ring bg-[var(--accent)] text-white'
                  ].join(' ')}
                  disabled={isCurrent}
                  type={isCurrent ? 'button' : 'submit'}
                >
                  {isCurrent ? t('currentPlanButton') : t('changePlan')}
                </button>
                </>
              );

              return isCurrent ? (
                <div className="rounded-lg border border-[var(--line)] p-4" key={plan.plan}>
                  {cardContent}
                </div>
              ) : (
                <form action={createCheckoutSessionAction} className="rounded-lg border border-[var(--line)] p-4" key={plan.plan}>
                  {cardContent}
                </form>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="grid gap-6 content-start">
        <section className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t('paymentMethod')}</h2>
          <div className="mt-6 rounded-lg border border-[var(--line)] p-4 text-sm">
            <p className="font-semibold">{t('stripeCard')}</p>
            <p className="mt-1 text-[var(--muted)]">{t('stripePortalHint')}</p>
          </div>
          {billingCustomerId ? (
            <form action={createBillingPortalSessionAction} className="mt-5">
              <input name="locale" type="hidden" value={locale} />
              <button className="focus-ring min-h-11 w-full rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]" type="submit">
                {t('manageStripe')}
              </button>
            </form>
          ) : null}
        </section>

        <section className="rounded-xl bg-[var(--accent)] p-6 text-white shadow-sm">
          <h2 className="text-lg font-semibold">{t('planUsage')}</h2>
          <UsageBar label={t('propertiesUsage')} limit={limits.properties} usage={propertyUsage} />
          <UsageBar label={t('tenantsUsage')} limit={limits.tenants} usage={tenantUsage} />
          <UsageBar label={t('documentsUsage')} limit={limits.documents} usage={documentUsage} />
          <UsageBar label={t('storageUsage')} limit={limits.storageBytes} usage={storageUsage} value={`${formatBytes(storageUsage)} / ${formatBytes(limits.storageBytes)}`} />
        </section>
      </aside>
    </div>
  );
}

function SecurityTab() {
  const t = useTranslations('settings.security');

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section className="rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
        <div className="border-b border-[var(--line-soft)] bg-[#f0f5f2] px-6 py-5">
          <h2 className="text-lg font-semibold">{t('changePassword')}</h2>
        </div>
        <div className="grid gap-5 p-6">
          <label className="grid gap-2 text-sm font-medium text-[#33413f]">
            {t('oldPassword')}
            <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4" type="password" />
          </label>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-[#33413f]">
              {t('newPassword')}
              <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4" type="password" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#33413f]">
              {t('confirmPassword')}
              <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4" type="password" />
            </label>
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">{t('passwordHint')}</p>
          <button className="focus-ring min-h-11 w-fit rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-white" type="button">
            {t('updatePassword')}
          </button>
        </div>
      </section>
      <aside className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-6 text-sm text-[#1e3a8a]">
        <h2 className="text-base font-semibold">{t('tipsTitle')}</h2>
        <ul className="mt-5 grid gap-4 leading-6">
          <li>{t('tip1')}</li>
          <li>{t('tip2')}</li>
          <li>{t('tip3')}</li>
        </ul>
      </aside>
    </div>
  );
}

function DataTab({locale, storageLimit, storageUsage}: {locale: string; storageLimit: number; storageUsage: number}) {
  const t = useTranslations('settings.data');

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
      <div className="grid gap-6">
        <section className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t('exportTitle')}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t('exportCopy')}</p>
          <div className="mt-6">
            <div className="rounded-lg border border-[var(--line)] p-5">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">{t('jsonFormat')}</p>
              <h3 className="mt-3 font-semibold">{t('completeArchive')}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('jsonCopy')}</p>
              <ul className="mt-5 grid gap-3 text-sm leading-5 text-[#33413f]">
                <FeatureItem>{t('jsonIncludesBusinessData')}</FeatureItem>
                <FeatureItem>{t('jsonIncludesDocumentIndex')}</FeatureItem>
                <FeatureItem>{t('jsonExcludesSensitiveData')}</FeatureItem>
              </ul>
              <Link className="focus-ring mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" style={{color: '#ffffff'}} href="/api/account/export">
                {t('exportJson')}
              </Link>
            </div>
          </div>
        </section>

        <form action={deleteAccountAction} className="rounded-xl border border-[#ba1a1a] bg-white p-6 shadow-sm">
          <input name="locale" type="hidden" value={locale} />
          <p className="text-sm font-bold uppercase text-[#ba1a1a]">{t('dangerZone')}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-lg font-semibold">{t('deleteTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('deleteCopy')}</p>
              <label className="mt-4 grid max-w-xs gap-2 text-sm font-medium">
                {t('typeDelete')}
                <input className="focus-ring min-h-10 rounded-lg border border-[var(--line)] px-3" name="confirmation" placeholder="SUPPRIMER" />
              </label>
            </div>
            <button className="focus-ring min-h-11 rounded-lg bg-[#ba1a1a] px-6 text-sm font-semibold text-white cursor-pointer" type="submit">
              {t('deleteForever')}
            </button>
          </div>
        </form>
      </div>
      <aside className="grid gap-6 content-start">
        <section className="rounded-xl border border-[var(--line-soft)] bg-[#dee4e1] p-6">
          <h2 className="text-lg font-semibold">{t('retentionTitle')}</h2>
          <ul className="mt-5 grid gap-5 text-sm leading-5 text-[#33413f]">
            <li><span className="font-semibold">{t('legalDocuments')}</span><br />{t('legalDocumentsCopy')}</li>
            <li><span className="font-semibold">{t('receiptsInvoices')}</span><br />{t('receiptsInvoicesCopy')}</li>
            <li><span className="font-semibold">{t('cookiesTracking')}</span><br />{t('cookiesTrackingCopy')}</li>
          </ul>
          <Link className="mt-6 inline-flex text-sm font-semibold text-[var(--accent)]" href="/privacy">{t('privacyPolicy')}</Link>
        </section>
        <section className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t('storageUsed')}</h2>
          <UsageBar dark={false} label={t('documentsImages')} limit={storageLimit} usage={storageUsage} value={`${formatBytes(storageUsage)} / ${formatBytes(storageLimit)}`} />
          <p className="mt-5 text-sm leading-6 text-[var(--muted)]">{t('storageCurrentPlan', {value: formatBytes(storageLimit)})}</p>
        </section>
      </aside>
    </div>
  );
}

function FeatureItem({children}: {children: React.ReactNode}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--accent)] text-xs font-bold text-[var(--accent)]">✓</span>
      <span>{children}</span>
    </li>
  );
}

function UsageBar({dark = true, label, limit, usage, value}: {dark?: boolean; label: string; limit: number; usage: number; value?: string}) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-4 text-xs font-semibold">
        <span>{label}</span>
        <span>{value ?? `${usage} / ${limit}`}</span>
      </div>
      <div className={['mt-2 h-2 overflow-hidden rounded-full', dark ? 'bg-white/25' : 'bg-[#dee4e1]'].join(' ')}>
        <div className={['h-full rounded-full', dark ? 'bg-white' : 'bg-[var(--accent)]'].join(' ')} style={{width: `${usagePercent(usage, limit)}%`}} />
      </div>
    </div>
  );
}
