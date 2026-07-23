import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {RevenueExpenseChart} from './revenue-expense-chart';

type DashboardProperty = {
  address_line1: string | null;
  city: string | null;
  id: string;
  name: string;
  postal_code: string | null;
  property_photos: {
    file_path: string;
    is_cover: boolean;
  }[];
  leases: {
    charges_amount: number;
    end_date: string | null;
    monthly_rent: number;
    start_date: string | null;
    status: string;
    tenants: {
      full_name: string;
    } | null;
  }[];
};

type RentCharge = {
  id: string;
  status: string;
  total_due: number;
  period_month: string;
  rent_payments: {
    amount: number | null;
    notes: string | null;
  }[];
  leases: {
    end_date: string | null;
    properties: {
      name: string;
    } | null;
    start_date: string | null;
    status: string;
    tenants: {
      full_name: string;
    } | null;
  } | null;
};

type ChartPayment = {
  amount: number;
  notes: string | null;
  paid_at: string;
};

type ChartExpense = {
  amount: number;
  expense_date: string;
};

type DashboardExpense = {
  amount: number;
  description: string | null;
  expense_date: string;
  property_id: string | null;
  receipt_status: string;
  vendor: string | null;
};

const defaultApartmentPhoto = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80';
const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function currentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function addMonths(date: Date, offset: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function buildRecentMonths() {
  const now = new Date();
  const currentMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  return Array.from({length: 6}, (_, index) => {
    const date = addMonths(currentMonth, index - 5);

    return {
      end: addMonths(date, 1).toISOString().slice(0, 10),
      key: monthKey(date),
      label: monthLabels[date.getUTCMonth()],
      start: date.toISOString().slice(0, 10)
    };
  });
}

function formatMoney(value: number) {
  return `${value.toLocaleString('fr-FR', {maximumFractionDigits: 0})} €`;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function formatTrend(value: number) {
  if (value === 0) {
    return '0%';
  }

  return `${value > 0 ? '+' : ''}${value}%`;
}

function formatAddress(property: Pick<DashboardProperty, 'address_line1' | 'postal_code' | 'city'>) {
  return [property.address_line1, property.postal_code, property.city].filter(Boolean).join(', ');
}

function isLeaseCurrentlyEffective(lease: Pick<DashboardProperty['leases'][number], 'end_date' | 'start_date' | 'status'> | null | undefined, today: string) {
  return Boolean(lease && lease.status === 'active' && (!lease.start_date || lease.start_date <= today) && (!lease.end_date || lease.end_date >= today));
}

function isUnpaidStatus(status: string) {
  return status === 'unpaid' || status === 'overdue' || status === 'late';
}

function remainingAmount(charge: Pick<RentCharge, 'rent_payments' | 'total_due'>) {
  const paidAmount = charge.rent_payments.filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return Math.max(0, Number(charge.total_due ?? 0) - paidAmount);
}

function isRentPayment(payment: {notes?: string | null}) {
  return !payment.notes?.startsWith('[[loyelio:revenue_type=deposit]]') && !payment.notes?.startsWith('[[loyelio:revenue_type=other]]');
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const t = await getTranslations('dashboard');
  const propertiesT = await getTranslations('properties');
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const month = currentMonthStart();
  const previousMonth = addMonths(new Date(`${month}T00:00:00.000Z`), -1).toISOString().slice(0, 10);
  const monthEnd = addMonths(new Date(`${month}T00:00:00.000Z`), 1).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const alertWindowEnd = addMonths(new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`), 3).toISOString().slice(0, 10);
  const chartMonths = buildRecentMonths();
  const chartStart = chartMonths[0]?.start ?? month;
  const chartEnd = chartMonths[chartMonths.length - 1]?.end ?? month;
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const currentPlan = normalizeBillingPlan(hasPaidAccess(billing) ? billing?.plan : 'free');
  const hasAdvancedDashboard = currentPlan === 'plus' || currentPlan === 'portfolio';
  const {data: properties} = await supabase
    .from('properties')
    .select('id, name, address_line1, postal_code, city, property_photos(file_path, is_cover), leases(status, start_date, end_date, monthly_rent, charges_amount, tenants(full_name))')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .returns<DashboardProperty[]>();
  const {data: rentCharges} = await supabase
    .from('rent_charges')
    .select('id, status, total_due, period_month, rent_payments(amount, notes), leases(status, start_date, end_date, tenants(full_name), properties(name))')
    .eq('workspace_id', workspaceId)
    .eq('period_month', month)
    .order('created_at', {ascending: false})
    .returns<RentCharge[]>();
  const {data: trendRentCharges} = await supabase
    .from('rent_charges')
    .select('id, status, total_due, period_month, rent_payments(amount, notes), leases(status, start_date, end_date, tenants(full_name), properties(name))')
    .eq('workspace_id', workspaceId)
    .gte('period_month', chartStart)
    .lt('period_month', chartEnd)
    .returns<RentCharge[]>();
  const {data: currentPayments} = await supabase
    .from('rent_payments')
    .select('amount, paid_at, notes')
    .eq('workspace_id', workspaceId)
    .gte('paid_at', month)
    .lt('paid_at', monthEnd)
    .returns<ChartPayment[]>();
  const {data: previousPayments} = await supabase
    .from('rent_payments')
    .select('amount, paid_at, notes')
    .eq('workspace_id', workspaceId)
    .gte('paid_at', previousMonth)
    .lt('paid_at', month)
    .returns<ChartPayment[]>();
  const {data: chartPayments} = await supabase
    .from('rent_payments')
    .select('paid_at, amount, notes')
    .eq('workspace_id', workspaceId)
    .gte('paid_at', chartStart)
    .lt('paid_at', chartEnd)
    .returns<ChartPayment[]>();
  const {data: chartExpenses} = await supabase
    .from('expenses')
    .select('expense_date, amount')
    .eq('workspace_id', workspaceId)
    .gte('expense_date', chartStart)
    .lt('expense_date', chartEnd)
    .returns<ChartExpense[]>();
  const {data: currentExpenses} = await supabase
    .from('expenses')
    .select('expense_date, amount, property_id, receipt_status, vendor, description')
    .eq('workspace_id', workspaceId)
    .gte('expense_date', month)
    .lt('expense_date', monthEnd)
    .returns<DashboardExpense[]>();
  const {data: previousExpenses} = await supabase
    .from('expenses')
    .select('expense_date, amount, property_id, receipt_status, vendor, description')
    .eq('workspace_id', workspaceId)
    .gte('expense_date', previousMonth)
    .lt('expense_date', month)
    .returns<DashboardExpense[]>();
  const rows = properties ?? [];
  const charges = rentCharges ?? [];
  const revenueByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();
  (chartPayments ?? []).filter(isRentPayment).forEach((payment) => {
    const key = payment.paid_at.slice(0, 7);
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(payment.amount ?? 0));
  });
  (chartExpenses ?? []).forEach((expense) => {
    const key = expense.expense_date.slice(0, 7);
    expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + Number(expense.amount ?? 0));
  });
  const chartPoints = chartMonths.map((chartMonth) => ({
    expense: expenseByMonth.get(chartMonth.key) ?? 0,
    label: chartMonth.label,
    revenue: revenueByMonth.get(chartMonth.key) ?? 0,
    cashFlow: (revenueByMonth.get(chartMonth.key) ?? 0) - (expenseByMonth.get(chartMonth.key) ?? 0)
  }));
  const advancedChartPoints = chartPoints.filter((point) => point.revenue > 0 || point.expense > 0);
  const trendChargesByMonth = new Map<string, RentCharge[]>();
  (trendRentCharges ?? []).forEach((charge) => {
    const key = charge.period_month.slice(0, 7);
    trendChargesByMonth.set(key, [...(trendChargesByMonth.get(key) ?? []), charge]);
  });
  const unpaidTrendPoints = chartMonths
    .map((chartMonth) => {
      const monthCharges = trendChargesByMonth.get(chartMonth.key) ?? [];

      return {
        label: chartMonth.label,
        value: monthCharges.filter((charge) => isUnpaidStatus(charge.status)).reduce((sum, charge) => sum + remainingAmount(charge), 0),
        hasData: monthCharges.length > 0
      };
    })
    .filter((point) => point.hasData);
  const firstUnpaidTrendValue = unpaidTrendPoints[0]?.value ?? 0;
  const lastUnpaidTrendValue = unpaidTrendPoints[unpaidTrendPoints.length - 1]?.value ?? 0;
  const unpaidTrendChange = unpaidTrendPoints.length > 1 ? percentChange(lastUnpaidTrendValue, firstUnpaidTrendValue) : 0;
  const activeLeaseCount = rows.reduce((sum, property) => sum + property.leases.filter((lease) => isLeaseCurrentlyEffective(lease, today)).length, 0);
  const currentEffectiveCharges = charges.filter((charge) => isLeaseCurrentlyEffective(charge.leases, today));
  const paidTotal = (currentPayments ?? []).filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const previousPaidTotal = (previousPayments ?? []).filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const currentExpenseTotal = (currentExpenses ?? []).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const previousExpenseTotal = (previousExpenses ?? []).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const cashFlowTotal = paidTotal - currentExpenseTotal;
  const previousCashFlowTotal = previousPaidTotal - previousExpenseTotal;
  const pendingTotal = currentEffectiveCharges
    .filter((charge) => charge.status !== 'paid' && charge.status !== 'waived' && !isUnpaidStatus(charge.status))
    .reduce((sum, charge) => sum + remainingAmount(charge), 0);
  const unpaidTotal = currentEffectiveCharges.filter((charge) => isUnpaidStatus(charge.status)).reduce((sum, charge) => sum + remainingAmount(charge), 0);
  const occupiedProperties = rows.filter((property) => property.leases.some((lease) => isLeaseCurrentlyEffective(lease, today))).length;
  const occupancyRate = rows.length ? Math.round((occupiedProperties / rows.length) * 100) : 0;
  const expiringLeases = rows
    .flatMap((property) =>
      property.leases
        .filter((lease) => lease.status === 'active' && lease.end_date && lease.end_date >= today && lease.end_date <= alertWindowEnd)
        .map((lease) => ({...lease, propertyName: property.name}))
    )
    .sort((a, b) => String(a.end_date).localeCompare(String(b.end_date)));
  const missingReceipts = (currentExpenses ?? []).filter((expense) => expense.receipt_status === 'missing');
  const unpaidCharges = currentEffectiveCharges.filter((charge) => isUnpaidStatus(charge.status) && remainingAmount(charge) > 0);
  const propertyPerformance = rows.slice(0, 5).map((property) => {
    const propertyCharges = currentEffectiveCharges.filter((charge) => charge.leases?.properties?.name === property.name);
    const revenue = propertyCharges.reduce((sum, charge) => {
      const paidAmount = charge.rent_payments.filter(isRentPayment).reduce((total, payment) => total + Number(payment.amount ?? 0), 0);
      return sum + paidAmount;
    }, 0);
    const expenses = (currentExpenses ?? []).filter((expense) => expense.property_id === property.id).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

    return {
      cashFlow: revenue - expenses,
      expenses,
      id: property.id,
      name: property.name,
      revenue,
      status: revenue - expenses < 0 || propertyCharges.some((charge) => isUnpaidStatus(charge.status)) ? t('advanced.status.watch') : t('advanced.status.stable')
    };
  });
  const receiptCoverage = currentExpenses?.length ? Math.round(((currentExpenses.length - missingReceipts.length) / currentExpenses.length) * 100) : 100;
  const signedPhotos = new Map<string, string>();

  await Promise.all(
    rows.map(async (property) => {
      const cover = property.property_photos.find((photo) => photo.is_cover) ?? property.property_photos[0];

      if (!cover) {
        return;
      }

      const {data} = await supabase.storage.from('property-photos').createSignedUrl(cover.file_path, 60 * 5);

      if (data?.signedUrl) {
        signedPhotos.set(property.id, data.signedUrl);
      }
    })
  );

  if (hasAdvancedDashboard) {
    return (
      <AdvancedDashboard
        activeLeaseCount={activeLeaseCount}
        cashFlowTotal={cashFlowTotal}
        cashFlowTrend={percentChange(cashFlowTotal, previousCashFlowTotal)}
        chartPoints={advancedChartPoints}
        collectionHref={
          currentPlan === 'portfolio'
            ? `/collections?month=${month.slice(0, 7)}&view=open`
            : `/tenants?month=${month.slice(0, 7)}&view=overdue`
        }
        expiringLeases={expiringLeases}
        missingReceiptsCount={missingReceipts.length}
        occupancyRate={occupancyRate}
        paidTotal={paidTotal}
        pendingTotal={pendingTotal}
        plan={currentPlan}
        propertyPerformance={propertyPerformance}
        receiptCoverage={receiptCoverage}
        t={t}
        unpaidCharges={unpaidCharges}
        unpaidTotal={unpaidTotal}
        unpaidTrendChange={unpaidTrendChange}
        unpaidTrendPoints={unpaidTrendPoints}
        revenueTrend={percentChange(paidTotal, previousPaidTotal)}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('overviewSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="focus-ring inline-flex min-h-10 items-center rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-semibold" href="/documents">
            {t('report')}
          </Link>
          <Link className="focus-ring inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" href="/properties?new=1" style={{color: '#ffffff'}}>
            + {propertiesT('newProperty')}
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard href="/transactions" icon="payments" tone="primary" label={t('metrics.collectedRent')} value={formatMoney(paidTotal)} />
        <MetricCard href="/tenants" icon="hourglass_empty" tone="secondary" label={t('metrics.pending')} value={formatMoney(pendingTotal)} />
        <MetricCard href="/tenants" icon="warning" tone="error" label={t('metrics.unpaid')} value={formatMoney(unpaidTotal)} />
        <MetricCard href="/bail" icon="home_work" tone="primary" label={t('metrics.activeRentals')} value={activeLeaseCount.toString()} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          <RevenueExpenseChart points={chartPoints} />

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('createdProperties')}</h2>
              <Link className="text-sm font-semibold text-[var(--accent)]" href="/properties">
                {t('viewAll')}
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {rows.length ? (
                rows.map((property) => {
                  const activeLeases = property.leases.filter((lease) => isLeaseCurrentlyEffective(lease, today));
                  const propertyRentTotal = activeLeases.reduce((sum, lease) => sum + Number(lease.monthly_rent ?? 0) + Number(lease.charges_amount ?? 0), 0);
                  const photoUrl = signedPhotos.get(property.id) ?? defaultApartmentPhoto;

                  return (
                    <Link className="group overflow-hidden rounded-xl border border-[var(--line-soft)] bg-white shadow-sm transition hover:bg-[#f8fbfa]" href={`/properties/${property.id}`} key={property.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" className="h-36 w-full object-cover" src={photoUrl} />
                      <div className="p-5">
                        <h3 className="truncate text-base font-semibold">{property.name}</h3>
                        <p className="mt-1 truncate text-sm text-[var(--muted)]">{formatAddress(property) || propertiesT('addressMissing')}</p>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <span className={activeLeases.length ? 'rounded bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#047857]' : 'rounded bg-[#eef2ff] px-2.5 py-1 text-xs font-semibold text-[#3755c3]'}>
                            {activeLeases.length ? propertiesT('status.rented') : propertiesT('status.vacant')}
                          </span>
                          <span className="text-sm font-bold text-[var(--accent)] tabular-nums">{activeLeases.length ? t('perMonth', {amount: formatMoney(propertyRentTotal)}) : t('none')}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-xl border border-[var(--line-soft)] bg-white p-6 text-sm text-[var(--muted)] md:col-span-2">{t('noProperties')}</div>
              )}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <section className="rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('quickActions')}</h2>
              <span className="text-sm text-[var(--muted)]">{t('checklist')}</span>
            </div>
            <div className="mt-5 grid gap-3">
              <QuickAction href="/properties?new=1" label={t('quick.createProperty')} note={t('quick.createPropertyNote')} />
              <QuickAction href="/tenants?new=1" label={t('quick.addTenant')} note={t('quick.addTenantNote')} />
              <QuickAction href="/bail" label={t('quick.createLease')} note={t('quick.createLeaseNote')} />
              <QuickAction href="/transactions?new=transaction" label={t('quick.addTransaction')} note={t('quick.addTransactionNote')} />
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}

type AdvancedDashboardProps = {
  activeLeaseCount: number;
  cashFlowTotal: number;
  cashFlowTrend: number;
  chartPoints: {
    cashFlow: number;
    expense: number;
    label: string;
    revenue: number;
  }[];
  collectionHref: string;
  expiringLeases: {
    end_date: string | null;
    propertyName: string;
    tenants: {
      full_name: string;
    } | null;
  }[];
  missingReceiptsCount: number;
  occupancyRate: number;
  paidTotal: number;
  pendingTotal: number;
  plan: 'plus' | 'portfolio';
  propertyPerformance: {
    cashFlow: number;
    expenses: number;
    id: string;
    name: string;
    revenue: number;
    status: string;
  }[];
  receiptCoverage: number;
  t: Awaited<ReturnType<typeof getTranslations>>;
  unpaidCharges: RentCharge[];
  unpaidTotal: number;
  unpaidTrendChange: number;
  unpaidTrendPoints: {
    hasData: boolean;
    label: string;
    value: number;
  }[];
  revenueTrend: number;
};

function AdvancedDashboard({activeLeaseCount, cashFlowTotal, cashFlowTrend, chartPoints, collectionHref, expiringLeases, missingReceiptsCount, occupancyRate, paidTotal, plan, propertyPerformance, receiptCoverage, t, unpaidCharges, unpaidTotal, unpaidTrendChange, unpaidTrendPoints, revenueTrend}: AdvancedDashboardProps) {
  const firstUnpaid = unpaidCharges[0];
  const firstExpiring = expiringLeases[0];
  const planLabel = plan === 'portfolio' ? 'Portfolio' : 'Plus';

  return (
    <div className="-mx-5 -my-8 bg-[#f5f9f7] px-4 pb-10 pt-7 text-[#17201e] sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex rounded-md bg-[#e5f6ef] px-2.5 py-1 text-xs font-semibold text-[#006f61]">{planLabel}</div>
            <h1 className="mt-3 text-[28px] font-bold leading-[1.2] tracking-[-0.02em] text-[#17201e]">{t('advanced.title', {plan: planLabel})}</h1>
            <p className="mt-2 text-sm leading-6 text-[#66736f]">{t('advanced.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="focus-ring inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#dce5e1] bg-white px-5 text-sm font-semibold shadow-sm hover:bg-[#f5faf8]" href="/tax">
              <span className="material-symbols-outlined text-[20px]">ios_share</span>
              {t('advanced.export')}
            </Link>
            <Link className="focus-ring inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#006f61] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#00574f]" href="/properties?new=1" style={{color: '#ffffff'}}>
              <span className="material-symbols-outlined text-[20px]">add</span>
              {t('advanced.newProperty')}
            </Link>
          </div>
        </div>

        <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <AdvancedMetric icon="account_balance_wallet" label={t('advanced.kpis.revenue')} note={t('advanced.vsLastMonth', {value: formatTrend(revenueTrend)})} tone="primary" value={formatMoney(paidTotal)} />
          <AdvancedMetric icon="trending_up" label={t('advanced.kpis.cashFlow')} note={t('advanced.vsLastMonth', {value: formatTrend(cashFlowTrend)})} tone="primary" value={formatMoney(cashFlowTotal)} />
          <AdvancedMetric href={collectionHref} icon="warning" label={t('advanced.kpis.unpaid')} note={t('advanced.unpaidCount', {count: unpaidCharges.length})} tone="error" value={formatMoney(unpaidTotal)} />
          <AdvancedMetric icon="pie_chart" label={t('advanced.kpis.occupancy')} note={t('advanced.activeRentals', {count: activeLeaseCount})} tone="primary" value={`${occupancyRate}%`} />
          <AdvancedMetric icon="event_upcoming" label={t('advanced.kpis.leasesWatch')} note={t('advanced.inSixtyDays')} tone="neutral" value={String(expiringLeases.length)} />
        </section>

        <section className="mt-6 grid gap-6 min-[1100px]:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="grid content-start gap-6">
            <MonthlyTrendCard points={chartPoints} t={t} />
            <PerformanceTable rows={propertyPerformance} t={t} />
            <UnpaidEvolutionCard points={unpaidTrendPoints} t={t} trendChange={unpaidTrendChange} />
          </div>

          <aside className="grid content-start gap-6">
            <InsightCard
              items={[
                {
                  icon: 'trending_up',
                  title: revenueTrend >= 0 ? t('advanced.insights.revenueUp') : t('advanced.insights.revenueDown'),
                  text: t('advanced.insights.revenueText', {value: formatTrend(revenueTrend)})
                },
                {
                  icon: 'schedule',
                  title: t('advanced.insights.paymentFollowup', {count: unpaidCharges.length}),
                  text: firstUnpaid ? t('advanced.insights.paymentText', {amount: formatMoney(remainingAmount(firstUnpaid)), tenant: firstUnpaid.leases?.tenants?.full_name ?? t('advanced.tenantFallback')}) : t('advanced.insights.noPaymentText')
                },
                {
                  icon: 'description',
                  title: t('advanced.insights.missingReceipts', {count: missingReceiptsCount}),
                  text: t('advanced.insights.receiptCoverage', {value: receiptCoverage})
                }
              ]}
              t={t}
            />
            <AlertCard collectionHref={collectionHref} expiringLease={firstExpiring} firstUnpaid={firstUnpaid} missingReceiptsCount={missingReceiptsCount} t={t} />
            <RecommendedActions t={t} />
          </aside>
        </section>
      </div>
    </div>
  );
}

function AdvancedMetric({href, icon, label, note, tone, value}: {href?: string; icon: string; label: string; note: string; tone: 'error' | 'neutral' | 'primary'; value: string}) {
  const toneClass = {
    error: 'bg-[#ffdad6]/70 text-[#ba1a1a]',
    neutral: 'bg-[#eaf3ef] text-[#006f61]',
    primary: 'bg-[#e5f6ef] text-[#00796b]'
  };
  const valueClass = tone === 'error' ? 'text-[#ba1a1a]' : 'text-[#17201e]';

  const content = (
    <>
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${toneClass[tone]}`}>
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
      </div>
      <p className="text-sm font-medium leading-[1.4] text-[#53615e]">{label}</p>
      <p className={`mt-1 text-[24px] font-semibold leading-[1.2] tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-2 text-xs leading-[1.4] text-[#66736f]">{note}</p>
    </>
  );

  return href ? (
    <Link className="focus-ring rounded-xl border border-[#dce5e1] bg-white p-5 shadow-[0_2px_6px_rgba(20,45,38,0.07)] transition hover:border-[#9fc9be] hover:bg-[#fbfdfc]" href={href}>
      {content}
    </Link>
  ) : (
    <section className="rounded-xl border border-[#dce5e1] bg-white p-5 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">{content}</section>
  );
}

function MonthlyTrendCard({points, t}: {points: AdvancedDashboardProps['chartPoints']; t: AdvancedDashboardProps['t']}) {
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.revenue, point.expense, Math.abs(point.cashFlow)]));

  return (
    <section className="rounded-xl border border-[#dce5e1] bg-white p-6 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#17201e]">{t('advanced.trend.title')}</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          <Legend color="#65cdb7" label={t('chart.revenue')} />
          <Legend color="#ef5b60" label={t('chart.expenses')} />
          <Legend color="#006f61" label={t('advanced.trend.cashFlow')} line />
        </div>
      </div>
      {points.length ? (
        <div className="mt-6 h-[260px] w-full overflow-hidden">
          <div className="flex h-full items-end gap-4 border-b border-[#dce5e1] pb-8">
            {points.map((point) => {
              const revenueHeight = point.revenue > 0 ? Math.max(6, (point.revenue / maxValue) * 170) : 0;
              const expenseHeight = point.expense > 0 ? Math.max(6, (point.expense / maxValue) * 170) : 0;
              const cashFlowTop = 180 - Math.max(0, (point.cashFlow / maxValue) * 150);

              return (
                <div className="relative flex min-w-0 flex-1 items-end justify-center gap-2" key={point.label}>
                  <div className="w-5 rounded-t-sm bg-[#65cdb7]" style={{height: `${revenueHeight}px`}} title={`${t('chart.revenue')} ${formatMoney(point.revenue)}`} />
                  <div className="w-5 rounded-t-sm bg-[#ef5b60]" style={{height: `${expenseHeight}px`}} title={`${t('chart.expenses')} ${formatMoney(point.expense)}`} />
                  <span className="absolute h-2.5 w-2.5 rounded-full bg-[#006f61] shadow-sm" style={{bottom: `${cashFlowTop}px`}} title={`${t('advanced.trend.cashFlow')} ${formatMoney(point.cashFlow)}`} />
                  <span className="absolute -bottom-7 text-xs font-medium text-[#53615e]">{point.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <NoDataMessage label={t('advanced.noData')} />
      )}
    </section>
  );
}

function NoDataMessage({label}: {label: string}) {
  return <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#dce5e1] bg-[#f8fbfa] text-sm font-medium text-[#66736f]">{label}</div>;
}

function Legend({color, label, line = false}: {color: string; label: string; line?: boolean}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[#53615e]">
      <span className={line ? 'h-0.5 w-4 rounded-full' : 'h-2.5 w-2.5 rounded-sm'} style={{background: color}} />
      {label}
    </span>
  );
}

function PerformanceTable({rows, t}: {rows: AdvancedDashboardProps['propertyPerformance']; t: AdvancedDashboardProps['t']}) {
  return (
    <section className="rounded-xl border border-[#dce5e1] bg-white p-6 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
      <h2 className="text-base font-semibold text-[#17201e]">{t('advanced.performance.title')}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#dce5e1] text-left text-xs font-semibold uppercase tracking-[0.03em] text-[#53615e]">
              <th className="py-3 pr-4">{t('advanced.performance.property')}</th>
              <th className="px-4 py-3 text-right">{t('chart.revenue')}</th>
              <th className="px-4 py-3 text-right">{t('chart.expenses')}</th>
              <th className="px-4 py-3 text-right">{t('advanced.trend.cashFlow')}</th>
              <th className="py-3 pl-4 text-right">{t('advanced.performance.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2ef]">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 font-semibold text-[#17201e]">{row.name}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[#006f61]">{formatMoney(row.revenue)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[#ba1a1a]">{formatMoney(row.expenses)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#17201e]">{formatMoney(row.cashFlow)}</td>
                  <td className="py-3 pl-4 text-right">
                    <span className={row.status === t('advanced.status.watch') ? 'rounded-full bg-[#fff4df] px-3 py-1 text-xs font-semibold text-[#9a5b00]' : 'rounded-full bg-[#e4f7ed] px-3 py-1 text-xs font-semibold text-[#087a55]'}>{row.status}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-5 text-sm text-[#66736f]" colSpan={5}>
                  {t('noProperties')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UnpaidEvolutionCard({points, t, trendChange}: {points: AdvancedDashboardProps['unpaidTrendPoints']; t: AdvancedDashboardProps['t']; trendChange: number}) {
  const maxValue = Math.max(1, ...points.map((point) => point.value));

  return (
    <section className="rounded-xl border border-[#dce5e1] bg-white p-6 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-[#17201e]">{t('advanced.unpaidTrend.title')}</h2>
        {points.length > 1 ? (
          <div className="rounded-xl border border-[#b8ddd3] bg-[#f5faf8] px-4 py-3 text-right">
            <p className={trendChange > 0 ? 'text-xl font-semibold text-[#ba1a1a]' : 'text-xl font-semibold text-[#00796b]'}>{formatTrend(trendChange)}</p>
            <p className="text-xs text-[#66736f]">{t('advanced.unpaidTrend.vsFirstMonth')}</p>
          </div>
        ) : null}
      </div>
      {points.length ? (
        <div className="mt-5 flex h-36 items-end gap-5 border-b border-[#dce5e1] pb-6">
          {points.map((point) => (
            <div className="relative flex flex-1 justify-center" key={point.label}>
              <div className="w-8 rounded-t-sm bg-[#ef5b60]" style={{height: `${point.value > 0 ? Math.max(6, (point.value / maxValue) * 104) : 0}px`}} title={formatMoney(point.value)} />
              <span className="absolute -bottom-6 text-xs text-[#53615e]">{point.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <NoDataMessage label={t('advanced.noData')} />
      )}
    </section>
  );
}

function InsightCard({items, t}: {items: {icon: string; text: string; title: string}[]; t: AdvancedDashboardProps['t']}) {
  return (
    <section className="rounded-xl border border-[#dce5e1] bg-white p-5 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
      <h2 className="text-base font-semibold text-[#17201e]">{t('advanced.insights.title')}</h2>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div className="flex gap-3 rounded-lg border border-[#dce5e1] p-3" key={item.title}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5f6ef] text-[#00796b]">
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            </span>
            <div>
              <p className="text-sm font-semibold text-[#17201e]">{item.title}</p>
              <p className="mt-1 text-xs leading-[1.45] text-[#66736f]">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertCard({collectionHref, expiringLease, firstUnpaid, missingReceiptsCount, t}: {collectionHref: string; expiringLease: AdvancedDashboardProps['expiringLeases'][number] | undefined; firstUnpaid: RentCharge | undefined; missingReceiptsCount: number; t: AdvancedDashboardProps['t']}) {
  const alerts = [
    firstUnpaid
      ? {
          href: collectionHref,
          text: t('advanced.alerts.unpaidText', {amount: formatMoney(remainingAmount(firstUnpaid)), tenant: firstUnpaid.leases?.tenants?.full_name ?? t('advanced.tenantFallback')}),
          title: t('advanced.alerts.unpaid')
        }
      : null,
    expiringLease
      ? {
          href: '/bail',
          text: t('advanced.alerts.leaseText', {date: expiringLease.end_date ?? '-', property: expiringLease.propertyName}),
          title: t('advanced.alerts.lease')
        }
      : null,
    missingReceiptsCount
      ? {
          href: '/tax',
          text: t('advanced.alerts.receiptsText', {count: missingReceiptsCount}),
          title: t('advanced.alerts.receipts')
        }
      : null
  ].filter((alert): alert is {href: string; text: string; title: string} => Boolean(alert));

  return (
    <section className="rounded-xl border border-[#dce5e1] bg-white p-5 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
      <h2 className="text-base font-semibold text-[#17201e]">{t('advanced.alerts.title')}</h2>
      <div className="mt-4 grid gap-2">
        {alerts.length ? (
          alerts.map((alert) => (
            <Link className="flex min-h-14 items-center gap-3 rounded-lg border border-[#ffd2d2] bg-[#fff7f7] px-3 py-2 hover:bg-[#fff1f1]" href={alert.href} key={alert.title}>
              <span className="material-symbols-outlined shrink-0 text-[22px] text-[#ba1a1a]">warning</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#17201e]">{alert.title}</span>
                <span className="block text-xs leading-[1.45] text-[#66736f]">{alert.text}</span>
              </span>
              <span className="material-symbols-outlined shrink-0 text-[20px] text-[#17201e]">chevron_right</span>
            </Link>
          ))
        ) : (
          <p className="rounded-lg bg-[#f5faf8] p-4 text-sm text-[#66736f]">{t('advanced.alerts.empty')}</p>
        )}
      </div>
    </section>
  );
}

function RecommendedActions({t}: {t: AdvancedDashboardProps['t']}) {
  const actions = [
    {href: '/tenants', icon: 'send', label: t('advanced.actions.reminder'), note: t('advanced.actions.reminderNote')},
    {href: '/documents/quittance', icon: 'description', label: t('advanced.actions.receipts'), note: t('advanced.actions.receiptsNote')},
    {href: '/tax', icon: 'fact_check', label: t('advanced.actions.tax'), note: t('advanced.actions.taxNote')}
  ];

  return (
    <section className="rounded-xl border border-[#dce5e1] bg-white p-5 shadow-[0_2px_6px_rgba(20,45,38,0.07)]">
      <h2 className="text-base font-semibold text-[#17201e]">{t('advanced.actions.title')}</h2>
      <div className="mt-4 divide-y divide-[#dce5e1]">
        {actions.map((action) => (
          <Link className="flex min-h-16 items-center gap-3 py-3 hover:bg-[#f5faf8]" href={action.href} key={action.label}>
            <span className="material-symbols-outlined shrink-0 text-[24px] text-[#00796b]">{action.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#17201e]">{action.label}</span>
              <span className="block text-xs leading-[1.45] text-[#66736f]">{action.note}</span>
            </span>
            <span className="material-symbols-outlined shrink-0 text-[20px]">chevron_right</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MetricCard({href, icon, label, tone, value}: {href: string; icon: string; label: string; tone: 'error' | 'primary' | 'secondary'; value: string}) {
  const tones = {
    error: 'bg-[#ffdad6]/60 text-[#ba1a1a]',
    primary: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    secondary: 'bg-[#eef2ff] text-[var(--secondary)]'
  };
  const valueClass = tone === 'error' ? 'text-[#ba1a1a]' : 'text-[#171d1c]';

  return (
    <Link className="focus-ring rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md" href={href}>
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full ${tones[tone]}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <p className="mb-1 text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </Link>
  );
}

function QuickAction({href, label, note}: {href: string; label: string; note: string}) {
  return (
    <Link className="rounded-lg border-l-4 border-[var(--accent)] bg-[#f0f5f2] p-4 transition hover:bg-[#eaefed]" href={href}>
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-1 block text-sm text-[var(--muted)]">{note}</span>
    </Link>
  );
}
