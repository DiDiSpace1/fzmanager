import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';
import type {ReactNode} from 'react';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type BailDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type BailDetail = {
  charges_amount: number;
  deposit_amount: number;
  end_date: string | null;
  id: string;
  monthly_rent: number;
  property_id: string;
  start_date: string;
  status: string;
  tenant_id: string;
  properties: {
    address_line1: string | null;
    city: string | null;
    name: string;
    postal_code: string | null;
    rental_mode: string;
  } | null;
  tenants: {
    email: string | null;
    full_name: string;
    phone: string | null;
  } | null;
};

type BailDocument = {
  created_at: string;
  document_type: string;
  file_name: string;
  file_path: string;
  id: string;
};

function formatMoney(value: number) {
  return `${Number(value ?? 0).toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} €`;
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('fr-FR', {day: '2-digit', month: 'long', year: 'numeric'}).format(new Date(`${value}T00:00:00Z`));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
}

function statusLabel(status: string) {
  return status === 'active' ? 'Actif' : status === 'ended' ? 'Termine' : 'Brouillon';
}

function modeLabel(mode?: string) {
  const labels: Record<string, string> = {
    entire_place: 'entier',
    mixed: 'mixte',
    shared_rooms: 'colocation'
  };

  return labels[mode ?? ''] ?? mode ?? '-';
}

function yearsBetween(startDate: string, endDate: string | null) {
  if (!endDate) {
    return null;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const years = Math.max(1, Math.round((end.getTime() - start.getTime()) / (365 * 24 * 60 * 60 * 1000)));

  return `${years} an${years > 1 ? 's' : ''}`;
}

function documentLabel(type: string) {
  const labels: Record<string, string> = {
    insurance: 'Valide',
    lease: 'Signe',
    other: 'Ajoute',
    rent_receipt: 'Quittance',
    tax: 'Fiscal'
  };

  return labels[type] ?? 'Ajoute';
}

export default async function BailDetailPage({params}: BailDetailPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: bail, error} = await supabase
    .from('leases')
    .select('id, status, start_date, end_date, monthly_rent, charges_amount, deposit_amount, property_id, tenant_id, tenants(full_name, email, phone), properties(name, address_line1, postal_code, city, rental_mode)')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<BailDetail>();

  if (error || !bail) {
    notFound();
  }

  const {data: documents} = await supabase
    .from('documents')
    .select('id, document_type, file_name, file_path, created_at')
    .eq('workspace_id', workspaceId)
    .eq('property_id', bail.property_id)
    .or(`tenant_id.eq.${bail.tenant_id},document_type.eq.lease`)
    .order('created_at', {ascending: false})
    .limit(3)
    .returns<BailDocument[]>();
  const totalMonthly = Number(bail.monthly_rent ?? 0) + Number(bail.charges_amount ?? 0);
  const duration = yearsBetween(bail.start_date, bail.end_date);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[var(--accent)]" href="/bail">
            Retour aux baux
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-[#171d1c]">Bail de {bail.tenants?.full_name ?? 'Locataire'}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[#047857]">• {statusLabel(bail.status)}</span>
            <span className="rounded-full bg-[#f0f5f2] px-2.5 py-1 text-[#53615f]">Type : {modeLabel(bail.properties?.rental_mode)}</span>
            <span className="rounded-full bg-[#f0f5f2] px-2.5 py-1 text-[#53615f]">Debut : {formatShortDate(bail.start_date)}</span>
          </div>
        </div>
        <div className="text-left md:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#33413f]">Loyer mensuel CC</p>
          <p className="mt-1 text-3xl font-semibold text-[var(--accent)] tabular-nums">{formatMoney(totalMonthly)}</p>
        </div>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <InfoCard title="Informations du Locataire" icon="person">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0f5f2] text-base font-bold text-[var(--accent)]">{(bail.tenants?.full_name ?? 'L').slice(0, 2).toUpperCase()}</div>
            <div>
              <p className="font-semibold">{bail.tenants?.full_name ?? '-'}</p>
              <p className="text-sm text-[var(--muted)]">Locataire principal</p>
            </div>
          </div>
          <ContactRow icon="mail" value={bail.tenants?.email ?? '-'} />
          <ContactRow icon="call" value={bail.tenants?.phone ?? '-'} />
        </InfoCard>

        <InfoCard title="Conditions Financieres" icon="payments">
          <div className="grid gap-6 sm:grid-cols-3">
            <FinancialItem label="Loyer hors charges" value={formatMoney(bail.monthly_rent)} />
            <FinancialItem label="Charges" value={formatMoney(bail.charges_amount)} />
            <FinancialItem label="Depot de garantie" value={formatMoney(bail.deposit_amount)} />
          </div>
        </InfoCard>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <InfoCard title="Calendrier & Duree" icon="calendar_month">
          <div className="relative grid gap-8 pl-6">
            <span className="absolute bottom-8 left-[7px] top-3 border-l border-dashed border-[#c7d2ce]" />
            <TimelineItem active label="Date de debut" value={formatDate(bail.start_date)} />
            <TimelineItem label="Date de fin previsionnelle" value={formatDate(bail.end_date)} note={duration ? `Renouvellement tacite (${duration})` : undefined} />
          </div>
        </InfoCard>

        <InfoCard title="Documents du bail" icon="folder">
          <div className="grid gap-3">
            {(documents ?? []).length ? (
              (documents ?? []).map((document) => (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] p-3" key={document.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{document.file_name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {documentLabel(document.document_type)} le {formatShortDate(document.created_at)}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-base text-[var(--accent)]">download</span>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-[var(--line-soft)] bg-[#f8fbfa] p-4 text-sm text-[var(--muted)]">Aucun document associe pour le moment.</p>
            )}
            <Link className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--line)] text-sm font-semibold text-[#33413f]" href="/documents">
              <span className="material-symbols-outlined text-base">add_circle</span>
              Ajouter un document
            </Link>
          </div>
        </InfoCard>
      </section>
    </AppShell>
  );
}

function InfoCard({children, icon, title}: {children: ReactNode; icon: string; title: string}) {
  return (
    <section className="rounded-lg border border-[var(--line-soft)] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2 border-b border-[var(--line-soft)] pb-4">
        <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function ContactRow({icon, value}: {icon: string; value: string}) {
  return (
    <p className="flex items-center gap-3 text-sm">
      <span className="material-symbols-outlined rounded-md bg-[#f0f5f2] p-1 text-[16px] text-[#53615f]">{icon}</span>
      <span>{value}</span>
    </p>
  );
}

function FinancialItem({label, value}: {label: string; value: string}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-[#33413f]">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TimelineItem({active = false, label, note, value}: {active?: boolean; label: string; note?: string; value: string}) {
  return (
    <div className="relative">
      <span className={active ? 'absolute -left-6 top-1 h-3 w-3 rounded-full bg-[var(--accent)]' : 'absolute -left-6 top-1 h-3 w-3 rounded-full bg-[#d7e0dc]'} />
      <p className="text-[10px] font-bold uppercase text-[#33413f]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
      {note ? <p className="mt-1 text-sm text-[var(--muted)]">{note}</p> : null}
    </div>
  );
}
