import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createTenantAction, deleteTenantAction} from './actions';

type TenantRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  leases: {
    id: string;
    status: string;
    start_date: string;
    end_date: string | null;
    monthly_rent: number;
    properties: {name: string} | null;
    units: {name: string} | null;
    rent_charges: {status: string; period_month: string}[];
  }[];
};

type TenantsPageProps = {
  searchParams: Promise<{
    error?: string;
    new?: string;
    q?: string;
  }>;
};

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'L') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '');
}

function activeLease(tenant: TenantRow) {
  return tenant.leases.find((lease) => lease.status === 'active') ?? tenant.leases[0] ?? null;
}

function paymentStatus(lease: TenantRow['leases'][number] | null) {
  if (!lease) {
    return {className: 'bg-[#eef2ff] text-[#3755c3]', label: 'Sans bail'};
  }

  const latestCharge = [...lease.rent_charges].sort((a, b) => b.period_month.localeCompare(a.period_month))[0];

  if (!latestCharge) {
    return {className: 'bg-[#eef2ff] text-[#3755c3]', label: lease.status === 'active' ? 'Actif' : lease.status};
  }

  if (latestCharge.status === 'paid') {
    return {className: 'bg-[#ecfdf5] text-[#047857]', label: 'Paye'};
  }

  if (latestCharge.status === 'partial') {
    return {className: 'bg-[#fff7ed] text-[#b45309]', label: 'Partiel'};
  }

  return {className: 'bg-[#fee2e2] text-[#ba1a1a]', label: 'Non paye'};
}

