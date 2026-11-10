/**
 * Request-body parsing shared by POST /api/invoices and PUT /api/invoices/[id].
 * Not a route (only route.ts files are routable), just colocated with the handlers that use it.
 */
import { ApiError, optionalText } from "@/lib/api";
import { parseDateInput, todayInputValue } from "@/lib/format";
import type { BillingLine } from "@/lib/invoice-billing";
import {
  buildInvoiceLines,
  checkVatRate,
  customLineTotals,
  INVOICE_NUMBER_PREFIX,
  type BillingMode,
} from "@/lib/invoices";
import { cleanPoItems, type CleanPoItem } from "@/lib/purchase-orders";
import { isDocumentType } from "@/lib/labels";
import { defaultSelectedLines, lineHasAmount } from "@/lib/lines";
import { parseDiscount, parseNumber, type Numeric } from "@/lib/money";

const MAX_INVOICE_NUMBER_LENGTH = 40;

/** Text field that falls back to `fallback` only when the client did not send it at all. */
export function textOrDefault(value: unknown, fallback: string | null) {
  return value === undefined ? fallback : optionalText(value);
}

function hasAtMost4Decimals(value: number) {
  const shifted = Number(`${Math.abs(value)}e4`);
  return Number.isFinite(shifted) && Math.abs(shifted - Math.round(shifted)) < 1e-6;
}

/** Document type, invoice date (default today) and optional due date, validated together. */
export function parseInvoiceDates(body: Record<string, unknown>) {
  const documentType = body.documentType;
  if (!isDocumentType(documentType)) {
    throw new ApiError(400, "กรุณาเลือกประเภทเอกสารให้ถูกต้อง");
  }

  const invoiceDate =
    body.invoiceDate === undefined || body.invoiceDate === null || body.invoiceDate === ""
      ? parseDateInput(todayInputValue())
      : parseDateInput(body.invoiceDate);
  if (!invoiceDate) {
    throw new ApiError(400, "วันที่ Invoice ไม่ถูกต้อง");
  }

  let dueDate: Date | null = null;
  if (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "") {
    dueDate = parseDateInput(body.dueDate);
    if (!dueDate) {
      throw new ApiError(400, "วันครบกำหนดชำระไม่ถูกต้อง");
    }
    if (dueDate < invoiceDate) {
      throw new ApiError(400, "วันครบกำหนดชำระต้องไม่ก่อนวันที่ Invoice");
    }
  }

  return { documentType, invoiceDate, dueDate };
}

/** Invoice number typed by the user, or null to keep / assign the default. Must start with IV. */
export function parseRequestedNumber(value: unknown): string | null {
  const requested = optionalText(value);
  if (requested && requested.length > MAX_INVOICE_NUMBER_LENGTH) {
    throw new ApiError(400, "เลข Invoice ยาวเกินไป");
  }
  if (requested && !requested.startsWith(INVOICE_NUMBER_PREFIX)) {
    throw new ApiError(400, `เลข Invoice ต้องขึ้นต้นด้วย ${INVOICE_NUMBER_PREFIX}`);
  }
  return requested;
}

/** "CUSTOM" (ทำรายการใหม่) or "PO" (เลือกจากรายการ PO, the default). */
export function parseBillingMode(value: unknown): BillingMode {
  return value === "CUSTOM" ? "CUSTOM" : "PO";
}

/** The PO lines to bill: what the client chose, or everything still unbilled. */
export function selectLines(lines: BillingLine[], rawItems: unknown): { line: BillingLine; quantity: number }[] {
  const byId = new Map(lines.map((line) => [line.id, line]));

  if (rawItems === undefined) {
    // Same default as the create form: everything still unbilled, with the text lines of its groups
    const selected = defaultSelectedLines(lines);
    return lines.filter((_, index) => selected[index]).map((line) => ({ line, quantity: line.remaining }));
  }

  if (!Array.isArray(rawItems)) {
    throw new ApiError(400, "รายการที่เลือกไม่ถูกต้อง");
  }

  const quantities = new Map<string, number>();
  for (const raw of rawItems) {
    const entry = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const id = typeof entry.purchaseOrderItemId === "string" ? entry.purchaseOrderItemId : "";
    const line = byId.get(id);
    if (!line) throw new ApiError(400, "มีรายการที่ไม่อยู่ใน Purchase Order นี้");
    if (quantities.has(id)) throw new ApiError(400, "เลือกรายการซ้ำ");

    const label = `รายการ "${line.description}"`;

    // text line (no price): printed only, not billed by quantity
    if (!lineHasAmount(line)) {
      quantities.set(id, 0);
      continue;
    }

    const quantity = parseNumber(entry.quantity as Numeric);
    if (quantity === null || quantity <= 0) throw new ApiError(400, `${label}: จำนวนที่เรียกเก็บต้องมากกว่า 0`);
    if (!hasAtMost4Decimals(quantity)) throw new ApiError(400, `${label}: จำนวนมีทศนิยมได้ไม่เกิน 4 ตำแหน่ง`);
    if (quantity > line.remaining + 1e-9) {
      throw new ApiError(
        400,
        `${label}: เรียกเก็บได้อีกไม่เกิน ${line.remaining} (PO ${line.quantity}, เรียกเก็บแล้ว ${line.billed})`
      );
    }
    quantities.set(id, quantity);
  }

  const selected = lines.filter((line) => quantities.has(line.id));
  if (!selected.some((line) => lineHasAmount(line))) {
    throw new ApiError(400, "กรุณาเลือกรายการที่จะเรียกเก็บอย่างน้อย 1 รายการ");
  }

  return selected.map((line) => ({ line, quantity: quantities.get(line.id) ?? 0 }));
}

