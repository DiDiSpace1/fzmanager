import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale, getTranslations} from 'next-intl/server';

import {canUseRentReminders, getWorkspaceBilling} from '@/lib/billing/limits';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {updateTenantAction} from '../../actions';

type EditTenantPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type EditableTenant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  leases: {
    id: string;
    start_date: string;
    status: string;
    rent_reminder_day: number | null;
    rent_reminder_days_before: number;
    rent_reminder_enabled: boolean;
    properties: {name: string} | null;
  }[];
};

export default async function EditTenantPage({params}: EditTenantPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const common = await getTranslations('common');
  const t = await getTranslations('tenants');
  const form = await getTranslations('tenants.form');
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: tenant, error} = await supabase
    .from('tenants')
    .select('id, full_name, email, phone, notes, leases(id, start_date, status, rent_reminder_enabled, rent_reminder_day, rent_reminder_days_before, properties(name))')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<EditableTenant>();

  if (error || !tenant) {
    notFound();
  }

  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const hasReminderAccess = canUseRentReminders(billing);
  const activeLease = tenant.leases.find((lease) => lease.status === 'active') ?? tenant.leases[0] ?? null;
  const fallbackReminderDay = activeLease?.rent_reminder_day ?? (activeLease ? Number(activeLease.start_date.slice(8, 10)) : 1);

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[var(--accent)]" href={`/tenants/${tenant.id}`}>
            {t('detail.backToTenant')}
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">{t('editTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{tenant.full_name}</p>
        </div>
      </div>

      <form action={updateTenantAction} className="mt-8 grid gap-5">
        <input name="locale" type="hidden" value={locale} />
        <input name="tenant_id" type="hidden" value={tenant.id} />
        {activeLease ? <input name="lease_id" type="hidden" value={activeLease.id} /> : null}
        <SectionCard title={form('identityTitle')}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              {form('fullName')}
              <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={tenant.full_name} name="full_name" required />
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              {form('email')}
              <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={tenant.email ?? ''} name="email" type="email" />
            </label>
          </div>
        </SectionCard>
        <SectionCard title={form('contactTitle')}>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {form('phone')}
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={tenant.phone ?? ''} name="phone" />
          </label>
        </SectionCard>
        <SectionCard title={form('notesTitle')}>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            {form('notes')}
            <textarea className="focus-ring min-h-28 rounded-md border border-[var(--line)] px-3 py-3 text-sm font-normal" defaultValue={tenant.notes ?? ''} name="notes" />
          </label>
        </SectionCard>
        <SectionCard title={t('reminders.editTitle')}>
          {activeLease ? (
            <div className="grid gap-4">
              <div className="rounded-lg border border-[var(--line-soft)] bg-[#f5f9f7] p-4 text-sm text-[#33413f]">
                <p className="font-semibold text-[#17201e]">{activeLease.properties?.name ?? t('reminders.leaseFallback')}</p>
                <p className="mt-1 text-[var(--muted)]">{t('reminders.editCopy')}</p>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-lg border border-[var(--line-soft)] p-4 text-sm font-semibold text-[#33413f]">
                <span>
                  {t('reminders.enableLabel')}
                  {!hasReminderAccess ? <span className="ml-2 rounded-full bg-[#eef2f7] px-2 py-1 text-xs text-[var(--muted)]">Plus</span> : null}
                </span>
                <input className="h-5 w-5 accent-[var(--accent)]" defaultChecked={activeLease.rent_reminder_enabled && hasReminderAccess} disabled={!hasReminderAccess} name="rent_reminder_enabled" type="checkbox" />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
                  {t('reminders.dayLabel')}
                  <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={fallbackReminderDay} disabled={!hasReminderAccess} name="rent_reminder_day">
                    {Array.from({length: 31}, (_, index) => index + 1).map((day) => (
                      <option key={day} value={day}>
                        {t('reminders.dayOption', {day})}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
                  {t('reminders.daysBeforeLabel')}
                  <select className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={activeLease.rent_reminder_days_before} disabled={!hasReminderAccess} name="rent_reminder_days_before">
                    {[0, 1, 3, 7].map((days) => (
                      <option key={days} value={days}>
                        {t('reminders.daysBeforeOption', {days})}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!hasReminderAccess ? (
                <div className="rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
                  {t('reminders.upgradeCopy')}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[var(--muted)]">{t('reminders.noLease')}</p>
          )}
        </SectionCard>
        <div className="flex justify-end gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold cursor-pointer" href={`/tenants/${tenant.id}`}>
            {common('cancel')}
          </Link>
          <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white cursor-pointer" style={{color: '#ffffff'}} type="submit">
            {common('save')}
          </button>
        </div>
      </form>
    </>
  );
}

function SectionCard({children, title}: {children: React.ReactNode; title: string}) {
  return (
    <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <h2 className="mb-5 text-base font-semibold">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
