'use client';

import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import {useMemo, useState} from 'react';

const PAID_PLANS = [
  {key: 'solo', monthly: 4.9, yearly: 39},
  {key: 'plus', monthly: 7.9, yearly: 59},
  {key: 'portfolio', monthly: 11.9, yearly: 89}
] as const;

const ALL_PLANS = ['free', ...PAID_PLANS.map((plan) => plan.key), 'custom'] as const;
type BillingCycle = 'monthly' | 'yearly';
type PlanKey = (typeof ALL_PLANS)[number];

function discountPercent(monthly: number, yearly: number) {
  return ((monthly * 12 - yearly) / (monthly * 12)) * 100;
}

function euro(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: 'EUR',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    style: 'currency'
  }).format(value);
}

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: 'percent'
  }).format(value / 100);
}

export function PricingSection() {
  const locale = useLocale();
  const t = useTranslations('landing');
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const prefix = `/${locale}`;
  const localized = (path: string) => `${prefix}${path}`;
  const bestDiscount = useMemo(() => Math.max(...PAID_PLANS.map((plan) => discountPercent(plan.monthly, plan.yearly))), []);

  return (
    <section className="bg-[var(--panel-muted)] px-4 py-24 md:px-8" id="pricing">
      <div className="mx-auto max-w-7xl text-center">
        <h2 className="mb-4 text-[30px] font-semibold leading-[38px] tracking-[-0.02em]">{t('pricingTitle')}</h2>
        <p className="mx-auto max-w-2xl text-base leading-6 text-[var(--muted)]">{t('pricingCopy')}</p>

        <div className="mx-auto mt-8 flex w-fit flex-col items-center gap-3">
          <div className="inline-flex rounded-lg border border-[var(--line)] bg-white p-1 shadow-sm">
            <button
              className={`focus-ring min-h-10 rounded-md px-5 text-sm font-semibold transition ${cycle === 'monthly' ? 'bg-[var(--accent)] text-white' : 'text-[#33413f] hover:bg-[#f0f5f2]'}`}
              onClick={() => setCycle('monthly')}
              style={cycle === 'monthly' ? {color: '#ffffff'} : undefined}
              type="button"
            >
              {t('billing.monthly')}
            </button>
            <button
              className={`focus-ring min-h-10 rounded-md px-5 text-sm font-semibold transition ${cycle === 'yearly' ? 'bg-[var(--accent)] text-white' : 'text-[#33413f] hover:bg-[#f0f5f2]'}`}
              onClick={() => setCycle('yearly')}
              style={cycle === 'yearly' ? {color: '#ffffff'} : undefined}
              type="button"
            >
              {t('billing.yearly')}
            </button>
          </div>
          <p className="rounded-full bg-[#e6f4f1] px-4 py-1.5 text-xs font-bold text-[var(--accent)]">
            {t('billing.discountBadge', {discount: formatPercent(bestDiscount, locale)})}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {ALL_PLANS.map((plan) => (
            <PricingCard
              billingCycle={cycle}
              cta={plan === 'custom' ? t('contactCta') : t('startCta')}
              description={t(`pricing.${plan}.description`)}
              featured={plan === 'solo'}
              href={plan === 'custom' ? localized('/contact') : `${localized('/login')}?plan=${plan}&billing=${cycle}`}
              key={plan}
              locale={locale}
              name={t(`pricing.${plan}.name`)}
              popularLabel={t('popular')}
              plan={plan}
              units={t(`pricing.${plan}.units`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function priceForPlan(plan: PlanKey) {
  return PAID_PLANS.find((item) => item.key === plan);
}

function PricingCard({
  billingCycle,
  cta,
  description,
  featured,
  href,
  locale,
  name,
  plan,
  popularLabel,
  units
}: {
  billingCycle: BillingCycle;
  cta: string;
  description: string;
  featured: boolean;
  href: string;
  locale: string;
  name: string;
  plan: PlanKey;
  popularLabel: string;
  units: string;
}) {
  const t = useTranslations('landing');
  const paidPlan = priceForPlan(plan);
  const discount = paidPlan ? discountPercent(paidPlan.monthly, paidPlan.yearly) : 0;
  const equivalentMonthly = paidPlan ? paidPlan.yearly / 12 : 0;
  const price =
    plan === 'free'
      ? t('pricing.free.price')
      : plan === 'custom'
        ? t('pricing.custom.price')
        : billingCycle === 'monthly'
          ? t('billing.monthlyPrice', {price: euro(paidPlan?.monthly ?? 0, locale)})
          : t('billing.yearlyPrice', {price: euro(paidPlan?.yearly ?? 0, locale)});

  return (
    <div className={featured ? 'ui-card relative rounded-xl border-2 border-[var(--accent)] bg-white p-5 text-left' : 'ui-card rounded-xl bg-white p-5 text-left'}>
      {featured ? (
        <span className="absolute right-4 top-4 rounded bg-[var(--accent)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] !text-white">
          {popularLabel}
        </span>
      ) : null}
      <h3 className="text-base font-semibold">{name}</h3>
      <p className="mt-5 text-2xl font-semibold tabular-nums">{price}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">{units}</p>
      {paidPlan ? (
        <div className="mt-4 grid gap-2 rounded-lg bg-[#f0f7f5] p-3 text-xs leading-5">
          <p className="font-bold text-[var(--accent)]">{t('billing.savePercent', {discount: formatPercent(discount, locale)})}</p>
          <p className="text-[#33413f]">{t('billing.equivalentMonthly', {price: euro(equivalentMonthly, locale)})}</p>
        </div>
      ) : (
        <div className="mt-4 min-h-[74px] rounded-lg bg-[#f8fbfa] p-3 text-xs leading-5 text-[var(--muted)]">{t(`pricing.${plan}.note`)}</div>
      )}
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