/** Store fields for the bill discount and totals. */
function totalFields(discount: { value: number; type: string }, totals: { discountAmount: number; subtotal: number; vat: number; grandTotal: number }) {
  return {
    billDiscount: discount.value,
    billDiscountType: discount.type,
    billDiscountAmount: totals.discountAmount,
    subtotal: totals.subtotal,
    vat: totals.vat,
    grandTotal: totals.grandTotal,
  };
}

/**
 * Lines, totals and bill discount of the invoice for the chosen PO lines. Returns the fields to
 * store on the invoice and the rows to create as its items.
 */
export function priceSelection(selection: { line: BillingLine; quantity: number }[], rawBillDiscount: unknown) {
  // Bill discount is validated against this invoice's line total
  const preview = buildInvoiceLines(selection);
  const discount = parseDiscount(rawBillDiscount as Numeric, preview.totals.itemsTotal);
  const { lines, totals } = buildInvoiceLines(
    selection.map(({ line, quantity }) => ({ line, quantity, billedBefore: line.billed })),
    { value: discount.value, type: discount.type }
  );

  return {
    totals: totalFields(discount, totals),
    items: lines.map(({ line, quantity, amount, discount: lineDiscount, discountType }, index) => ({
      itemNo: index + 1,
      lineType: line.lineType,
      description: line.description,
      quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      discount: lineDiscount,
      discountType,
      amount,
      purchaseOrderItemId: line.id as string | null,
    })),
  };
}

/**
 * Lines typed on the invoice (ทำรายการใหม่): the same lines and checks as the lines of a PO
 * (lib/purchase-orders.ts cleanPoItems), with at least one that has an Amount.
 */
export function parseCustomLines(rawItems: unknown): CleanPoItem[] {
  // MoneyInputError ("แถวที่ N: ...") becomes a 400 in handleApiError
  const lines = cleanPoItems(rawItems);
  if (!lines.some((line) => line.amount > 0)) {
    throw new ApiError(400, "กรุณากรอก Amount อย่างน้อย 1 รายการ");
  }
  return lines;
}

/** Totals and item rows for typed lines (not linked to PO lines), at one VAT rate. */
export function priceCustomLines(lines: CleanPoItem[], rawVatRate: unknown, rawBillDiscount: unknown) {
  const { rate, error } = checkVatRate(rawVatRate);
  if (rate === null) throw new ApiError(400, error);
  const discount = parseDiscount(rawBillDiscount as Numeric, customLineTotals(lines, rate).itemsTotal);
  const totals = customLineTotals(lines, rate, { value: discount.value, type: discount.type });

  return {
    totals: totalFields(discount, totals),
    items: lines.map((line, index) => ({
      itemNo: index + 1,
      lineType: line.lineType,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      discount: line.discount,
      discountType: line.discountType,
      amount: line.amount,
      purchaseOrderItemId: null as string | null,
    })),
  };
}

/**
 * The invoice's lines and totals from the request: PO lines (`items`) or typed lines
 * (`customItems` and `vatRate`, when `billingMode` is "CUSTOM").
 */
export function priceInvoice(body: Record<string, unknown>, poLines: BillingLine[]) {
  return parseBillingMode(body.billingMode) === "CUSTOM"
    ? priceCustomLines(parseCustomLines(body.customItems), body.vatRate, body.billDiscount)
    : priceSelection(selectLines(poLines, body.items), body.billDiscount);
}
