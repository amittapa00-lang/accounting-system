/**
 * Invoice rules shared by the invoice API routes, pages and the create form.
 *
 * Client-safe: no server-only imports, so components/invoices/InvoiceForm.tsx can
 * use the same calculation as POST /api/invoices for its preview.
 */
import {
  calcDocumentTotals,
  compareMoney,
  hasAtMost2Decimals,
  parseNumber,
  round2,
  subtractMoney,
  toNumber,
  type DocumentTotals,
  type Numeric,
} from "@/lib/money";
import { lineHasAmount } from "@/lib/lines";
import { formatMoney, formatPercent, toDateInputValue, todayInputValue, yearMonthInThailand } from "@/lib/format";
import { OPEN_INVOICE_STATUSES, type DocumentType } from "@/lib/labels";

/** An issued, not fully paid invoice whose due date (Thai time) is before today. */
export function isInvoiceOverdue(status: string, dueDate: Date | string | null | undefined): boolean {
  if (!dueDate || !(OPEN_INVOICE_STATUSES as string[]).includes(status)) return false;
  return toDateInputValue(dueDate) < todayInputValue();
}

/** Item rows available in templates/invoice-template.xlsx (rows 18-39). */
export const INVOICE_EXCEL_MAX_ITEMS = 22;

/**
 * Statuses the user can pick from the status menu (invoice page and invoice list).
 * PARTIAL (part of the money received) is not offered: it comes from recording payments.
 */
export const INVOICE_STATUS_CHOICES = [
  { value: "DRAFT", label: "ยังไม่วางบิล" },
  { value: "ISSUED", label: "วางบิลแล้ว" },
  { value: "PAID", label: "รับเงินแล้ว" },
  { value: "CANCELLED", label: "ยกเลิก" },
] as const;

export type InvoiceStatusChoice = (typeof INVOICE_STATUS_CHOICES)[number]["value"];

export function isInvoiceStatusChoice(value: unknown): value is InvoiceStatusChoice {
  return INVOICE_STATUS_CHOICES.some((choice) => choice.value === value);
}

/**
 * Document type that goes with a status; set whenever the status changes (status menu, payments,
 * an edit that changes the status):
 *   ยังไม่วางบิล / ยกเลิก        -> ใบกำกับภาษี / ใบส่งของ / ใบแจ้งหนี้
 *   วางบิลแล้ว / รับเงินบางส่วน  -> ใบวางบิล / ใบแจ้งหนี้
 *   รับเงินแล้ว                  -> ใบเสร็จรับเงิน
 */
export function documentTypeForStatus(status: string): DocumentType {
  switch (status) {
    case "ISSUED":
    case "PARTIAL":
      return "BILLING_INVOICE";
    case "PAID":
      return "RECEIPT";
    default:
      return "TAX_INVOICE_DELIVERY";
  }
}

/** Label of a status in the status menu; PARTIAL included. */
export function invoiceStatusChoiceLabel(status: string): string {
  if (status === "PARTIAL") return "รับเงินบางส่วน";
  return INVOICE_STATUS_CHOICES.find((choice) => choice.value === status)?.label ?? status;
}

/** Statuses after the invoice has been issued (billed to the customer). */
export const BILLED_INVOICE_STATUSES = ["ISSUED", "PARTIAL", "PAID"];

export function isBilledInvoiceStatus(status: string) {
  return BILLED_INVOICE_STATUSES.includes(status);
}

// ---------------------------------------------------------------- Billing options

/**
 * The two ways an invoice bills its purchase order:
 *   PO      เลือกจากรายการ PO: the PO lines, by the quantity still unbilled (lib/invoice-billing.ts)
 *   CUSTOM  ทำรายการใหม่: lines typed on the invoice, not linked to PO lines
 * Either way the invoice is deducted from the PO total: all invoices of a PO (not cancelled)
 * together may bill at most the PO's total before VAT (poBalance).
 */
