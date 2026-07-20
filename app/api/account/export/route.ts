import {NextResponse} from 'next/server';

import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getWorkspaceIdForUser} from '@/lib/tax/export';

const DATA_TABLES = [
  'properties',
  'property_photos',
  'units',
  'tenants',
  'leases',
  'rent_charges',
  'rent_payments',
  'expenses',
  'documents'
] as const;

async function fetchTable(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, table: (typeof DATA_TABLES)[number], workspaceId: string) {
  const {data, error} = await supabase.from(table).select('*').eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

function pickProfile(profile: Record<string, unknown> | null) {
  if (!profile) {
    return null;
  }

  return {
    country_code: profile.country_code ?? null,
    default_workspace_id: profile.default_workspace_id ?? null,
    email: profile.email ?? null,
    full_name: profile.full_name ?? null,
    id: profile.id ?? null,
    phone: profile.phone ?? null,
    tax_regime: profile.tax_regime ?? null,
    updated_at: profile.updated_at ?? null
  };
}

function pickWorkspace(workspace: Record<string, unknown> | null) {
  if (!workspace) {
    return null;
  }

  return {
    country_code: workspace.country_code ?? null,
    created_at: workspace.created_at ?? null,
    id: workspace.id ?? null,
    name: workspace.name ?? null,
    tax_regime: workspace.tax_regime ?? null,
    updated_at: workspace.updated_at ?? null
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const workspaceId = await getWorkspaceIdForUser(supabase, user.id);

  if (!workspaceId) {
    return NextResponse.json({error: 'Workspace not found'}, {status: 404});
  }

  try {
    const {data: profile} = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const {data: workspace} = await supabase.from('workspaces').select('*').eq('id', workspaceId).single();
    const data = Object.fromEntries(await Promise.all(DATA_TABLES.map(async (table) => [table, await fetchTable(supabase, table, workspaceId)])));
    const payload = {
      data,
      export: {
        exported_at: new Date().toISOString(),
        format: 'loyelio_account_backup',
        includes_binary_files: false,
        notes: [
          'Documents and property photos are exported as metadata and storage paths only.',
          'Authentication sessions, payment provider identifiers, and raw billing records are not included.'
        ],
        version: 1,
        workspace_id: workspaceId
      },
      profile: pickProfile(profile),
      workspace: pickWorkspace(workspace)
    };

    return NextResponse.json(payload, {
      headers: {
        'Content-Disposition': `attachment; filename="loyelio-account-backup-${new Date().toISOString().slice(0, 10)}.json"`
      }
    });
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : 'Export failed'}, {status: 500});
  }
}
