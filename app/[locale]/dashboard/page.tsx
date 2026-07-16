import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
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
    revenue_type: string | null;
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
  paid_at: string;
  revenue_type: string | null;
};

type ChartExpense = {
  amount: number;
  expense_date: string;
};

const defaultApartmentPhoto = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80';
const monthLabels = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    const date = addMonths(currentMonth, index - 6);

    return {
      end: addMonths(date, 1).toISOString().slice(0, 10),
      key: monthKey(date),
      label: monthLabels[date.getUTCMonth()],
      start: date.toISOString().slice(0, 10)
    };
  });
}

function formatMoney(value: number) {
  return `${value.toLocaleString('fr-FR', {maximumFractionDigits: 0})} EUR`;
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
  const paidAmount = charge.rent_payments.filter((payment) => !payment.revenue_type || payment.revenue_type === 'rent').reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return Math.max(0, Number(charge.total_due ?? 0) - paidAmount);
}

function isRentPayment(payment: Pick<ChartPayment, 'revenue_type'>) {
  return !payment.revenue_type || payment.revenue_type === 'rent';
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const t = await getTranslations('dashboard');
  const propertiesT = await getTranslations('properties');
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const month = currentMonthStart();
  const monthEnd = addMonths(new Date(`${month}T00:00:00.000Z`), 1).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const chartMonths = buildRecentMonths();
  const chartStart = chartMonths[0]?.start ?? month;
  const chartEnd = chartMonths[chartMonths.length - 1]?.end ?? month;
  const {data: properties} = await supabase
    .from('properties')
    .select('id, name, address_line1, postal_code, city, property_photos(file_path, is_cover), leases(status, start_date, end_date, monthly_rent, charges_amount, tenants(full_name))')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false})
    .returns<DashboardProperty[]>();
  const {data: rentCharges} = await supabase
    .from('rent_charges')
    .select('id, status, total_due, period_month, rent_payments(amount, revenue_type), leases(status, start_date, end_date, tenants(full_name), properties(name))')
    .eq('workspace_id', workspaceId)
    .eq('period_month', month)
    .order('created_at', {ascending: false})
    .returns<RentCharge[]>();
  const {data: currentPayments} = await supabase
    .from('rent_payments')
    .select('amount, paid_at, revenue_type')
    .eq('workspace_id', workspaceId)
    .gte('paid_at', month)
    .lt('paid_at', monthEnd)
    .returns<ChartPayment[]>();
  const {data: chartPayments} = await supabase
    .from('rent_payments')
    .select('paid_at, amount, revenue_type')
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
    revenue: revenueByMonth.get(chartMonth.key) ?? 0
  }));
  const activeLeaseCount = rows.reduce((sum, property) => sum + property.leases.filter((lease) => isLeaseCurrentlyEffective(lease, today)).length, 0);
  const currentEffectiveCharges = charges.filter((charge) => isLeaseCurrentlyEffective(charge.leases, today));
  const paidTotal = (currentPayments ?? []).filter(isRentPayment).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const pendingTotal = currentEffectiveCharges
    .filter((charge) => charge.status !== 'paid' && charge.status !== 'waived' && !isUnpaidStatus(charge.status))
    .reduce((sum, charge) => sum + remainingAmount(charge), 0);
  const unpaidTotal = currentEffectiveCharges.filter((charge) => isUnpaidStatus(charge.status)).reduce((sum, charge) => sum + remainingAmount(charge), 0);
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

  return (
    <AppShell>
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
    </AppShell>
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
