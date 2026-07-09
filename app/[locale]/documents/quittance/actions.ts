'use server';

import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import PDFDocument from 'pdfkit';

import {canCreateResource} from '@/lib/billing/limits';
import {localizedPath} from '@/lib/navigation';
import {getCurrentUserWorkspace} from '@/lib/workspace';

type GenerateQuittanceResult =
  | {
      documentId: string;
      downloadUrl: string | null;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

type LeaseForReceipt = {
  id: string;
  property_id: string;
  tenant_id: string;
  unit_id: string | null;
  properties: {
    address_line1: string | null;
    city: string | null;
    name: string;
    postal_code: string | null;
  } | null;
  tenants: {
    full_name: string;
  } | null;
  units: {
    name: string;
  } | null;
};

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function moneyValue(formData: FormData, key: string) {
  const parsed = Number.parseFloat(value(formData, key).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

function monthStart(month: string) {
  return `${month}-01`;
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {month: 'long', year: 'numeric'}).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function formatMoney(amount: number) {
  return `${amount.toLocaleString('fr-FR', {maximumFractionDigits: 2, minimumFractionDigits: 2})} EUR`;
}

function paymentLabel(method: string) {
  if (method === 'cash') {
    return 'Especes';
  }

  if (method === 'cheque') {
    return 'Cheque';
  }

  if (method === 'card') {
    return 'Carte bancaire';
  }

  if (method === 'other') {
    return 'Autre';
  }

  return 'Virement bancaire';
}

async function buildQuittancePdf(input: {
  amount: number;
  charges: number;
  lease: LeaseForReceipt;
  ownerName: string;
  paidAt: string;
  paymentMethod: string;
  periodMonth: string;
}) {
  const doc = new PDFDocument({margin: 56, size: 'A4'});
  const chunks: Buffer[] = [];
  const total = input.amount + input.charges;
  const propertyLines = [input.lease.properties?.name, input.lease.units?.name, input.lease.properties?.address_line1, [input.lease.properties?.postal_code, input.lease.properties?.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join('\n');

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  doc.fillColor('#171d1c').fontSize(23).text('Quittance de loyer', {align: 'center'});
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#3d4947').text(`Periode: ${formatMonth(input.periodMonth)}`, {align: 'center'});
  doc.moveDown(2);

  doc.fillColor('#171d1c').fontSize(12).text('Proprietaire', {continued: false});
  doc.fontSize(11).fillColor('#3d4947').text(input.ownerName || '-');
  doc.moveDown();

  doc.fillColor('#171d1c').fontSize(12).text('Locataire');
  doc.fontSize(11).fillColor('#3d4947').text(input.lease.tenants?.full_name ?? '-');
  doc.moveDown();

  doc.fillColor('#171d1c').fontSize(12).text('Bien loue');
  doc.fontSize(11).fillColor('#3d4947').text(propertyLines || '-');
  doc.moveDown(1.5);

  doc.fillColor('#171d1c').fontSize(13).text('Detail du paiement');
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`Loyer hors charges: ${formatMoney(input.amount)}`);
  doc.text(`Charges: ${formatMoney(input.charges)}`);
  doc.fontSize(12).fillColor('#00685f').text(`Total recu: ${formatMoney(total)}`);
  doc.fillColor('#3d4947').fontSize(11).text(`Date de paiement: ${input.paidAt}`);
  doc.text(`Mode de paiement: ${paymentLabel(input.paymentMethod)}`);
  doc.moveDown(1.5);

  doc.fillColor('#171d1c').fontSize(11).text(
    `Je soussigne ${input.ownerName || 'le proprietaire'} reconnais avoir recu de ${input.lease.tenants?.full_name ?? 'le locataire'} la somme de ${formatMoney(total)} au titre du loyer et des charges pour la periode ${formatMonth(input.periodMonth)}.`
  );
  doc.moveDown(2);
  doc.text(`Fait le ${new Date().toLocaleDateString('fr-FR')}`);
  doc.moveDown(2);
  doc.text('Signature du proprietaire');

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  return Buffer.concat(chunks);
}

export async function generateQuittanceAction(formData: FormData): Promise<GenerateQuittanceResult> {
  const locale = value(formData, 'locale') || 'fr';
  const leaseId = value(formData, 'lease_id');
  const ownerName = value(formData, 'owner_name');
  const periodMonth = value(formData, 'period_month');
  const paidAt = value(formData, 'paid_at');
  const paymentMethod = value(formData, 'payment_method') || 'bank_transfer';
  const amount = moneyValue(formData, 'amount');
  const charges = moneyValue(formData, 'charges');

  if (!leaseId || !ownerName || !/^\d{4}-\d{2}$/.test(periodMonth) || !paidAt || amount <= 0 || charges < 0) {
    return {error: 'Veuillez completer les informations de quittance.', ok: false};
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const planGate = await canCreateResource(supabase, workspaceId, 'documents');

  if (!planGate.allowed) {
    return {error: 'Votre plan ne permet pas de creer plus de documents.', ok: false};
  }

  const {data: lease, error: leaseError} = await supabase
    .from('leases')
    .select('id, property_id, tenant_id, unit_id, properties(name, address_line1, postal_code, city), units(name), tenants(full_name)')
    .eq('id', leaseId)
    .eq('workspace_id', workspaceId)
    .single()
    .returns<LeaseForReceipt>();

  if (leaseError || !lease) {
    return {error: 'Bail introuvable pour cet espace.', ok: false};
  }

  const pdf = await buildQuittancePdf({amount, charges, lease, ownerName, paidAt, paymentMethod, periodMonth});
  const documentId = randomUUID();
  const fileName = safeFileName(`Quittance_${periodMonth}_${lease.tenants?.full_name ?? 'locataire'}.pdf`);
  const year = new Date().getUTCFullYear();
  const filePath = `workspace/${workspaceId}/documents/${year}/${documentId}-${fileName}`;
  const {error: uploadError} = await supabase.storage.from('documents').upload(filePath, new Blob([new Uint8Array(pdf)], {type: 'application/pdf'}), {
    contentType: 'application/pdf',
    upsert: false
  });

  if (uploadError) {
    return {error: "Impossible d'enregistrer le PDF.", ok: false};
  }

  const {error: insertError} = await supabase.from('documents').insert({
    document_type: 'rent_receipt',
    extracted_amount: amount + charges,
    extracted_date: paidAt,
    file_name: fileName,
    file_path: filePath,
    id: documentId,
    mime_type: 'application/pdf',
    period_month: monthStart(periodMonth),
    property_id: lease.property_id,
    tenant_id: lease.tenant_id,
    unit_id: lease.unit_id,
    size_bytes: pdf.byteLength,
    workspace_id: workspaceId
  });

  if (insertError) {
    await supabase.storage.from('documents').remove([filePath]);
    return {error: 'Impossible de creer le document quittance.', ok: false};
  }

  const {data: signed} = await supabase.storage.from('documents').createSignedUrl(filePath, 60 * 10, {
    download: fileName
  });

  revalidatePath(localizedPath(locale, '/documents'));
  revalidatePath(localizedPath(locale, '/documents/quittance'));

  return {
    documentId,
    downloadUrl: signed?.signedUrl ?? null,
    ok: true
  };
}
