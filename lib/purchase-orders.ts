/**
 * Purchase order rules shared by the PO API routes, PO pages and the PO form.
 *
 * Client-safe: imports only lib/money, so components/purchase-orders/* run the exact
 * same line validation and calculation as POST/PUT /api/purchase-orders.
 *
 * Validation errors are thrown as MoneyInputError (Thai message, safe to show);
 * lib/api handleApiError turns them into HTTP 400.
 */
import {
  discountAmount,
  fromSatang,
  MoneyInputError,
  parseDiscount,
  parseNumber,
  round2,
  subtractMoney,
  toNumber,
  toSatang,
  type DiscountType,
  type Numeric,
  type ParsedDiscount,
} from "@/lib/money";
import { toLineType, type LineType } from "@/lib/lines";

// ---------------------------------------------------------------- Limits

/** quantity / unitPrice / discount are DECIMAL(14,4): 10 integer digits, 4 decimals. */
const MAX_QUANTITY_OR_PRICE = 9_999_999_999;

/** PurchaseOrderItem.amount is DECIMAL(14,2). */
const MAX_LINE_AMOUNT = 999_999_999_999.99;

function hasAtMostDecimals(value: number, places: number): boolean {
  const shifted = Number(`${Math.abs(value)}e${places}`);
  return Number.isFinite(shifted) && Math.abs(shifted - Math.round(shifted)) < 1e-6;
}

// ---------------------------------------------------------------- Lines

/** A PO line as typed in the form (or sent to the API). */
export type PoItemInput = {
  /** ITEM | SUB (see lib/lines.ts); missing = ITEM */
  lineType?: unknown;
  description?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitPrice?: unknown;
  /** "10%" = percent, "50" = baht, "" = none */
  discount?: unknown;
  /** VAT rate in percent (7 = 7%) */
  vat?: unknown;
  /**
   * Amount to bill for the line, before its discount, typed by the user (e.g. this round's
   * payment). Unit Price is the price of the whole job and is not used for the amount.
   */
  amount?: unknown;
};

/** A validated PO line, ready for prisma.purchaseOrderItem.create. */
export type CleanPoItem = {
  itemNo: number;
  lineType: LineType;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discount: number;
  discountType: DiscountType;
  vat: number;
  amount: number;
};

function trimmedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text === "" ? null : text;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/** A number typed in the form; an empty field counts as 0, anything that is not a number as null. */
function blankAsZero(value: unknown): number | null {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) return 0;
  return parseNumber(value as Numeric);
}

/** Validates one line. Throws MoneyInputError("รายการที่ N: ...") when invalid. */
export function cleanPoItem(input: PoItemInput, index: number): CleanPoItem {
  function fail(message: string): never {
    throw new MoneyInputError(`แถวที่ ${index + 1}: ${message}`);
  }

  const lineType = toLineType(input.lineType);

  const description = trimmedText(input.description);
  if (!description) fail("กรุณากรอกรายละเอียดสินค้า");

  // A line with an Amount is billed; Unit Price is optional (it is only printed). A line with
  // neither is a text line (a heading or a note under a line): it prints only its description.
  const unitPrice = blankAsZero(input.unitPrice);
  if (unitPrice === null || unitPrice < 0) fail("ราคาสินค้าไม่ถูกต้อง");
  if (unitPrice > MAX_QUANTITY_OR_PRICE) fail("ราคาสินค้ามากเกินไป");
  if (!hasAtMostDecimals(unitPrice, 4)) fail("ราคาสินค้ามีทศนิยมได้ไม่เกิน 4 ตำแหน่ง");

  const hasAmount = !isBlank(input.amount);
  const priced = hasAmount || unitPrice > 0;

  // A billed line needs a quantity: billing it in parts goes by quantity
  const quantity = blankAsZero(input.quantity);
  if (quantity === null || quantity < 0) fail("จำนวนสินค้าไม่ถูกต้อง");
  if (priced && quantity === 0) fail("จำนวนสินค้าต้องมากกว่า 0 (ถ้าเป็นบรรทัดข้อความ ให้ลบราคาและ Amount ออก)");
  if (quantity > MAX_QUANTITY_OR_PRICE) fail("จำนวนสินค้ามากเกินไป");
  if (!hasAtMostDecimals(quantity, 4)) fail("จำนวนสินค้ามีทศนิยมได้ไม่เกิน 4 ตำแหน่ง");

  const vatInput = input.vat;
  const vat =
    vatInput === undefined || vatInput === null || vatInput === "" ? 0 : parseNumber(vatInput as Numeric);
  if (vat === null || vat < 0 || vat > 100 || !hasAtMostDecimals(vat, 2)) {
    fail("VAT ต้องอยู่ระหว่าง 0-100% (ทศนิยมไม่เกิน 2 ตำแหน่ง)");
  }

  // Amount is typed by the user; Unit Price (the price of the whole job) is not used for it
  let gross = 0;
  if (priced) {
    const typed = hasAmount ? parseNumber(input.amount as Numeric) : null;
    if (!hasAmount) fail("กรุณากรอก Amount (ยอดที่เรียกเก็บ)");
    if (typed === null || typed <= 0) fail("Amount ต้องมากกว่า 0");
    if (typed > MAX_LINE_AMOUNT) fail("Amount มากเกินไป");
    if (!hasAtMostDecimals(typed, 2)) fail("Amount มีทศนิยมได้ไม่เกิน 2 ตำแหน่ง");
    gross = typed;
  }

  // Discount comes off the Amount
  let discount: ParsedDiscount;
  try {
    discount = parseDiscount(priced ? (input.discount as Numeric) : "", gross);
  } catch (error) {
    if (error instanceof MoneyInputError) fail(error.message);
    throw error;
  }
  if (!hasAtMostDecimals(discount.value, 4)) fail("Discount มีทศนิยมได้ไม่เกิน 4 ตำแหน่ง");

  const amount = subtractMoney(gross, discount.amount);
  if (priced && amount <= 0) fail("ยอดหลังหักส่วนลดต้องมากกว่า 0");

  return {
    itemNo: index + 1,
    lineType,
    description,
    quantity,
    unit: trimmedText(input.unit),
    unitPrice,
    discount: discount.value,
    discountType: discount.type,
    vat,
    amount,
  };
}

