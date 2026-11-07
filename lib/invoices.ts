/**
 * Invoice rules shared by the invoice API routes, pages and the create form.
 *
 * Client-safe: no server-only imports, so components/invoices/InvoiceForm.tsx can
 * use the same calculation as POST /api/invoices for its preview.
 */
import { calcLine, calcTotals, toNumber, type Numeric, type Totals } from "@/lib/money";
import { formatMoney, formatPercent, yearMonthInThailand } from "@/lib/format";

/** Item rows available in templates/invoice-template.xlsx (rows 18-39). */
export const INVOICE_EXCEL_MAX_ITEMS = 22;

/** Statuses after the invoice has been issued (billed to the customer). */
export const BILLED_INVOICE_STATUSES = ["ISSUED", "PARTIAL", "PAID"];

export function isBilledInvoiceStatus(status: string) {
  return BILLED_INVOICE_STATUSES.includes(status);
}

// ---------------------------------------------------------------- Lines and totals

export type PoLineForInvoice = {
  quantity: Numeric;
  unitPrice: Numeric;
  discount: Numeric;
  discountType: string | null;
  /** VAT rate in percent (7 = 7%) */
  vat: Numeric;
};

/**
 * Invoice line amounts and document totals for the lines of a purchase order.
 * amount = calcLine(PO line).amount; totals = calcTotals(amount + PO VAT rate).
 */
export function invoiceLinesFromPo<T extends PoLineForInvoice>(
  items: T[]
): { lines: { item: T; amount: number }[]; totals: Totals } {
  const lines = items.map((item) => ({ item, amount: calcLine(item).amount }));
  const totals = calcTotals(lines.map((line) => ({ amount: line.amount, vat: line.item.vat })));
  return { lines, totals };
}

// ---------------------------------------------------------------- Display

/** Discount of a line as shown on documents: "10%", "50.00", or "" when there is none. */
export function formatLineDiscount(discount: Numeric, discountType: string | null | undefined): string {
  if (toNumber(discount) === 0) return "";
  return discountType === "AMOUNT" ? formatMoney(discount) : formatPercent(discount);
}

/** Quantity without trailing zeros: 1 -> "1", 1.5 -> "1.5", 1234 -> "1,234". */
export function formatQuantity(value: Numeric): string {
  return toNumber(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

// ---------------------------------------------------------------- Numbering

/** Prefix of the running number for an invoice date, by month in Thai time: "INV-202611-". */
export function invoiceNumberPrefix(invoiceDate: Date): string {
  const { year, month } = yearMonthInThailand(invoiceDate);
  return `INV-${year}${month}-`;
}

/** "INV-202611-" + 7 -> "INV-202611-0007" */
export function formatInvoiceNumber(prefix: string, running: number): string {
  return `${prefix}${String(running).padStart(4, "0")}`;
}