export const BILLING_MODES = ["PO", "CUSTOM"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

/** The VAT % of typed lines (one rate for the invoice): 0-100, at most 2 decimals. */
export function checkVatRate(value: unknown): { rate: number | null; error: string } {
  const rate = value === undefined || value === null || String(value).trim() === "" ? 0 : parseNumber(String(value).trim());
  if (rate === null || rate < 0 || rate > 100) return { rate: null, error: "VAT % ต้องอยู่ระหว่าง 0-100" };
  if (!hasAtMost2Decimals(rate)) return { rate: null, error: "VAT % มีทศนิยมได้ไม่เกิน 2 ตำแหน่ง" };
  return { rate, error: "" };
}

/** The VAT rate a saved invoice was worked out with (vat / subtotal), e.g. 7. */
export function vatRateOf(subtotal: Numeric, vat: Numeric): number {
  const base = toNumber(subtotal);
  if (base <= 0) return 0;
  const rate = (toNumber(vat) / base) * 100;
  // VAT is rounded to satang, so 7% may come back as 6.98 or 7.02: prefer the whole number
  return Math.abs(rate - Math.round(rate)) < 0.1 ? Math.round(rate) : round2(rate);
}

/**
 * Totals of typed lines (ทำรายการใหม่) at one VAT rate, with an optional bill discount.
 * Invoice lines have no VAT column, so the typed lines of an invoice share one rate.
 * `amount` is after the line discount; text lines (amount 0) do not count.
 */
export function customLineTotals(
  lines: { amount: number }[],
  vatRate: number,
  billDiscount?: { value: Numeric; type: string } | null
): DocumentTotals {
  return calcDocumentTotals(
    lines.filter((line) => line.amount > 0).map((line) => ({ amount: line.amount, vat: vatRate })),
    billDiscount
  );
}

/** What is left to bill on a PO (amounts before VAT). */
export type PoBalance = {
  /** the PO's total before VAT */
  total: number;
  /** invoices of the PO that are not cancelled, before VAT */
  billed: number;
  /** total - billed, never below 0 */
  remaining: number;
};

export function poBalance(total: Numeric, billed: Numeric): PoBalance {
  const left = subtractMoney(total, billed);
  return { total: toNumber(total), billed: toNumber(billed), remaining: Math.max(left, 0) };
}

/** Error text when an invoice of `subtotal` (before VAT) bills more than the PO has left, or "". */
export function poBalanceError(subtotal: Numeric, balance: PoBalance): string {
  if (compareMoney(subtotal, balance.remaining) <= 0) return "";
  return (
    `ยอดเรียกเก็บใบนี้ ${formatMoney(subtotal)} บาท (ก่อน VAT) เกินยอดคงเหลือของ PO ${formatMoney(balance.remaining)} บาท ` +
    `(ยอด PO ${formatMoney(balance.total)} เรียกเก็บแล้ว ${formatMoney(balance.billed)})`
  );
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
  /**
   * The PO line's amount after its discount: what gets billed. Unit Price is the price of the
   * job and is only printed, it is not used to work out the amount.
   */
  amount: Numeric;
};

/** Quantity still to bill on a PO line (never negative, 4 decimals like the column). */
export function remainingQuantity(poQuantity: Numeric, billed: Numeric): number {
  const left = Math.round((toNumber(poQuantity) - toNumber(billed)) * 10000) / 10000;
  return Math.max(left, 0);
}

/**
 * Amount for billing `quantity` units of a PO line when `billedBefore` units were billed on
 * earlier sub-invoices: the PO line's amount (after its discount), shared in proportion to the
 * quantity, cumulatively, so billing the whole line in parts adds up to exactly the PO amount.
 * A baht discount is shared the same way (for display); a percent discount stays as it is.
 * Unit Price is not used. Text lines (no price, no amount) have no amount.
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
  // Normally billedBefore + quantity <= PO quantity, and this changes nothing. Older data may
  // have billed a line past its PO quantity: the units billed now still get their share
  // (as the last part of the line) instead of nothing.
  const before = Math.max(0, Math.min(billedBefore, poQuantity - quantity));
  const part = (total: number) => {
    const share = (units: number) => (poQuantity > 0 ? round2((total * Math.min(units, poQuantity)) / poQuantity) : 0);
    return subtractMoney(share(before + quantity), share(before));
  };

  const amount = part(toNumber(line.amount));

  if (line.discountType === "AMOUNT" && toNumber(line.discount) !== 0) {
    return { amount, discount: part(toNumber(line.discount)), discountType: "AMOUNT" };
  }
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

// ---------------------------------------------------------------- Printed notes

/**
 * Text printed after the lines on the invoice form (PDF and Excel), one block each:
 *   1. the PO's เงื่อนไขการรับสินค้า / ตรวจรับ
 *   2. "หมายเหตุ: " + the PO's note, then the invoice's own note when it says something else
 * Blocks keep their line breaks; empty ones are left out.
 */
export function printedNoteBlocks(input: {
  acceptanceCondition?: string | null;
  purchaseOrderNote?: string | null;
  invoiceNote?: string | null;
}): string[] {
  const clean = (text: string | null | undefined) => (text ?? "").replace(/\r\n/g, "\n").trim();

  const blocks: string[] = [];
  const acceptance = clean(input.acceptanceCondition);
  if (acceptance) blocks.push(acceptance);

  const poNote = clean(input.purchaseOrderNote);
  const invoiceNote = clean(input.invoiceNote);
  // the invoice note starts as a copy of the PO note: print it only when it differs
  const note = [poNote, invoiceNote !== poNote ? invoiceNote : ""].filter(Boolean).join("\n");
  if (note) blocks.push(`หมายเหตุ: ${note}`);

  return blocks;
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
 * every sub-invoice shares that number (and its sub-number). A number typed by the user must
 * start with IV too. The Sale Order No. is typed by the user (no default; duplicates allowed).
 */
export const INVOICE_NUMBER_PREFIX = "IV";

/** "IV2026/" for an invoice date in 2026 (Thai time). */
export function invoiceYearPrefix(invoiceDate: Date): string {
  return `${INVOICE_NUMBER_PREFIX}${yearMonthInThailand(invoiceDate).year}/`;
}

/** "IV2026/" + 7 -> "IV2026/007" */
export function formatInvoiceNumber(prefix: string, running: number): string {
  return `${prefix}${String(running).padStart(3, "0")}`;
}

/**
 * Sale Order No. for comparing: spaces and letter case ignored, so "TC 2026/001-001" and
 * "tc2026/001-001" are the same (same rule as GET /api/invoices/sale-orders). "" = none.
 */
export function saleOrderKey(value: string | null | undefined): string {
  return (value ?? "").replace(/\s/g, "").toLowerCase();
}

/**
 * An invoice number may be shared with invoices of other POs when the Sale Order No. differs.
 * Returns the `holders` (invoices of other POs that already use the number, cancelled ones too)
 * that block using it with `saleOrderNumber`: those with the same Sale Order No. (blank counts as
 * a value, so a blank one is blocked by another blank one). Sub-invoices of the same PO share
 * their number anyway and are not passed in.
 */
export function blockingNumberHolders<T extends { saleOrderNumber: string | null }>(
  holders: T[],
  saleOrderNumber: string | null | undefined
): T[] {
  const key = saleOrderKey(saleOrderNumber);
  return holders.filter((holder) => saleOrderKey(holder.saleOrderNumber) === key);
}

/** "IV2026/001", "IV2026/001 (ใบย่อยที่ 2)", "IV2026/001 · TC 2026/001-001" */
export function invoiceNumberLabel(
  invoice: { invoiceNumber: string; subNumber: number; saleOrderNumber?: string | null },
  withSaleOrder = false
): string {
  const sub = invoice.subNumber > 1 ? ` (ใบย่อยที่ ${invoice.subNumber})` : "";
  const saleOrder = withSaleOrder && invoice.saleOrderNumber ? ` · ${invoice.saleOrderNumber}` : "";
  return `${invoice.invoiceNumber}${sub}${saleOrder}`;
}

/** Why `invoiceNumber` cannot be used with `saleOrderNumber` because of `blocking`, or "". */
export function invoiceNumberTakenMessage(
  invoiceNumber: string,
  saleOrderNumber: string | null | undefined,
  blocking: { invoiceNumber: string; subNumber: number; saleOrderNumber: string | null }[]
): string {
  if (blocking.length === 0) return "";
  const shown = blocking.slice(0, 3).map((invoice) => invoiceNumberLabel(invoice, true));
  const used = `${shown.join(", ")}${blocking.length > 3 ? ` และอีก ${blocking.length - 3} ใบ` : ""}`;
  return saleOrderKey(saleOrderNumber)
    ? `เลข ${invoiceNumber} กับ Sale Order No. นี้ถูกใช้แล้ว (${used}) กรุณาใช้เลขอื่น หรือ Sale Order No. อื่น`
    : // blank: the blocking invoices have no Sale Order No. either
      `เลข ${invoiceNumber} ถูกใช้แล้ว (${used}) ถ้าจะใช้เลขเดียวกัน กรุณากรอก Sale Order No. ที่ต่างจากใบเดิม`;
}
