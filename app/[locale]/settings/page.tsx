import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {PageHeader} from '@/components/app/page-header';
import {FREE_PLAN_LIMITS, hasPaidAccess} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createBillingPortalSessionAction, createCheckoutSessionAction, deleteAccountAction, updateAccountSettingsAction} from './actions';

type SettingsPageProps = {
  searchParams: Promise<{
    checkout?: string;
    error?: string;
    saved?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  billing_customer_missing: 'Aucun client Stripe n est encore associe a cet espace.',
  checkout_failed: 'Impossible de creer la session Stripe. Reessayez dans un instant.',
  delete_confirmation: 'Saisissez SUPPRIMER pour confirmer la suppression du compte.',
  delete_failed: 'Impossible de supprimer le compte. Reessayez dans un instant.',
  settings_failed: 'Impossible d enregistrer les parametres du compte.',
  stripe_price_missing: 'Les Price IDs Stripe ne sont pas configures.'
};

export default async function SettingsPage({searchParams}: SettingsPageProps) {
  const t = await getTranslations('settings');
  const locale = await getLocale();
  const params = await searchParams;
  const {profile, supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const {data: workspace} = await supabase.from('workspaces').select('country_code, tax_regime').eq('id', workspaceId).single();
  const paid = hasPaidAccess(billing);
  const statusLabel = paid ? (billing?.plan === 'lifetime' ? 'Lifetime' : 'Pro actif') : 'Gratuit';

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {params.checkout === 'success' ? (
        <div className="mb-6 rounded-md border border-[#b8d8c5] bg-[#f0fbf3] p-4 text-sm leading-6 text-[#215d35]">
          Paiement recu. Le statut peut prendre quelques secondes a se synchroniser via Stripe.
        </div>
      ) : null}

      {params.checkout === 'cancelled' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Paiement annule. Vos donnees restent sur le plan gratuit.
        </div>
      ) : null}

      {params.error ? (
        <div className="mb-6 rounded-md border border-[#f0b6b6] bg-[#fff2f2] p-4 text-sm leading-6 text-[#842020]">
          {errorMessages[params.error] ?? 'Une action de facturation a echoue.'}
        </div>
      ) : null}

      {params.saved === 'settings' ? (
        <div className="mb-6 rounded-md border border-[#b8d8c5] bg-[#f0fbf3] p-4 text-sm leading-6 text-[#215d35]">
          Parametres enregistres.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <form action={updateAccountSettingsAction} className="rounded-lg border border-[var(--line)] bg-white p-5">
            <input name="current_locale" type="hidden" value={locale} />
            <h2 className="text-lg font-semibold">Compte</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium">
                {t('country')}
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue={workspace?.country_code ?? profile.country_code ?? 'FR'} name="country_code">
                  <option value="FR">France</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                {t('locale')}
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue={profile.locale ?? locale} name="locale">
                  <option value="fr">Francais</option>
                  <option value="en">English</option>
                  <option value="zh">Chinese</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Regime fiscal
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue={workspace?.tax_regime ?? 'LMNP'} name="tax_regime">
                  <option value="LMNP">LMNP</option>
                </select>
              </label>
            </div>
            <button className="focus-ring mt-5 min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
              Enregistrer
            </button>
          </form>

          <section className="rounded-lg border border-[var(--line)] bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{t('billing')}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Statut actuel: <span className="font-semibold text-[var(--foreground)]">{statusLabel}</span>
                </p>
              </div>
              {billing?.stripe_customer_id ? (
                <form action={createBillingPortalSessionAction}>
                  <input name="locale" type="hidden" value={locale} />
                  <button className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f2f0ea]" type="submit">
                    Ouvrir Stripe
                  </button>
                </form>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <form action={createCheckoutSessionAction} className="rounded-md border border-[var(--line)] p-4">
                <input name="locale" type="hidden" value={locale} />
                <input name="plan" type="hidden" value="subscription" />
                <h3 className="font-semibold">Pro annuel</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Debloque les biens, locataires, documents et exports fiscaux au-dela du plan gratuit.</p>
                <button className="focus-ring mt-4 min-h-11 w-full rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white" type="submit">
                  Passer a Pro
                </button>
              </form>

              <form action={createCheckoutSessionAction} className="rounded-md border border-[var(--line)] p-4">
                <input name="locale" type="hidden" value={locale} />
                <input name="plan" type="hidden" value="lifetime" />
                <h3 className="font-semibold">Lifetime</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Un paiement unique pour garder l acces Pro sur cet espace bailleur.</p>
                <button className="focus-ring mt-4 min-h-11 w-full rounded-md border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[#eef8f5]" type="submit">
                  Acheter lifetime
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-lg font-semibold">Donnees</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[var(--line)] p-4">
                <h3 className="font-semibold">Export du compte</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Telechargez les donnees structurees de votre espace en JSON.</p>
                <Link className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f2f0ea]" href="/api/account/export">
                  Exporter mes donnees
                </Link>
              </div>

              <form action={deleteAccountAction} className="rounded-md border border-[#efd0ca] p-4">
                <input name="locale" type="hidden" value={locale} />
                <h3 className="font-semibold text-[#9d2f1f]">Supprimer le compte</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Cette action supprime le compte, l espace bailleur et les donnees associees.</p>
                <label className="mt-4 grid gap-2 text-sm font-medium">
                  Tapez SUPPRIMER
                  <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="confirmation" placeholder="SUPPRIMER" />
                </label>
                <button className="focus-ring mt-4 min-h-11 rounded-md border border-[#efd0ca] px-4 text-sm font-semibold text-[#9d2f1f] hover:bg-[#fff4f1]" type="submit">
                  Supprimer definitivement
                </button>
              </form>
            </div>
          </section>
        </div>

        <aside className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-lg font-semibold">Limites gratuites</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--muted)]">Biens</dt>
              <dd className="font-semibold">{FREE_PLAN_LIMITS.properties}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--muted)]">Locataires</dt>
              <dd className="font-semibold">{FREE_PLAN_LIMITS.tenants}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--muted)]">Documents</dt>
              <dd className="font-semibold">{FREE_PLAN_LIMITS.documents}</dd>
            </div>
          </dl>
          <p className="mt-5 text-sm leading-6 text-[var(--muted)]">Les exports fiscaux et les donnees existantes restent disponibles sur le plan gratuit.</p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-medium text-[var(--accent)]">
            <Link href="/privacy">Confidentialite</Link>
            <Link href="/terms">Conditions</Link>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
