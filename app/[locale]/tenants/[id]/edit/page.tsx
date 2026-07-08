import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
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
};

export default async function EditTenantPage({params}: EditTenantPageProps) {
  const {id} = await params;
  const locale = await getLocale();
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: tenant, error} = await supabase
    .from('tenants')
    .select('id, full_name, email, phone, notes')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .single<EditableTenant>();

  if (error || !tenant) {
    notFound();
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[var(--accent)]" href={`/tenants/${tenant.id}`}>
            Retour au locataire
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-[#171d1c]">Modifier le locataire</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{tenant.full_name}</p>
        </div>
      </div>

      <form action={updateTenantAction} className="mt-8 grid gap-5">
        <input name="locale" type="hidden" value={locale} />
        <input name="tenant_id" type="hidden" value={tenant.id} />
        <SectionCard title="1. Identite du locataire">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              Nom complet
              <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={tenant.full_name} name="full_name" required />
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
              Email
              <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={tenant.email ?? ''} name="email" type="email" />
            </label>
          </div>
        </SectionCard>
        <SectionCard title="2. Coordonnees">
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Telephone
            <input className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal" defaultValue={tenant.phone ?? ''} name="phone" />
          </label>
        </SectionCard>
        <SectionCard title="3. Notes internes">
          <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
            Notes
            <textarea className="focus-ring min-h-28 rounded-md border border-[var(--line)] px-3 py-3 text-sm font-normal" defaultValue={tenant.notes ?? ''} name="notes" />
          </label>
        </SectionCard>
        <div className="flex justify-end gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-5 text-sm font-semibold" href={`/tenants/${tenant.id}`}>
            Annuler
          </Link>
          <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" style={{color: '#ffffff'}} type="submit">
            Enregistrer
          </button>
        </div>
      </form>
    </AppShell>
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
