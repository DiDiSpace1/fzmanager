import PDFDocument from 'pdfkit';
import type {SupabaseClient} from '@supabase/supabase-js';

export type RentExportRow = {
  charges_amount: number;
  due_date: string | null;
  period_month: string;
  rent_amount: number;
  status: string;
  total_due: number;
  leases: {
    property_id?: string;
    properties: {
      name: string;
    } | null;
    tenants: {
      full_name: string;
    } | null;
    units: {
      name: string;
    } | null;
  } | null;
};

export type ExpenseExportRow = {
  amount: number;
  currency: string;
  description: string | null;
  expense_date: string;
  receipt_status: string;
  vendor: string | null;
  documents: {
    file_name: string;
    file_path: string;
  } | null;
  properties: {
    name: string;
  } | null;
  tax_categories: {
    label: string;
  } | null;
};

export type TaxExportData = {
  expenses: ExpenseExportRow[];
  rentCharges: RentExportRow[];
  workspaceId: string;
  year: number;
};

export function yearRange(year: number) {
  return {
    end: `${year + 1}-01-01`,
    start: `${year}-01-01`
  };
}

export function parseExportYear(yearParam: string | null) {
  const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear();

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return null;
  }

  return year;
}

export async function getWorkspaceIdForUser(supabase: SupabaseClient, userId: string) {
  const {data: profile, error} = await supabase
    .from('profiles')
    .select('default_workspace_id')
    .eq('id', userId)
    .single();

  if (error || !profile?.default_workspace_id) {
    return null;
  }

  return profile.default_workspace_id as string;
}

export async function fetchTaxExportData(input: {
  propertyId?: string | null;
  supabase: SupabaseClient;
  workspaceId: string;
  year: number;
}): Promise<{data?: TaxExportData; error?: string}> {
  const range = yearRange(input.year);
  let rentQuery = input.supabase
    .from('rent_charges')
    .select('period_month, due_date, rent_amount, charges_amount, total_due, status, leases!inner(property_id, properties(name), tenants(full_name), units(name))')
    .eq('workspace_id', input.workspaceId)
    .gte('period_month', range.start)
    .lt('period_month', range.end);

  if (input.propertyId) {
    rentQuery = rentQuery.eq('leases.property_id', input.propertyId);
  }

  const {data: rentCharges, error: rentError} = await rentQuery.order('period_month', {ascending: true}).returns<RentExportRow[]>();

  if (rentError) {
    return {error: rentError.message};
  }

  let expenseQuery = input.supabase
    .from('expenses')
    .select('expense_date, amount, currency, vendor, description, receipt_status, properties(name), tax_categories(label), documents(file_name, file_path)')
    .eq('workspace_id', input.workspaceId)
    .gte('expense_date', range.start)
    .lt('expense_date', range.end);

  if (input.propertyId) {
    expenseQuery = expenseQuery.eq('property_id', input.propertyId);
  }

  const {data: expenses, error: expenseError} = await expenseQuery.order('expense_date', {ascending: true}).returns<ExpenseExportRow[]>();

  if (expenseError) {
    return {error: expenseError.message};
  }

  return {
    data: {
      expenses: expenses ?? [],
      rentCharges: rentCharges ?? [],
      workspaceId: input.workspaceId,
      year: input.year
    }
  };
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(',');
}

export function getTaxExportTotals(data: TaxExportData) {
  const incomeTotal = data.rentCharges.reduce((sum, row) => sum + Number(row.total_due), 0);
  const expenseTotal = data.expenses.reduce((sum, row) => sum + Number(row.amount), 0);
  const missingReceipts = data.expenses.filter((expense) => expense.receipt_status === 'missing');

  return {
    expenseTotal,
    incomeTotal,
    missingReceipts,
    netBeforeChecks: incomeTotal - expenseTotal
  };
}

