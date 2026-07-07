import {getLocale, getTranslations} from 'next-intl/server';

import {AppShell} from '@/components/app/app-shell';
import {PageHeader} from '@/components/app/page-header';
import {getCurrentUserWorkspace} from '@/lib/workspace';

import {createExpenseAction, deleteDocumentAction, uploadDocumentAction} from './actions';

type PropertyOption = {
  id: string;
  name: string;
};

type UnitOption = {
  id: string;
  name: string;
  property_id: string;
};

type TenantOption = {
  id: string;
  full_name: string;
};

type DocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  properties: {
    name: string;
  } | null;
  tenants: {
    full_name: string;
  } | null;
  units: {
    name: string;
  } | null;
};

type DocumentWithUrl = DocumentRow & {
  signedUrl: string | null;
};

type ExpenseRow = {
  id: string;
  amount: number;
  currency: string;
  expense_date: string;
  receipt_status: string;
  vendor: string | null;
  tax_categories: {
    label: string;
  } | null;
  properties: {
    name: string;
  } | null;
};

type TaxCategory = {
  id: string;
  label: string;
};

type DocumentsPageProps = {
  searchParams: Promise<{
    error?: string;
    property_id?: string;
    q?: string;
    type?: string;
    year?: string;
  }>;
};

function formatBytes(bytes: number | null) {
  if (!bytes) {
    return '0 KB';
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function yearRange(value: string | undefined) {
  const year = value ? Number.parseInt(value, 10) : null;

  if (!year || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return null;
  }

  return {
    end: `${year + 1}-01-01`,
    start: `${year}-01-01`,
    year
  };
}

export default async function DocumentsPage({searchParams}: DocumentsPageProps) {
  const t = await getTranslations('documents');
  const locale = await getLocale();
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const selectedPropertyId = params.property_id ?? '';
  const selectedType = params.type ?? '';
  const selectedYear = yearRange(params.year);
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: properties} = await supabase
    .from('properties')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .order('name', {ascending: true})
    .returns<PropertyOption[]>();
  const {data: units} = await supabase
    .from('units')
    .select('id, name, property_id')
    .eq('workspace_id', workspaceId)
    .order('name', {ascending: true})
    .returns<UnitOption[]>();
  const {data: tenants} = await supabase
    .from('tenants')
    .select('id, full_name')
    .eq('workspace_id', workspaceId)
    .order('full_name', {ascending: true})
    .returns<TenantOption[]>();
  let documentQuery = supabase
    .from('documents')
    .select('id, document_type, file_name, file_path, mime_type, size_bytes, created_at, properties(name), units(name), tenants(full_name)')
    .eq('workspace_id', workspaceId)
    .order('created_at', {ascending: false});

  if (selectedPropertyId) {
    documentQuery = documentQuery.eq('property_id', selectedPropertyId);
  }

  if (selectedType) {
    documentQuery = documentQuery.eq('document_type', selectedType);
  }

  if (selectedYear) {
    documentQuery = documentQuery.gte('created_at', selectedYear.start).lt('created_at', selectedYear.end);
  }

  if (query) {
    documentQuery = documentQuery.ilike('file_name', `%${query}%`);
  }

  const {data: documents, error: documentsError} = await documentQuery.limit(50).returns<DocumentRow[]>();
  let expenseQuery = supabase
    .from('expenses')
    .select('id, amount, currency, expense_date, receipt_status, vendor, tax_categories(label), properties(name)')
    .eq('workspace_id', workspaceId)
    .order('expense_date', {ascending: false});

  if (selectedPropertyId) {
    expenseQuery = expenseQuery.eq('property_id', selectedPropertyId);
  }

  if (selectedYear) {
    expenseQuery = expenseQuery.gte('expense_date', selectedYear.start).lt('expense_date', selectedYear.end);
  }

  if (query) {
    expenseQuery = expenseQuery.ilike('vendor', `%${query}%`);
  }

  const {data: expenses, error: expensesError} = await expenseQuery.limit(50).returns<ExpenseRow[]>();
  const {data: categories} = await supabase
    .from('tax_categories')
    .select('id, label')
    .eq('country_code', 'FR')
    .eq('tax_regime', 'LMNP')
    .eq('active', true)
    .order('sort_order', {ascending: true})
    .returns<TaxCategory[]>();
  const documentsWithUrls: DocumentWithUrl[] = await Promise.all(
    (documents ?? []).map(async (document) => {
      const {data} = await supabase.storage.from('documents').createSignedUrl(document.file_path, 60 * 10, {
        download: document.file_name
      });

      return {
        ...document,
        signedUrl: data?.signedUrl ?? null
      };
    })
  );

  return (
    <AppShell>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {documentsError || expensesError ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Impossible de charger les documents ou depenses. Lancez la migration Supabase de la phase documents.
        </div>
      ) : null}

      {params.error === 'plan_limit' ? (
        <div className="mb-6 rounded-md border border-[#f0d6b6] bg-[#fff8ec] p-4 text-sm leading-6 text-[#7a4a11]">
          Le plan gratuit inclut 10 documents. Passez a Pro depuis les parametres pour televerser plus de fichiers.
        </div>
      ) : null}

      <form className="mb-6 grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4 md:grid-cols-[1fr_150px_180px_1fr_auto]">
        <label className="grid gap-2 text-sm font-medium">
          Recherche
          <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue={query} name="q" placeholder="Nom de fichier, fournisseur" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Annee
          <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue={selectedYear?.year ?? ''} max="2100" min="2000" name="year" type="number" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Type
          <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue={selectedType} name="type">
            <option value="">Tous</option>
            <option value="invoice">Facture</option>
            <option value="lease">Bail</option>
            <option value="rent_receipt">Quittance</option>
            <option value="insurance">Assurance</option>
            <option value="tax">Fiscal</option>
            <option value="other">Autre</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Bien
          <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" defaultValue={selectedPropertyId} name="property_id">
            <option value="">Tous les biens</option>
            {(properties ?? []).map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
        <button className="focus-ring min-h-11 self-end rounded-md border border-[var(--line)] px-5 text-sm font-semibold hover:bg-[#f2f0ea]" type="submit">
          Filtrer
        </button>
      </form>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <section className="rounded-lg border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-lg font-semibold">Documents recents</h2>
            </div>
            {documentsWithUrls.length ? (
              <div className="divide-y divide-[var(--line)]">
                {documentsWithUrls.map((document) => (
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" key={document.id}>
                    <div>
                      <p className="font-medium">{document.file_name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {[document.document_type, document.properties?.name, document.units?.name, document.tenants?.full_name, formatBytes(document.size_bytes)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f2f0ea] px-3 py-1 text-xs font-semibold text-[var(--muted)]">{document.mime_type ?? 'file'}</span>
                      {document.signedUrl ? (
                        <a className="focus-ring rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:bg-[#f2f0ea]" href={document.signedUrl}>
                          Telecharger
                        </a>
                      ) : null}
                      <form action={deleteDocumentAction}>
                        <input name="locale" type="hidden" value={locale} />
                        <input name="document_id" type="hidden" value={document.id} />
                        <button className="focus-ring rounded-md border border-[#efd0ca] px-3 py-2 text-xs font-semibold text-[#9d2f1f] hover:bg-[#fff4f1]" type="submit">
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-[var(--muted)]">Aucun document pour le moment.</div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-white">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-lg font-semibold">Depenses recentes</h2>
            </div>
            {expenses?.length ? (
              <div className="divide-y divide-[var(--line)]">
                {expenses.map((expense) => (
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" key={expense.id}>
                    <div>
                      <p className="font-medium">{expense.vendor || expense.tax_categories?.label || 'Depense'}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {[expense.expense_date, expense.properties?.name, expense.receipt_status].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {Number(expense.amount).toFixed(2)} {expense.currency}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-[var(--muted)]">Aucune depense pour le moment.</div>
            )}
          </section>
        </div>

        <div className="grid gap-6">
          <form action={uploadDocumentAction} className="rounded-lg border border-[var(--line)] bg-white p-5">
            <input name="locale" type="hidden" value={locale} />
            <h2 className="text-lg font-semibold">Televerser un document</h2>
            <div className="mt-5 grid gap-4">
              <input accept=".pdf,image/png,image/jpeg" className="focus-ring rounded-md border border-[var(--line)] px-3 py-3 text-sm" name="file" required type="file" />
              <label className="grid gap-2 text-sm font-medium">
                Type
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="document_type" defaultValue="invoice">
                  <option value="invoice">Facture</option>
                  <option value="lease">Bail</option>
                  <option value="rent_receipt">Quittance</option>
                  <option value="insurance">Assurance</option>
                  <option value="tax">Fiscal</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Bien
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="property_id">
                  <option value="">Non precise</option>
                  {(properties ?? []).map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Unite
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="unit_id">
                  <option value="">Non precise</option>
                  {(units ?? []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Locataire
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="tenant_id">
                  <option value="">Non precise</option>
                  {(tenants ?? []).map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Mois
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="period_month" type="date" />
              </label>
              <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
                Televerser
              </button>
            </div>
          </form>

          <form action={createExpenseAction} className="rounded-lg border border-[var(--line)] bg-white p-5">
            <input name="locale" type="hidden" value={locale} />
            <h2 className="text-lg font-semibold">Ajouter une depense</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Date
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="expense_date" required type="date" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Montant
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" min="0" name="amount" required step="0.01" type="number" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Fournisseur
                <input className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="vendor" placeholder="Plombier, assurance..." />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Categorie
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="tax_category_id">
                  <option value="">A classer</option>
                  {(categories ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Bien
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="property_id">
                  <option value="">Non precise</option>
                  {(properties ?? []).map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Unite
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="unit_id">
                  <option value="">Non precise</option>
                  {(units ?? []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Justificatif
                <select className="focus-ring rounded-md border border-[var(--line)] px-3 py-3" name="document_id">
                  <option value="">Aucun document lie</option>
                  {documentsWithUrls.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.file_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Description
                <textarea className="focus-ring min-h-20 rounded-md border border-[var(--line)] px-3 py-3" name="description" />
              </label>
              <button className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white" type="submit">
                Ajouter
              </button>
            </div>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