/** Validates all lines (at least one). Throws MoneyInputError with a Thai message. */
export function cleanPoItems(items: unknown): CleanPoItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new MoneyInputError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
  }

  return items.map((item, index) =>
    cleanPoItem(item && typeof item === "object" ? (item as PoItemInput) : {}, index)
  );
}

/**
 * Amount of a line for the live preview in the form: Amount - Discount (0 while Amount is blank).
 * Never throws: an invalid discount is ignored here (cleanPoItems reports it on submit).
 */
export function previewPoLine(input: PoItemInput): number {
  if (isBlank(input.amount)) return 0;
  const gross = parseNumber(input.amount as Numeric);
  if (gross === null || gross <= 0) return 0;

  try {
    return subtractMoney(gross, parseDiscount(input.discount as Numeric, gross).amount);
  } catch {
    return round2(gross);
  }
}

/**
 * Value for the Amount box when a stored line is edited. The stored amount is after the
 * discount, the box holds the Amount before it: the value that gives back the stored amount.
 */
export function poAmountInput(stored: { unitPrice: Numeric; discount: Numeric; discountType: string; amount: Numeric }): string {
  if (toNumber(stored.amount) <= 0) return "";

  const net = toNumber(stored.amount);
  const discount = toNumber(stored.discount);
  if (discount === 0) return String(net);
  if (stored.discountType === "AMOUNT") return String(round2(net + discount));
  if (discount >= 100) return String(net);

  // Percent: Amount - round2(Amount x %) = stored; try the nearest satang values
  const estimate = toSatang(net / (1 - discount / 100));
  for (const offset of [0, -1, 1, -2, 2]) {
    const gross = fromSatang(estimate + offset);
    if (subtractMoney(gross, discountAmount(gross, discount, "PERCENT")) === net) return String(gross);
  }
  return String(round2(net / (1 - discount / 100)));
}

type StoredPoItem = {
  lineType?: string | null;
  description: string;
  quantity: Numeric;
  unit: string | null;
  unitPrice: Numeric;
  discount: Numeric;
  discountType: string;
  vat: Numeric;
  amount: Numeric;
};

/** True when the submitted lines are the same as the stored ones (ignoring whitespace and the type of a zero discount). */
export function samePoItems(stored: StoredPoItem[], submitted: CleanPoItem[]): boolean {
  if (stored.length !== submitted.length) return false;

  return stored.every((item, index) => {
    const next = submitted[index];
    const storedDiscount = toNumber(item.discount);

    return (
      toLineType(item.lineType) === next.lineType &&
      item.description.trim() === next.description &&
      (item.unit?.trim() || null) === next.unit &&
      toNumber(item.quantity) === next.quantity &&
      toNumber(item.unitPrice) === next.unitPrice &&
      toNumber(item.vat) === next.vat &&
      toNumber(item.amount) === next.amount &&
      storedDiscount === next.discount &&
      (storedDiscount === 0 || item.discountType === next.discountType)
    );
  });
}

// ---------------------------------------------------------------- Edit locks

export type PoLockReason = "INVOICED" | "CANCELLED";

export type PoLock = {
  reason: PoLockReason;
  /** Customer and PO No. can no longer be changed (lines are always locked when there is a lock). */
  identityLocked: boolean;
  message: string;
};

/**
 * What may still be edited on a PO.
 *  - It has an invoice that is not cancelled: customer, PO No. and lines are locked
 *    (the invoice was created from them); header and remarks stay editable.
 *  - It is cancelled: lines are locked until the PO is set back to another status.
 */
export function getPoLock(status: string, hasActiveInvoice: boolean): PoLock | null {
  if (hasActiveInvoice) {
    return {
      reason: "INVOICED",
      identityLocked: true,
      message:
        "PO นี้ออก Invoice แล้วอย่างน้อย 1 ใบ จึงแก้ไขลูกค้า เลขที่ PO และรายการสินค้าไม่ได้ (แก้ไขได้เฉพาะข้อมูลทั่วไปและหมายเหตุ) รายการที่ยังไม่ได้เรียกเก็บยังออกใบย่อยถัดไปได้ตามปกติ",
    };
  }

  if (status === "CANCELLED") {
    return {
      reason: "CANCELLED",
      identityLocked: false,
      message:
        "PO นี้ถูกยกเลิกแล้ว จึงแก้ไขรายการสินค้าไม่ได้ หากต้องการแก้ไขรายการ ให้เปลี่ยนสถานะเป็นอย่างอื่นแล้วบันทึกก่อน",
    };
  }

  return null;
}

/** Invoices in these statuses count as "the PO has an invoice". */
export const ACTIVE_INVOICE_WHERE = { status: { not: "CANCELLED" } } as const;