export default async function TenantsPage({searchParams}: TenantsPageProps) {
  const t = await getTranslations('tenants');
  const locale = await getLocale();
  const params = await searchParams;
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const queryText = (params.q ?? '').trim();
  const showCreate = params.new === '1';

  let query = supabase
    .from('tenants')
    .select(
      'id, full_name, email, phone, notes, leases(id, status, start_date, end_date, monthly_rent, properties(name), units(name), rent_charges(status, period_month))'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false});

  if (queryText) {
    query = query.or(`full_name.ilike.%${queryText}%,email.ilike.%${queryText}%,phone.ilike.%${queryText}%`);
  }

  const {data: tenants, error} = await query.returns<TenantRow[]>();
  const rows = tenants ?? [];
  const activeRows = rows.filter((tenant) => activeLease(tenant)?.status === 'active');
  const overdueCount = rows.filter((tenant) => paymentStatus(activeLease(tenant)).label === 'Non paye').length;
  const monthlyRent = activeRows.reduce((sum, tenant) => sum + Number(activeLease(tenant)?.monthly_rent ?? 0), 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#171d1c]">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        {showCreate ? (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line)] px-5 text-sm font-semibold text-[#171d1c]" href="/tenants">
            Retour
          </Link>
        ) : (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white" href="/tenants?new=1" style={{color: '#ffffff'}}>
            + Ajouter un locataire
          </Link>
        )}
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Impossible de charger les locataires. Verifiez que les migrations Supabase sont bien appliquees.
        </div>
      ) : null}

      {params.error === 'plan_limit' ? (
        <div className="mt-6 rounded-lg border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Le plan gratuit inclut 3 locataires. Passez a Solo depuis les parametres pour continuer.
        </div>
      ) : null}

      {showCreate ? (
        <CreateTenantView locale={locale} />
      ) : (
        <>
          <section className="mt-8 grid gap-4 md:grid-cols-4">
            <SummaryCard label="Total locataires" note="Contacts suivis" value={rows.length.toString()} />
            <SummaryCard label="Baux actifs" note="Occupation actuelle" value={activeRows.length.toString()} />
            <SummaryCard label="Retards" note="Action requise" value={overdueCount.toString()} warning={overdueCount > 0} />
            <SummaryCard label="Loyers mensuels" note="Baux actifs" value={`${monthlyRent.toLocaleString('fr-FR')} EUR`} />
          </section>

          <section className="mt-6 overflow-hidden rounded-lg border border-[var(--line-soft)] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--line-soft)] p-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm font-semibold text-[#171d1c]">Juillet 2026</div>
              <form className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                <input
                  className="focus-ring min-h-11 w-full rounded-lg border border-[var(--line)] bg-[#f0f5f2] px-3 text-sm md:w-72"
                  defaultValue={queryText}
                  name="q"
                  placeholder="Rechercher un locataire..."
                />
                <button className="focus-ring min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[#171d1c]" type="submit">
                  Filtrer
                </button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left">
                <thead className="border-b border-[var(--line-soft)] bg-[#eaefed] text-[11px] font-semibold uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-4">Nom & prenom</th>
                    <th className="px-5 py-4">Bien occupe</th>
                    <th className="px-5 py-4">Date entree</th>
                    <th className="px-5 py-4">Fin du contrat</th>
                    <th className="px-5 py-4">Statut</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-soft)]">
                  {rows.length ? (
                    rows.map((tenant) => {
                      const lease = activeLease(tenant);
                      const status = paymentStatus(lease);

                      return (
                        <tr className="transition hover:bg-[#f0f5f2]" key={tenant.id}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dde1ff] text-sm font-bold uppercase text-[#3755c3]">{initials(tenant.full_name)}</div>
                              <div>
                                <Link className="font-semibold hover:text-[var(--accent)]" href={`/tenants/${tenant.id}`}>
                                  {tenant.full_name}
                                </Link>
                                <p className="mt-1 text-sm text-[var(--muted)]">{tenant.email ?? tenant.phone ?? 'Contact a completer'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            <p>{lease?.properties?.name ?? '-'}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{lease?.units?.name ?? ''}</p>
                          </td>
                          <td className="px-5 py-4 text-sm tabular-nums">{lease?.start_date ?? '-'}</td>
                          <td className="px-5 py-4 text-sm tabular-nums">{lease?.end_date ?? '-'}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <details className="relative inline-block">
                              <summary className="focus-ring flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-xl text-[var(--muted)] hover:bg-[#eaefed]">
                                ...
                              </summary>
                              <div className="absolute right-0 z-20 mt-2 w-36 rounded-lg border border-[var(--line-soft)] bg-white p-1 text-left text-sm shadow-lg">
                                <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/tenants/${tenant.id}`}>
                                  Voir
                                </Link>
                                <Link className="block rounded-md px-3 py-2 hover:bg-[#f0f5f2]" href={`/tenants/${tenant.id}/edit`}>
                                  Modifier
                                </Link>
                                <form action={deleteTenantAction}>
                                  <input name="locale" type="hidden" value={locale} />
                                  <input name="tenant_id" type="hidden" value={tenant.id} />
                                  <button className="block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]" type="submit">
                                    Supprimer
                                  </button>
                                </form>
                              </div>
                            </details>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-5 py-10 text-center text-sm text-[var(--muted)]" colSpan={6}>
                        Aucun locataire pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--line-soft)] px-5 py-4 text-sm text-[var(--muted)]">
              Affichage {rows.length ? `1-${rows.length}` : '0'} sur {rows.length} locataire(s)
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

function SummaryCard({label, note, value, warning = false}: {label: string; note: string; value: string; warning?: boolean}) {
  return (
    <div className={['rounded-lg border bg-white p-5 shadow-sm', warning ? 'border-[#fecaca]' : 'border-[var(--line-soft)]'].join(' ')}>
      <p className={['text-xs font-semibold uppercase', warning ? 'text-[#ba1a1a]' : 'text-[var(--muted)]'].join(' ')}>{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{note}</p>
    </div>
  );
}

function CreateTenantView({locale}: {locale: string}) {
  return (
    <form action={createTenantAction} className="mt-8 grid gap-5">
      <input name="locale" type="hidden" value={locale} />
      <SectionCard title="1. Identite du locataire">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Nom complet
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="full_name" placeholder="Marie Dupont" required />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Email
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="email" placeholder="marie@example.com" type="email" />
          </label>
        </div>
      </SectionCard>
      <SectionCard title="2. Coordonnees">
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          Telephone
          <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" name="phone" placeholder="+33 ..." />
        </label>
      </SectionCard>
      <SectionCard title="3. Notes internes">
        <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
          Notes
          <textarea className="focus-ring min-h-28 rounded-md border border-[var(--line)] px-3 py-3 text-sm font-normal" name="notes" placeholder="Informations utiles" />
        </label>
      </SectionCard>
      <div className="flex justify-end gap-3">
        <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold" href="/tenants">
          Annuler
        </Link>
        <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
          Ajouter
        </button>
      </div>
    </form>
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
