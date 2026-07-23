import PDFDocument from 'pdfkit';
import {NextResponse} from 'next/server';

import {hasPaidAccess, normalizeBillingPlan} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Relation<T> = T | T[] | null;
type LeaseRow = {
  charges_amount: number | null;
  end_date: string | null;
  id: string;
  monthly_rent: number | null;
  properties: Relation<{name: string}>;
  rent_charges: {period_month: string; rent_payments: {amount: number | null; notes: string | null}[]; status: string}[];
  start_date: string;
  tenants: Relation<{full_name: string}>;
};

function relationOne<T>(value: Relation<T>) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function addMonth(month: string) {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, index, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function isRentPayment(notes: string | null) {
  return !notes?.startsWith('[[loyelio:revenue_type=deposit]]') && !notes?.startsWith('[[loyelio:revenue_type=other]]');
}

function buildPdf(input: {locale: string; month: string; rows: Array<{collected: number; due: number; property: string; status: string; tenant: string}>; view: string}) {
  const doc = new PDFDocument({margin: 42, size: 'A4'});
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const money = new Intl.NumberFormat(input.locale === 'zh' ? 'fr-FR' : input.locale, {currency: 'EUR', style: 'currency'});
  const expected = input.rows.reduce((sum, row) => sum + row.due, 0);
  const collected = input.rows.reduce((sum, row) => sum + row.collected, 0);

  doc.fontSize(22).fillColor('#006f61').text('Loyelio');
  doc.moveDown(0.4).fontSize(18).fillColor('#17201e').text(`Monthly collection report - ${input.month}`);
  doc.moveDown(0.3).fontSize(10).fillColor('#66736f').text(`Filter: ${input.view}  |  Generated: ${new Date().toISOString().slice(0, 10)}`);
  doc.moveDown(1);
  doc.fontSize(12).fillColor('#17201e').text(`Expected: ${money.format(expected)}    Collected: ${money.format(collected)}    Remaining: ${money.format(Math.max(0, expected - collected))}`);
  doc.moveDown(1);

  for (const row of input.rows) {
    if (doc.y > 730) doc.addPage();
    doc.fontSize(11).fillColor('#17201e').text(`${row.tenant} - ${row.property}`, {continued: false});
    doc.fontSize(9).fillColor('#66736f').text(`${row.status.toUpperCase()}  |  ${money.format(row.collected)} / ${money.format(row.due)}`);
    doc.moveDown(0.5).strokeColor('#dce5e1').moveTo(42, doc.y).lineTo(553, doc.y).stroke().moveDown(0.7);
  }

  doc.end();
  return done;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') ?? '';
  const view = url.searchParams.get('view') ?? 'all';
  const locale = url.searchParams.get('locale') ?? 'fr';

  if (!/^\d{4}-\d{2}$/.test(month) || !['all', 'open', 'unpaid', 'partial', 'paid'].includes(view)) {
    return NextResponse.json({error: 'Invalid report filters.'}, {status: 400});
  }

  const supabase = await createSupabaseServerClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  const {data: profile} = await supabase.from('profiles').select('default_workspace_id').eq('id', user.id).single<{default_workspace_id: string | null}>();
  if (!profile?.default_workspace_id) return NextResponse.json({error: 'Workspace not found.'}, {status: 404});
  const workspaceId = profile.default_workspace_id;
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  if (!hasPaidAccess(billing) || normalizeBillingPlan(billing?.plan) !== 'portfolio') return NextResponse.json({error: 'Portfolio required.'}, {status: 403});

  const periodMonth = `${month}-01`;
  const nextMonth = addMonth(month);
  const {data: leases, error} = await supabase
    .from('leases')
    .select('id, start_date, end_date, monthly_rent, charges_amount, tenants(full_name), properties(name), rent_charges(period_month, status, rent_payments(amount, notes))')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .returns<LeaseRow[]>();
  if (error) return NextResponse.json({error: error.message}, {status: 500});

  const rows = (leases ?? []).flatMap((lease) => {
    if (!(lease.start_date < nextMonth && (!lease.end_date || lease.end_date >= periodMonth))) return [];
    const charge = lease.rent_charges.find((item) => item.period_month === periodMonth);
    const status = charge?.status === 'paid' || charge?.status === 'partial' ? charge.status : 'unpaid';
    if (view !== 'all' && (view === 'open' ? status === 'paid' : status !== view)) return [];
    return [{
      collected: (charge?.rent_payments ?? []).filter((payment) => isRentPayment(payment.notes)).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
      due: Number(lease.monthly_rent ?? 0) + Number(lease.charges_amount ?? 0),
      property: relationOne(lease.properties)?.name ?? '-',
      status,
      tenant: relationOne(lease.tenants)?.full_name ?? '-'
    }];
  });
  const pdf = await buildPdf({locale, month, rows, view});

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Disposition': `attachment; filename="loyelio-collections-${month}.pdf"`,
      'Content-Type': 'application/pdf'
    }
  });
}
