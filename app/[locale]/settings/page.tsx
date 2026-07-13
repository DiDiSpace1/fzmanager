import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
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

const tabs: Array<{label: string; value: SettingsTab}> = [
  {label: 'Profil', value: 'profil'},
  {label: 'Abonnement', value: 'abonnement'},
  {label: 'Securite', value: 'securite'},
  {label: 'Donnees', value: 'donnees'}
];

const planCards = [
  {documents: 150, label: 'Solo', plan: 'solo', price: '39 EUR/an', properties: 5, storage: '500 MB', tenants: 20},
  {documents: 400, label: 'Plus', plan: 'plus', price: '69 EUR/an', properties: 10, storage: '1.5 GB', tenants: 40},
  {documents: 1000, label: 'Portfolio', plan: 'portfolio', price: '99 EUR/an', properties: 20, storage: '4 GB', tenants: 80}
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
  return tabs.some((tab) => tab.value === value) ? (value as SettingsTab) : 'profil';
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
    <AppShell>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Gerez votre compte, votre abonnement et vos preferences de securite.</p>
      </div>

      <SettingsTabs activeTab={activeTab} />

      <StatusMessages checkout={params.checkout} error={params.error} saved={params.saved} />

      {activeTab === 'profil' ? (
        <ProfileTab email={user.email ?? profile.email ?? ''} fullName={fullName} initials={initials(fullName, user.email ?? profile.email)} locale={locale} taxRegime={workspace?.tax_regime ?? 'LMNP'} countryCode={workspace?.country_code ?? profile.country_code ?? 'FR'} />
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
    </AppShell>
  );
}

function SettingsTabs({activeTab}: {activeTab: SettingsTab}) {
  return (
    <div className="mb-8 border-b border-[var(--line-soft)]">
      <nav className="flex gap-8 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            className={[
              'shrink-0 border-b-2 px-0 pb-4 text-sm font-semibold transition',
              activeTab === tab.value ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[#33413f] hover:text-[var(--accent)]'
            ].join(' ')}
            href={tabHref(tab.value)}
            key={tab.value}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function StatusMessages({checkout, error, saved}: {checkout?: string; error?: string; saved?: string}) {
  return (
    <>
      {checkout === 'success' ? <Message tone="success">Paiement recu. Le statut peut prendre quelques secondes a se synchroniser via Stripe.</Message> : null}
      {checkout === 'cancelled' ? <Message tone="warning">Paiement annule. Vos donnees restent sur le plan gratuit.</Message> : null}
      {error ? <Message tone="danger">{errorMessages[error] ?? 'Une action de facturation a echoue.'}</Message> : null}
      {saved === 'settings' ? <Message tone="success">Parametres enregistres.</Message> : null}
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

function ProfileTab({countryCode, email, fullName, initials: avatarInitials, locale, taxRegime}: {countryCode: string; email: string; fullName: string; initials: string; locale: string; taxRegime: string}) {
  return (
    <form action={updateAccountSettingsAction} className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
      <input name="current_locale" type="hidden" value={locale} />
      <input name="country_code" type="hidden" value={countryCode} />
      <input name="locale" type="hidden" value={locale} />
      <input name="tax_regime" type="hidden" value={taxRegime} />

      <div className="flex items-center gap-6">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#89f5e7] bg-[#dde1ff] text-xl font-bold text-[#3755c3]">
          {avatarInitials}
          <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-[var(--accent)] text-sm text-white">✎</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#171d1c]">{fullName || email || 'Profil bailleur'}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Proprietaire bailleur</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-[#33413f]">
          Nom complet
          <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-[#f5faf8] px-4 text-sm font-normal" defaultValue={fullName} name="full_name" placeholder="Jean Dupont" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#33413f]">
          Email
          <input className="min-h-11 rounded-lg border border-[var(--line)] bg-[#f0f5f2] px-4 text-sm font-normal text-[var(--muted)]" defaultValue={email} disabled type="email" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#33413f]">
          Telephone
          <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] bg-[#f5faf8] px-4 text-sm font-normal" placeholder="+33 6 12 34 56 78" type="tel" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#33413f]">
          Regime fiscal
          <input className="min-h-11 rounded-lg border border-[var(--line)] bg-[#f0f5f2] px-4 text-sm font-normal text-[var(--muted)]" defaultValue={taxRegime} disabled />
        </label>
      </div>

      <div className="mt-8 flex justify-end border-t border-[var(--line-soft)] pt-6">
        <button className="focus-ring min-h-11 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-white" type="submit">
          Sauvegarder les modifications
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
  const currentPlanLabel = planLabel(currentPlan);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <section className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--line-soft)] bg-[#f0f5f2] px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold">Forfait actuel</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Details de votre engagement Loyelio</p>
            </div>
            <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-bold uppercase text-[#047857]">{currentPlan === 'free' ? 'Free' : 'Actif'}</span>
          </div>
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
            <div>
              <p className="text-3xl font-semibold text-[var(--accent)]">{currentPlan === 'free' ? '0 EUR' : currentPlanLabel}</p>
              <h3 className="mt-5 text-xl font-semibold">Plan {currentPlanLabel}</h3>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#33413f]">Votre forfait actuel controle les limites de biens, locataires, documents, stockage et photos.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {planCards.map((plan) => (
                  <form action={createCheckoutSessionAction} key={plan.plan}>
                    <input name="locale" type="hidden" value={locale} />
                    <input name="plan" type="hidden" value={plan.plan} />
                    <input name="return_path" type="hidden" value="/settings?tab=abonnement" />
                    <button className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]" type="submit">
                      {plan.plan === currentPlan ? 'Forfait actuel' : `Choisir ${plan.label}`}
                    </button>
                  </form>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--line)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#33413f]">Inclus dans votre offre</p>
              <ul className="mt-5 grid gap-4 text-sm">
                <FeatureItem>Jusqu&apos;a {limits.properties} biens immobiliers</FeatureItem>
                <FeatureItem>Jusqu&apos;a {limits.tenants} locataires</FeatureItem>
                <FeatureItem>{limits.documents} documents</FeatureItem>
                <FeatureItem>{formatBytes(limits.storageBytes)} de stockage documents</FeatureItem>
              </ul>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-5">
            <h2 className="text-lg font-semibold">Comparer les forfaits</h2>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-3">
            {planCards.map((plan) => (
              <form action={createCheckoutSessionAction} className="rounded-lg border border-[var(--line)] p-4" key={plan.plan}>
                <input name="locale" type="hidden" value={locale} />
                <input name="plan" type="hidden" value={plan.plan} />
                <input name="return_path" type="hidden" value="/settings?tab=abonnement" />
                <h3 className="font-semibold">{plan.label}</h3>
                <p className="mt-2 text-2xl font-semibold text-[var(--accent)]">{plan.price}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{plan.properties} biens · {plan.tenants} locataires · {plan.documents} documents · {plan.storage}</p>
                <button className="focus-ring mt-5 min-h-10 w-full rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" type="submit">
                  {plan.plan === currentPlan ? 'Forfait actuel' : 'Changer de forfait'}
                </button>
              </form>
            ))}
          </div>
        </section>
      </div>

      <aside className="grid gap-6 content-start">
        <section className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Mode de paiement</h2>
          <div className="mt-6 rounded-lg border border-[var(--line)] p-4 text-sm">
            <p className="font-semibold">Carte geree par Stripe</p>
            <p className="mt-1 text-[var(--muted)]">Accedez au portail client pour voir vos factures ou modifier vos coordonnees bancaires.</p>
          </div>
          {billingCustomerId ? (
            <form action={createBillingPortalSessionAction} className="mt-5">
              <input name="locale" type="hidden" value={locale} />
              <button className="focus-ring min-h-11 w-full rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]" type="submit">
                Gerer sur Stripe
              </button>
            </form>
          ) : null}
        </section>

        <section className="rounded-xl bg-[var(--accent)] p-6 text-white shadow-sm">
          <h2 className="text-lg font-semibold">Utilisation du forfait</h2>
          <UsageBar label="Biens enregistres" limit={limits.properties} usage={propertyUsage} />
          <UsageBar label="Locataires" limit={limits.tenants} usage={tenantUsage} />
          <UsageBar label="Documents" limit={limits.documents} usage={documentUsage} />
          <UsageBar label="Stockage documents" limit={limits.storageBytes} usage={storageUsage} value={`${formatBytes(storageUsage)} / ${formatBytes(limits.storageBytes)}`} />
        </section>
      </aside>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section className="rounded-xl border border-[var(--line-soft)] bg-white shadow-sm">
        <div className="border-b border-[var(--line-soft)] bg-[#f0f5f2] px-6 py-5">
          <h2 className="text-lg font-semibold">Modifier le mot de passe</h2>
        </div>
        <div className="grid gap-5 p-6">
          <label className="grid gap-2 text-sm font-medium text-[#33413f]">
            Ancien mot de passe
            <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4" placeholder="••••••••" type="password" />
          </label>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-[#33413f]">
              Nouveau mot de passe
              <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4" placeholder="••••••••" type="password" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#33413f]">
              Confirmer le nouveau mot de passe
              <input className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4" placeholder="••••••••" type="password" />
            </label>
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">Votre mot de passe doit contenir au moins 12 caracteres, une majuscule et un chiffre.</p>
          <button className="focus-ring min-h-11 w-fit rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-white" type="button">
            Mettre a jour le mot de passe
          </button>
        </div>
      </section>
      <aside className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-6 text-sm text-[#1e3a8a]">
        <h2 className="text-base font-semibold">Conseils de securite</h2>
        <ul className="mt-5 grid gap-4 leading-6">
          <li>Utilisez un gestionnaire de mots de passe pour des cles uniques.</li>
          <li>Ne partagez jamais vos codes de validation par SMS ou email.</li>
          <li>Verifiez regulierement vos sessions actives pour detecter des activites suspectes.</li>
        </ul>
      </aside>
    </div>
  );
}

function DataTab({locale, storageLimit, storageUsage}: {locale: string; storageLimit: number; storageUsage: number}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
      <div className="grid gap-6">
        <section className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Exporter vos donnees</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Telechargez une archive complete de vos biens, locataires et quittances. Utile pour vos archives personnelles ou pour changer de logiciel.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--line)] p-4">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Format JSON</p>
              <h3 className="mt-3 font-semibold">Archive complete</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Ideal pour l importation technique ou la sauvegarde brute.</p>
              <Link className="focus-ring mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white"  style={{color: '#ffffff'}} href="/api/account/export">
                Exporter en .json
              </Link>
            </div>
            <div className="rounded-lg border border-[var(--line)] p-4">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Format CSV / Excel</p>
              <h3 className="mt-3 font-semibold">Rapports comptables</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Ideal pour analyser vos chiffres sous Excel ou Numbers.</p>
              <button className="focus-ring mt-5 min-h-10 w-full rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[#171d1c]" type="button">
                Exporter en .csv
              </button>
            </div>
          </div>
        </section>

        <form action={deleteAccountAction} className="rounded-xl border border-[#ba1a1a] bg-white p-6 shadow-sm">
          <input name="locale" type="hidden" value={locale} />
          <p className="text-sm font-bold uppercase text-[#ba1a1a]">Zone de danger</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-lg font-semibold">Supprimer mon compte et mes donnees</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Cette action est irreversible. Toutes vos proprietes, baux, quittances et documents seront supprimes definitivement de nos serveurs.</p>
              <label className="mt-4 grid max-w-xs gap-2 text-sm font-medium">
                Tapez SUPPRIMER
                <input className="focus-ring min-h-10 rounded-lg border border-[var(--line)] px-3" name="confirmation" placeholder="SUPPRIMER" />
              </label>
            </div>
            <button className="focus-ring min-h-11 rounded-lg bg-[#ba1a1a] px-6 text-sm font-semibold text-white" type="submit">
              Supprimer definitivement
            </button>
          </div>
        </form>
      </div>
      <aside className="grid gap-6 content-start">
        <section className="rounded-xl border border-[var(--line-soft)] bg-[#dee4e1] p-6">
          <h2 className="text-lg font-semibold">Conservation des donnees</h2>
          <ul className="mt-5 grid gap-5 text-sm leading-5 text-[#33413f]">
            <li><span className="font-semibold">Documents legaux</span><br />Conserves selon vos besoins d archivage fiscal.</li>
            <li><span className="font-semibold">Quittances & factures</span><br />Disponibles tant que votre compte est actif.</li>
            <li><span className="font-semibold">Cookies & tracage</span><br />Limite au strict necessaire pour la session et la securite.</li>
          </ul>
          <Link className="mt-6 inline-flex text-sm font-semibold text-[var(--accent)]" href="/privacy">Consulter la Politique de Confidentialite</Link>
        </section>
        <section className="rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Stockage utilise</h2>
          <UsageBar dark={false} label="Documents (PDF/Images)" limit={storageLimit} usage={storageUsage} value={`${formatBytes(storageUsage)} / ${formatBytes(storageLimit)}`} />
          <p className="mt-5 text-sm leading-6 text-[var(--muted)]">Votre forfait actuel permet de stocker jusqu&apos;a {formatBytes(storageLimit)} de documents numerises.</p>
        </section>
      </aside>
    </div>
  );
}

function FeatureItem({children}: {children: React.ReactNode}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--accent)] text-xs text-[var(--accent)]">✓</span>
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
