import JSZip from 'jszip';
import {NextResponse, type NextRequest} from 'next/server';

import {hasPaidAccess} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {buildTaxCsv, buildTaxPdf, fetchTaxExportData, getWorkspaceIdForUser, parseExportYear} from '@/lib/tax/export';

export const runtime = 'nodejs';

function safeZipName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_\s]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document';
}

export async function GET(request: NextRequest) {
  try {
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

    const zip = new JSZip();
    const csv = buildTaxCsv(exportData.data);
    const manifest = {
      generatedAt: new Date().toISOString(),
      includedDocuments: [] as Array<{fileName: string; filePath: string}>,
      warnings: [] as string[],
      year
    };

    zip.file(`petit-bailleur-tax-${year}.csv`, csv);

    try {
      const pdf = await buildTaxPdf(exportData.data);
      zip.file(`petit-bailleur-summary-${year}.pdf`, pdf);
    } catch (error) {
      console.error('Tax PDF generation failed', error);
      manifest.warnings.push('PDF summary could not be generated. CSV export is included.');
    }

    const documentFolder = zip.folder('documents');
    const seenPaths = new Set<string>();

    for (const expense of exportData.data.expenses) {
      const document = expense.documents;

      if (!document?.file_path || seenPaths.has(document.file_path)) {
        continue;
      }

      seenPaths.add(document.file_path);
      const {data, error} = await supabase.storage.from('documents').download(document.file_path);

      if (error || !data) {
        manifest.warnings.push(`Document could not be included: ${document.file_name}`);
        continue;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      const fileName = `${seenPaths.size.toString().padStart(3, '0')}-${safeZipName(document.file_name)}`;

      documentFolder?.file(fileName, buffer);
      manifest.includedDocuments.push({
        fileName,
        filePath: document.file_path
      });
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('README.txt', 'This ZIP is a tax preparation package. It does not replace tax or accounting advice.\n');

    const zipBuffer = await zip.generateAsync({
      compression: 'DEFLATE',
      type: 'nodebuffer'
    });

    const {error: insertError} = await supabase.from('tax_exports').insert({
      country_code: 'FR',
      status: 'ready',
      tax_regime: 'LMNP',
      workspace_id: workspaceId,
      year
    });

    if (insertError) {
      console.error('Tax export record insert failed', insertError);
    }

    const body = new Uint8Array(zipBuffer);

    return new NextResponse(body, {
      headers: {
        'Content-Disposition': `attachment; filename="petit-bailleur-tax-package-${year}.zip"`,
        'Content-Type': 'application/zip'
      }
    });
  } catch (error) {
    console.error('Tax ZIP export failed', error);
    return NextResponse.json({error: 'Tax ZIP export failed'}, {status: 500});
  }
}
