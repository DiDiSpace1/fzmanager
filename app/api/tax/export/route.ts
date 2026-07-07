import {NextResponse, type NextRequest} from 'next/server';

import {hasPaidAccess} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {buildTaxCsv, fetchTaxExportData, getWorkspaceIdForUser, parseExportYear} from '@/lib/tax/export';

export async function GET(request: NextRequest) {
  const year = parseExportYear(request.nextUrl.searchParams.get('year'));
  const propertyId = request.nextUrl.searchParams.get('property_id');

  if (!year) {
    return NextResponse.json({error: 'Invalid year'}, {status: 400});
  }

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

  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (!hasPaidAccess(billing)) {
    return NextResponse.redirect(new URL('/tax?error=billing_required', request.url));
  }

  const exportData = await fetchTaxExportData({propertyId, supabase, workspaceId, year});

  if (exportData.error || !exportData.data) {
    return NextResponse.json({error: exportData.error ?? 'Export failed'}, {status: 500});
  }

  const csv = buildTaxCsv(exportData.data);

  return new NextResponse(csv, {
    headers: {
      'Content-Disposition': `attachment; filename="petit-bailleur-tax-${year}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8'
    }
  });
}
