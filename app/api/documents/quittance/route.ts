import {revalidatePath} from 'next/cache';
import {NextResponse} from 'next/server';

import {createQuittanceDocument, QuittanceGenerationError} from '@/lib/quittance/service';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export const runtime = 'nodejs';

function moneyValue(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ownerName = String(body.ownerName ?? '').trim();
    const propertyId = String(body.propertyId ?? '').trim();
    const tenantId = String(body.tenantId ?? '').trim();
    const periodMonth = String(body.periodMonth ?? '').trim();
    const paidAt = String(body.paidAt ?? '').trim();
    const paymentMethod = String(body.paymentMethod ?? 'bank_transfer').trim();
    const amount = moneyValue(body.amount);
    const charges = moneyValue(body.charges);

    if (!propertyId || !ownerName || !/^\d{4}-\d{2}$/.test(periodMonth) || !paidAt || amount <= 0 || charges < 0) {
      return NextResponse.json({error: 'Veuillez completer les informations de quittance.'}, {status: 400});
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: {user}
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({error: 'Non authentifie.'}, {status: 401});
    }

    const {data: profile, error: profileError} = await supabase.from('profiles').select('default_workspace_id').eq('id', user.id).single();

    if (profileError || !profile?.default_workspace_id) {
      return NextResponse.json({error: 'Espace de travail introuvable.'}, {status: 400});
    }

    const workspaceId = profile.default_workspace_id as string;
    const receipt = await createQuittanceDocument(supabase, workspaceId, {
      amount,
      charges,
      ownerName,
      paidAt,
      paymentMethod,
      periodMonth,
      propertyId,
      tenantId: tenantId || null
    });

    const {data: signed} = await supabase.storage.from('documents').createSignedUrl(receipt.filePath, 60 * 10, {
      download: receipt.fileName
    });

    revalidatePath('/documents');
    revalidatePath('/documents/quittance');

    return NextResponse.json({
      documentId: receipt.documentId,
      downloadUrl: signed?.signedUrl ?? null
    });
  } catch (error) {
    if (error instanceof QuittanceGenerationError) {
      return NextResponse.json({error: error.message}, {status: error.status});
    }

    console.error('Quittance route failed', error);
    return NextResponse.json({error: 'Impossible de generer la quittance.'}, {status: 500});
  }
}
