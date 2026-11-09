/**
 * Invoice rules shared by the invoice API routes, pages and the create form.
 *
 * Client-safe: no server-only imports, so components/invoices/InvoiceForm.tsx can
 * use the same calculation as POST /api/invoices for its preview.
 */
import {
  calcDocumentTotals,
  calcLine,
  round2,
  subtractMoney,
  toNumber,
  type DocumentTotals,
  type Numeric,
} from "@/lib/money";
import { lineHasAmount } from "@/lib/lines";
import { formatMoney, formatPercent, toDateInputValue, todayInputValue, yearMonthInThailand } from "@/lib/format";
import { OPEN_INVOICE_STATUSES } from "@/lib/labels";

/** An issued, not fully paid invoice whose due date (Thai time) is before today. */
export function isInvoiceOverdue(status: string, dueDate: Date | string | null | undefined): boolean {
  if (!dueDate || !(OPEN_INVOICE_STATUSES as string[]).includes(status)) return false;
  return toDateInputValue(dueDate) < todayInputValue();
}

/** Item rows available in templates/invoice-template.xlsx (rows 18-39). */
export const INVOICE_EXCEL_MAX_ITEMS = 22;

/** Statuses after the invoice has been issued (billed to the customer). */
export const BILLED_INVOICE_STATUSES = ["ISSUED", "PARTIAL", "PAID"];

export function isBilledInvoiceStatus(status: string) {
  return BILLED_INVOICE_STATUSES.includes(status);
}

// ---------------------------------------------------------------- Lines and totals

/** A PO line as needed to bill it on an invoice. */
export type PoLineForInvoice = {
  lineType?: string | null;
  quantity: Numeric;
  unitPrice: Numeric;
  discount: Numeric;
  discountType: string | null;
  /** VAT rate in percent (7 = 7%) */
  vat: Numeric;
};

/** Quantity still to bill on a PO line (never negative, 4 decimals like the column). */
export function remainingQuantity(poQuantity: Numeric, billed: Numeric): number {
  const left = Math.round((toNumber(poQuantity) - toNumber(billed)) * 10000) / 10000;
  return Math.max(left, 0);
}

/**
 * Amount for billing `quantity` units of a PO line when `billedBefore` units were billed on
 * earlier sub-invoices. A PERCENT discount applies as is. An AMOUNT (baht) discount is shared
 * in proportion to the quantity, cumulatively, so billing the whole line in parts adds up to
 * exactly the PO's discount and amount. Text lines (no unit price) have no amount.
 */
export function partialLine(
  line: PoLineForInvoice,
  quantity: number,
  billedBefore = 0
): { amount: number; discount: number; discountType: string } {
  if (!lineHasAmount(line)) {
    return { amount: 0, discount: 0, discountType: "PERCENT" };
  }

  const poQuantity = toNumber(line.quantity);

  if (line.discountType === "AMOUNT" && toNumber(line.discount) !== 0) {
    const total = toNumber(line.discount);
    const share = (units: number) => (poQuantity > 0 ? round2((total * Math.min(units, poQuantity)) / poQuantity) : 0);
    const discount = subtractMoney(share(billedBefore + quantity), share(billedBefore));
    const { amount } = calcLine({ quantity, unitPrice: line.unitPrice, discount, discountType: "AMOUNT" });
    return { amount, discount, discountType: "AMOUNT" };
  }

  const { amount } = calcLine({ quantity, unitPrice: line.unitPrice, discount: line.discount, discountType: line.discountType });
  return { amount, discount: toNumber(line.discount), discountType: line.discountType ?? "PERCENT" };
}

/**
 * Lines and totals of a (sub-)invoice: the chosen PO lines with the quantity billed this time,
 * plus an optional bill discount. Used by POST /api/invoices and the create form's preview.
 */
export function buildInvoiceLines<T extends PoLineForInvoice>(
  selection: { line: T; quantity: number; billedBefore?: number }[],
  billDiscount?: { value: Numeric; type: string } | null
): { lines: { line: T; quantity: number; amount: number; discount: number; discountType: string }[]; totals: DocumentTotals } {
  const lines = selection.map(({ line, quantity, billedBefore }) => ({
    line,
    quantity: lineHasAmount(line) ? quantity : 0,
    ...partialLine(line, quantity, billedBefore ?? 0),
  }));

  const totals = calcDocumentTotals(
    lines.filter(({ line }) => lineHasAmount(line)).map(({ line, amount }) => ({ amount, vat: line.vat })),
    billDiscount
  );

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

/**
 * Invoice numbers run per calendar year (C.E., Thai time, by invoice date): IV2026/001, IV2026/002 ...
 * and start again at 001 every year. One PO keeps one invoice number; when it is billed in parts,
 * every sub-invoice shares that number and is told apart by its Sale Order No.
 */
export const INVOICE_NUMBER_PREFIX = "IV";
export const SALE_ORDER_PREFIX = "TC";

/** "IV2026/" for an invoice date in 2026 (Thai time). */
export function invoiceYearPrefix(invoiceDate: Date): string {
  return `${INVOICE_NUMBER_PREFIX}${yearMonthInThailand(invoiceDate).year}/`;
}

/** "IV2026/" + 7 -> "IV2026/007" */
export function formatInvoiceNumber(prefix: string, running: number): string {
  return `${prefix}${String(running).padStart(3, "0")}`;
}

/** Default Sale Order No. of a sub-invoice: ("IV2026/001", 2) -> "TC 2026/001-002". */
export function defaultSaleOrderNumber(invoiceNumber: string, subNumber: number): string {
  const base = invoiceNumber.trim().replace(/^IV\s*/i, "");
  return `${SALE_ORDER_PREFIX} ${base}-${String(subNumber).padStart(3, "0")}`;
}
