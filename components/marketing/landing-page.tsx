import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';

const PRICING_PLANS = ['free', 'solo', 'plus', 'portfolio', 'custom'] as const;

export function LandingPage() {
  const locale = useLocale();
  const t = useTranslations('landing');
  const common = useTranslations('common');
  const prefix = locale === 'fr' ? '' : `/${locale}`;
  const localized = (path: string) => `${prefix}${path}`;

  return (
    <main className="bg-[var(--background)] text-[var(--foreground)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--line-soft)] bg-[var(--background)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link className="text-xl font-bold text-[var(--accent)]" href={localized('/')}>
            {common('appName')}
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a className="text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="#features">
              {t('navFeatures')}
            </a>
            <a className="text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)]" href="#pricing">
              {t('navPricing')}
            </a>
            <Link
              className="text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
              href={localized('/login')}
            >
              {t('navLogin')}
            </Link>
            <div className="flex rounded-md border border-[var(--line-soft)] bg-white p-1 text-xs font-semibold text-[var(--muted)]">
              <Link className={languageClass(locale === 'fr')} href="/fr">
                FR
              </Link>
              <Link className={languageClass(locale === 'en')} href="/en">
                EN
              </Link>
              <Link className={languageClass(locale === 'zh')} href="/zh">
                中文
              </Link>
            </div>
            <Link
              className="focus-ring rounded-md bg-[var(--accent)] px-6 py-2 text-base font-semibold !text-white transition-opacity hover:opacity-90"
              href={localized('/login')}
            >
              {t('navCta')}
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link className={mobileLanguageClass(locale === 'fr')} href="/fr">
              FR
            </Link>
            <Link className={mobileLanguageClass(locale === 'en')} href="/en">
              EN
            </Link>
            <Link className={mobileLanguageClass(locale === 'zh')} href="/zh">
              中
            </Link>
          </div>
        </div>
      </nav>

      <header className="overflow-hidden bg-white py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 md:grid-cols-2 md:px-8">
          <div className="z-10">
            <h1 className="mb-6 max-w-xl text-[30px] font-semibold leading-[38px] tracking-[-0.02em] text-[var(--foreground)] md:text-5xl md:leading-tight">
              {t('heroTitle')}
            </h1>
            <p className="mb-8 max-w-md text-base leading-6 text-[var(--muted)]">{t('heroCopy')}</p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                className="focus-ring flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-8 py-4 text-base font-semibold !text-white transition-opacity hover:opacity-90"
                href={localized('/login')}
              >
                {t('primaryCta')}
                <span aria-hidden="true">-&gt;</span>
              </Link>
              <Link
                className="focus-ring rounded-lg border border-[var(--line-soft)] px-8 py-4 text-center text-base font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--panel-muted)]"
                href={localized('/dashboard')}
              >
                {t('secondaryCta')}
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="ui-card relative z-10 rotate-1 rounded-xl bg-white p-6">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] !text-white">
                    <span aria-hidden="true" className="text-lg font-bold">
                      B
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-semibold">{t('mockupProperty')}</p>
                    <p className="text-xs font-medium text-[var(--muted)]">Paris, France</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#89f5e7] px-3 py-1 text-[11px] font-semibold text-[#00201d]">
                  {t('mockupStatus')}
                </span>
              </div>
              <div className="space-y-4">
                <MockupLine label={t('mockupMonthlyRent')} value="1 250 EUR" />
                <MockupLine accent label={t('mockupLastRent')} value={t('mockupLastRentValue')} />
                <div className="pt-2">
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--line-soft)]">
                    <div className="h-full w-4/5 bg-[var(--accent)]" />
                  </div>
                  <p className="mt-2 text-right text-xs font-medium text-[var(--muted)]">{t('mockupYield')}</p>
                </div>
              </div>
            </div>

            <div className="ui-card absolute -bottom-10 -left-10 z-20 hidden w-64 rounded-lg border border-[rgb(0_104_95_/_20%)] bg-white p-4 shadow-lg md:block">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-lg text-[var(--accent)]" aria-hidden="true">
                  DOC
                </span>
                <span className="text-xs font-medium">{t('receiptGenerated')}</span>
              </div>
              <p className="text-sm leading-5 text-[var(--muted)]">{t('receiptCopy')}</p>
              <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
                {t('downloadPdf')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="bg-[var(--background)] px-4 py-24 md:px-8" id="features">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-[30px] font-semibold leading-[38px] tracking-[-0.02em] text-[var(--foreground)]">
              {t('featuresTitle')}
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-6 text-[var(--muted)]">{t('featuresCopy')}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="ui-card overflow-hidden rounded-xl p-8 md:col-span-7">
              <div className="mb-6">
                <Symbol>BIENS</Symbol>
                <h3 className="mb-2 text-xl font-semibold leading-7">{t('featureProperties')}</h3>
                <p className="text-sm leading-5 text-[var(--muted)]">{t('featurePropertiesCopy')}</p>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 opacity-70 transition-opacity hover:opacity-100">
                <PropertyTile
                  image="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=500&q=80"
                  title="Studio Republique"
                />
                <PropertyTile
                  image="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=500&q=80"
                  title="T3 Lyon Part-Dieu"
                />
              </div>
            </div>

            <div className="ui-card rounded-xl border-none bg-[#008378] p-8 !text-white md:col-span-5">
              <Symbol light>LOYERS</Symbol>
              <h3 className="mb-2 text-xl font-semibold leading-7">{t('featureRent')}</h3>
              <p className="mb-8 text-sm leading-5 text-white/90">{t('featureRentCopy')}</p>
              <div className="space-y-3">
                <RentStatus name="M. Lambert" status={t('paid')} />
                <RentStatus overdue name="Mme. Simon" status={t('overdue')} />
              </div>
            </div>

            <div className="ui-card rounded-xl p-8 md:col-span-5">
              <Symbol>DOCS</Symbol>
              <h3 className="mb-2 text-xl font-semibold leading-7">{t('featureReceipts')}</h3>
              <p className="mb-6 text-sm leading-5 text-[var(--muted)]">{t('featureReceiptsCopy')}</p>
              <div className="space-y-2 border-l-2 border-[var(--accent)] pl-4">
                <p className="text-[11px] font-semibold leading-4 text-[var(--muted)]">{t('recentFiles')}</p>
                <p className="text-[13px] leading-[18px]">Quittance_Oct_2023.pdf</p>
                <p className="text-[13px] leading-[18px]">Bail_Location_V2.pdf</p>
                <p className="text-[13px] leading-[18px]">Etat_des_lieux_Entree.pdf</p>
              </div>
            </div>

            <div className="ui-card relative overflow-hidden rounded-xl bg-white p-8 md:col-span-7">
              <div className="flex flex-col items-start gap-8 md:flex-row">
                <div className="flex-1">
                  <Symbol>TAX</Symbol>
                  <h3 className="mb-2 text-xl font-semibold leading-7">{t('featureTax')}</h3>
                  <p className="text-sm leading-5 text-[var(--muted)]">{t('featureTaxCopy')}</p>
                  <Link
                    className="mt-6 flex items-center gap-2 text-base font-bold text-[var(--accent)] transition-transform hover:translate-x-1"
                    href={localized('/tax')}
                  >
                    {t('simulateTax')}
                    <span aria-hidden="true">-&gt;</span>
                  </Link>
                </div>
                <div className="flex w-full flex-col gap-3 rounded border border-[var(--line-soft)] bg-[var(--panel-muted)] p-4 md:w-48">
                  <div className="border-b border-[var(--line-soft)] pb-2 text-center">
                    <p className="text-[11px] font-semibold leading-4 text-[var(--muted)]">{t('annualRevenue')}</p>
                    <p className="text-xl font-semibold leading-7 text-[var(--accent)]">42 800 EUR</p>
                  </div>
                  <div className="space-y-1">
                    <MiniAmount label={t('charges')} value="3 200 EUR" />
                    <MiniAmount label={t('taxes')} value="1 450 EUR" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--panel-muted)] px-4 py-24 md:px-8" id="pricing">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="mb-4 text-[30px] font-semibold leading-[38px] tracking-[-0.02em]">{t('pricingTitle')}</h2>
          <p className="mx-auto mb-12 max-w-2xl text-base leading-6 text-[var(--muted)]">{t('pricingCopy')}</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {PRICING_PLANS.map((plan) => (
              <PricingCard
                cta={plan === 'custom' ? t('contactCta') : t('startCta')}
                description={t(`pricing.${plan}.description`)}
                featured={plan === 'solo'}
                href={plan === 'custom' ? 'mailto:contact@habitatlog.com' : localized('/login')}
                key={plan}
                name={t(`pricing.${plan}.name`)}
                popularLabel={t('popular')}
                price={t(`pricing.${plan}.price`)}
                units={t(`pricing.${plan}.units`)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-24 md:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl bg-[#2c3130] p-8 text-center !text-[#edf2f0] md:p-12">
          <h2 className="mb-6 text-[30px] font-semibold leading-[38px] tracking-[-0.02em]">{t('finalTitle')}</h2>
          <p className="mx-auto mb-10 max-w-xl text-base leading-6 opacity-80">{t('finalCopy')}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link className="rounded-lg bg-[var(--accent)] px-10 py-4 font-bold !text-white" href={localized('/login')}>
              {t('createAccount')}
            </Link>
            <a
              className="rounded-lg bg-white/10 px-10 py-4 font-bold !text-white transition-colors hover:bg-white/20"
              href="mailto:contact@habitatlog.com"
            >
              {t('contactCta')}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--line-soft)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-8 py-8 md:flex-row">
          <div className="flex flex-col items-center gap-1 md:items-start">
            <span className="text-base font-bold text-[var(--foreground)]">{common('appName')}</span>
            <p className="text-[13px] leading-[18px] text-[var(--muted)]">2026 HabitatLog - {t('footerTagline')}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link className="text-[11px] font-semibold leading-4 text-[var(--muted)] hover:text-[var(--accent)]" href={localized('/terms')}>
              {t('legal')}
            </Link>
            <Link className="text-[11px] font-semibold leading-4 text-[var(--muted)] hover:text-[var(--accent)]" href={localized('/terms')}>
              {t('terms')}
            </Link>
            <Link className="text-[11px] font-semibold leading-4 text-[var(--muted)] hover:text-[var(--accent)]" href={localized('/privacy')}>
              {t('privacy')}
            </Link>
            <a className="text-[11px] font-semibold leading-4 text-[var(--muted)] hover:text-[var(--accent)]" href="mailto:contact@habitatlog.com">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function MockupLine({accent = false, label, value}: {accent?: boolean; label: string; value: string}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line-soft)] py-2">
      <span className="text-sm leading-5 text-[var(--muted)]">{label}</span>
      <span className={accent ? 'text-sm font-bold leading-5 text-[var(--accent)]' : 'text-base font-semibold leading-6'}>
        {value}
      </span>
    </div>
  );
}

function Symbol({children, light = false}: {children: React.ReactNode; light?: boolean}) {
  return <span className={light ? 'mb-4 block text-xs font-bold tracking-[0.12em] !text-white' : 'mb-4 block text-xs font-bold tracking-[0.12em] text-[var(--accent)]'}>{children}</span>;
}

function PropertyTile({image, title}: {image: string; title: string}) {
  return (
    <div className="rounded border border-[var(--line-soft)] bg-[var(--panel-muted)] p-4">
      <div className="mb-3 h-24 overflow-hidden rounded">
        <img alt="" className="h-full w-full object-cover" src={image} />
      </div>
      <p className="text-xs font-medium text-[var(--muted)]">{title}</p>
    </div>
  );
}

function RentStatus({name, overdue = false, status}: {name: string; overdue?: boolean; status: string}) {
  return (
    <div className="flex items-center justify-between rounded bg-white/10 p-3">
      <span className="text-xs font-medium">{name}</span>
      <span className={overdue ? 'rounded bg-[#ba1a1a] px-2 py-1 text-[10px] font-bold uppercase !text-white' : 'rounded bg-white/20 px-2 py-1 text-[10px] font-bold uppercase !text-white'}>
        {status}
      </span>
    </div>
  );
}

function MiniAmount({label, value}: {label: string; value: string}) {
  return (
    <div className="flex justify-between text-[10px] font-bold">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PricingCard({
  cta,
  description,
  featured,
  href,
  name,
  popularLabel,
  price,
  units
}: {
  cta: string;
  description: string;
  featured: boolean;
  href: string;
  name: string;
  popularLabel: string;
  price: string;
  units: string;
}) {
  return (
    <div
      className={
        featured
          ? 'ui-card relative rounded-xl border-2 border-[var(--accent)] bg-white p-5 text-left'
          : 'ui-card rounded-xl bg-white p-5 text-left'
      }
    >
      {featured ? (
        <span className="absolute right-4 top-4 rounded bg-[var(--accent)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] !text-white">
          {popularLabel}
        </span>
      ) : null}
      <h3 className="text-base font-semibold">{name}</h3>
      <p className="mt-5 text-2xl font-semibold tabular-nums">{price}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">{units}</p>
      <p className="mt-4 min-h-16 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <Link
        className={
          featured
            ? 'focus-ring mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold !text-white transition-opacity hover:opacity-90'
            : 'focus-ring mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--panel-muted)]'
        }
        href={href}
      >
        {cta}
      </Link>
    </div>
  );
}

function languageClass(active: boolean) {
  return active
    ? 'rounded bg-[var(--accent)] px-2.5 py-1 !text-white'
    : 'rounded px-2.5 py-1 hover:bg-[var(--panel-muted)] hover:text-[var(--foreground)]';
}

function mobileLanguageClass(active: boolean) {
  return active
    ? 'rounded bg-[var(--accent)] px-2 py-1 text-xs font-semibold !text-white'
    : 'rounded border border-[var(--line-soft)] bg-white px-2 py-1 text-xs font-semibold text-[var(--muted)]';
}
