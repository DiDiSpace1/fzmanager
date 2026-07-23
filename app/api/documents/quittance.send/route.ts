import {NextResponse} from 'next/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getWorkspaceBilling} from '@/lib/billing/limits';

export const runtime = 'nodejs';

const DEFAULT_FROM_EMAIL = 'Loyelio <noreply@loyelio.com>';

type Relation<T> = T | T[] | null;

type ReceiptDocument = {
  file_name: string;
  file_path: string;
  id: string;
  period_month: string | null;
  tenants: Relation<{email: string | null; full_name: string}>;
};

function relationOne<T>(value: Relation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatMonth(value: string | null) {
  if (!value) {
    return 'votre loyer';
  }

  return new Intl.DateTimeFormat('fr-FR', {month: 'long', timeZone: 'UTC', year: 'numeric'}).format(new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`));
}

async function sendReceiptEmail(input: {attachmentBase64: string; fileName: string; periodMonth: string | null; tenantEmail: string; tenantName: string}) {
  const apiKey = process.env.RESEND_KEY;

  if (!apiKey) {
    throw new Error('Missing RESEND_KEY.');
  }

  const monthLabel = formatMonth(input.periodMonth);
  const subject = `Votre quittance de loyer - ${monthLabel}`;
  const text = [
    `Bonjour ${input.tenantName},`,
    '',
    `Veuillez trouver en pièce jointe votre quittance de loyer pour ${monthLabel}.`,
    '',
    'Cordialement,',
    'Votre bailleur'
  ].join('\n');
  const html = `
    <p>Bonjour ${input.tenantName},</p>
    <p>Veuillez trouver en pièce jointe votre quittance de loyer pour <strong>${monthLabel}</strong>.</p>
    <p>Cordialement,<br>Votre bailleur</p>
  `;
  const response = await fetch('https://api.resend.com/emails', {
    body: JSON.stringify({
      attachments: [
        {
          content: input.attachmentBase64,
          filename: input.fileName
        }
      ],
      from: process.env.RENT_REMINDER_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      html,
      subject,
      text,
      to: input.tenantEmail
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });
  const result = (await response.json().catch(() => ({}))) as {message?: string};

  if (!response.ok) {
    throw new Error(result.message || `Resend returned ${response.status}.`);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {documentIds?: unknown};
    const documentIds = Array.isArray(body.documentIds) ? [...new Set(body.documentIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))] : [];

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
      return NextResponse.json({error: 'Portfolio is required to batch-send receipts.'}, {status: 403});
    }

    const {data: documents, error: documentsError} = await supabase
      .from('documents')
      .select('id, file_name, file_path, period_month, tenants(full_name, email)')
      .eq('workspace_id', workspaceId)
      .eq('document_type', 'rent_receipt')
      .in('id', documentIds)
      .returns<ReceiptDocument[]>();

    if (documentsError) {
      return NextResponse.json({error: documentsError.message}, {status: 500});
    }

    const documentById = new Map((documents ?? []).map((document) => [document.id, document]));
    const result = {
      failed: 0,
      missingEmail: 0,
      notFound: 0,
      sent: 0
    };

    for (const documentId of documentIds) {
      const document = documentById.get(documentId);

      if (!document) {
        result.notFound += 1;
        continue;
      }

      const tenant = relationOne(document.tenants);

      if (!tenant?.email) {
        result.missingEmail += 1;
        continue;
      }

      const {data, error} = await supabase.storage.from('documents').download(document.file_path);

      if (error || !data) {
        result.failed += 1;
        continue;
      }

      try {
        const buffer = Buffer.from(await data.arrayBuffer());
        await sendReceiptEmail({
          attachmentBase64: buffer.toString('base64'),
          fileName: document.file_name,
          periodMonth: document.period_month,
          tenantEmail: tenant.email,
          tenantName: tenant.full_name
        });
        result.sent += 1;
      } catch (error) {
        console.error('Receipt email send failed', {documentId: document.id, error, workspaceId});
        result.failed += 1;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Batch receipt send failed', error);
    return NextResponse.json({error: 'Unable to send receipts.'}, {status: 500});
  }
}