export function buildTaxCsv(data: TaxExportData) {
  const rows: string[] = [];
  const totals = getTaxExportTotals(data);

  rows.push(csvRow(['Loyelio tax export', data.year]));
  rows.push(csvRow(['Generated at', new Date().toISOString()]));
  rows.push(csvRow([]));
  rows.push(csvRow(['Summary']));
  rows.push(csvRow(['Expected rent income', totals.incomeTotal.toFixed(2), 'EUR']));
  rows.push(csvRow(['Expenses', totals.expenseTotal.toFixed(2), 'EUR']));
  rows.push(csvRow(['Net before accounting checks', totals.netBeforeChecks.toFixed(2), 'EUR']));
  rows.push(csvRow(['Missing receipts', totals.missingReceipts.length]));
  rows.push(csvRow([]));

  rows.push(csvRow(['Rent charges']));
  rows.push(csvRow(['Month', 'Due date', 'Property', 'Unit', 'Tenant', 'Rent', 'Charges', 'Total due', 'Status']));
  for (const charge of data.rentCharges) {
    rows.push(
      csvRow([
        charge.period_month,
        charge.due_date,
        charge.leases?.properties?.name,
        charge.leases?.units?.name,
        charge.leases?.tenants?.full_name,
        Number(charge.rent_amount).toFixed(2),
        Number(charge.charges_amount).toFixed(2),
        Number(charge.total_due).toFixed(2),
        charge.status
      ])
    );
  }

  rows.push(csvRow([]));
  rows.push(csvRow(['Expenses']));
  rows.push(csvRow(['Date', 'Property', 'Category', 'Vendor', 'Amount', 'Currency', 'Receipt status', 'Document', 'Description']));
  for (const expense of data.expenses) {
    rows.push(
      csvRow([
        expense.expense_date,
        expense.properties?.name,
        expense.tax_categories?.label,
        expense.vendor,
        Number(expense.amount).toFixed(2),
        expense.currency,
        expense.receipt_status,
        expense.documents?.file_name,
        expense.description
      ])
    );
  }

  rows.push(csvRow([]));
  rows.push(csvRow(['Disclaimer']));
  rows.push(csvRow(['This export is a preparation file and does not replace tax or accounting advice.']));

  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

export async function buildTaxPdf(data: TaxExportData) {
  const totals = getTaxExportTotals(data);
  const doc = new PDFDocument({margin: 48, size: 'A4'});
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  doc.fontSize(22).text('Loyelio - Tax preparation summary');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#555555').text(`Year: ${data.year}`);
  doc.text(`Generated at: ${new Date().toISOString()}`);
  doc.moveDown();

  doc.fillColor('#000000').fontSize(15).text('Summary');
  doc.moveDown(0.5);
  doc.fontSize(11);
  doc.text(`Expected rent income: ${totals.incomeTotal.toFixed(2)} EUR`);
  doc.text(`Expenses: ${totals.expenseTotal.toFixed(2)} EUR`);
  doc.text(`Net before accounting checks: ${totals.netBeforeChecks.toFixed(2)} EUR`);
  doc.text(`Missing receipts: ${totals.missingReceipts.length}`);
  doc.moveDown();

  doc.fontSize(15).text('Expense categories');
  doc.moveDown(0.5);
  const categoryTotals = new Map<string, number>();
  for (const expense of data.expenses) {
    const label = expense.tax_categories?.label ?? 'Uncategorized';
    categoryTotals.set(label, (categoryTotals.get(label) ?? 0) + Number(expense.amount));
  }
  if (categoryTotals.size) {
    for (const [label, total] of [...categoryTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      doc.fontSize(10).text(`${label}: ${total.toFixed(2)} EUR`);
    }
  } else {
    doc.fontSize(10).text('No expenses recorded.');
  }
  doc.moveDown();

  doc.fontSize(15).text('Missing receipts');
  doc.moveDown(0.5);
  if (totals.missingReceipts.length) {
    for (const expense of totals.missingReceipts.slice(0, 20)) {
      doc.fontSize(10).text(`${expense.expense_date} - ${expense.vendor ?? expense.tax_categories?.label ?? 'Expense'} - ${Number(expense.amount).toFixed(2)} EUR`);
    }
  } else {
    doc.fontSize(10).text('No missing receipts.');
  }
  doc.moveDown();

  doc.fontSize(9).fillColor('#7a4a11').text('Disclaimer: This document is a preparation summary and does not replace tax or accounting advice.');

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  return Buffer.concat(chunks);
}
