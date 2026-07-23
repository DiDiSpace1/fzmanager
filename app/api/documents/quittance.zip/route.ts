import JSZip from 'jszip';
import {NextResponse} from 'next/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export const runtime = 'nodejs';

type ReceiptDocument = {
  file_name: string;
  file_path: string;
  id: string;
  period_month: string | null;
  tenants: {full_name: string} | null;
};

function safeZipName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_\s]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document';
}

function zipFileName(periodMonth: string | null) {
  const suffix = periodMonth?.slice(0, 7) || new Date().toISOString().slice(0, 7);
  return `loyelio-quittances-${suffix}.zip`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {documentIds?: unknown; periodMonth?: unknown};
    const documentIds = Array.isArray(body.documentIds) ? [...new Set(body.documentIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))] : [];
    const periodMonth = typeof body.periodMonth === 'string' ? body.periodMonth : null;

    if (!documentIds.length) {
      return NextResponse.json({error: 'No receipt documents selected.'}, {status: 400});
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: {user}
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }

    const {data: profile, error: profileError} = await supabase.from('profiles').select('default_workspace_id').eq('id', user.id).single();

    if (profileError || !profile?.default_workspace_id) {
      return NextResponse.json({error: 'Workspace not found.'}, {status: 404});
    }

    const workspaceId = profile.default_workspace_id as string;
    const billing = await getWorkspaceBilling(supabase, workspaceId);

    if (!hasPaidAccess(billing) || normalizeBillingPlan(billing?.plan) !== 'portfolio') {
      return NextResponse.json({error: 'Portfolio is required to download batch receipt ZIP files.'}, {status: 403});
    }

    const {data: documents, error: documentsError} = await supabase
      .from('documents')
      .select('id, file_name, file_path, period_month, tenants(full_name)')
      .eq('workspace_id', workspaceId)
      .eq('document_type', 'rent_receipt')
      .in('id', documentIds)
      .returns<ReceiptDocument[]>();

    if (documentsError) {
      return NextResponse.json({error: documentsError.message}, {status: 500});
    }

    if (!documents?.length) {
      return NextResponse.json({error: 'No matching receipt documents found.'}, {status: 404});
    }

    const documentById = new Map(documents.map((document) => [document.id, document]));
    const zip = new JSZip();
    const receiptFolder = zip.folder('quittances');
    const manifest = {
      generatedAt: new Date().toISOString(),
      includedDocuments: [] as Array<{fileName: string; id: string}>,
      requestedDocuments: documentIds.length,
      warnings: [] as string[]
    };
    let index = 0;

    for (const documentId of documentIds) {
      const document = documentById.get(documentId);

      if (!document) {
        manifest.warnings.push(`Document not found or inaccessible: ${documentId}`);
        continue;
      }

      const {data, error} = await supabase.storage.from('documents').download(document.file_path);

      if (error || !data) {
        manifest.warnings.push(`Receipt could not be included: ${document.file_name}`);
        continue;
      }

      index += 1;
      const tenantPrefix = document.tenants?.full_name ? `${safeZipName(document.tenants.full_name)}-` : '';
      const fileName = `${String(index).padStart(3, '0')}-${tenantPrefix}${safeZipName(document.file_name)}`;
      const buffer = Buffer.from(await data.arrayBuffer());

      receiptFolder?.file(fileName, buffer);
      manifest.includedDocuments.push({
        fileName,
        id: document.id
      });
    }

    if (!manifest.includedDocuments.length) {
      return NextResponse.json({error: 'No receipt files could be included.'}, {status: 500});
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('README.txt', 'This ZIP contains rent receipts generated in Loyelio.\n');

    const zipBuffer = await zip.generateAsync({
      compression: 'DEFLATE',
      type: 'nodebuffer'
    });
    const responseBody = new Uint8Array(zipBuffer);

    return new NextResponse(responseBody, {
      headers: {
        'Content-Disposition': `attachment; filename="${zipFileName(periodMonth)}"`,
        'Content-Type': 'application/zip'
      }
    });
  } catch (error) {
    console.error('Quittance ZIP export failed', error);
    return NextResponse.json({error: 'Unable to generate receipt ZIP.'}, {status: 500});
  }
}
