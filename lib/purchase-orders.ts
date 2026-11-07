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
  calcLine,
  MoneyInputError,
  parseDiscount,
  parseNumber,
  toNumber,
  type DiscountType,
  type Numeric,
  type ParsedDiscount,
} from "@/lib/money";

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
  description?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitPrice?: unknown;
  /** "10%" = percent, "50" = baht, "" = none */
  discount?: unknown;
  /** VAT rate in percent (7 = 7%) */
  vat?: unknown;
};

/** A validated PO line, ready for prisma.purchaseOrderItem.create. */
export type CleanPoItem = {
  itemNo: number;
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

/** Validates one line. Throws MoneyInputError("รายการที่ N: ...") when invalid. */
export function cleanPoItem(input: PoItemInput, index: number): CleanPoItem {
  function fail(message: string): never {
    throw new MoneyInputError(`รายการที่ ${index + 1}: ${message}`);
  }

  const description = trimmedText(input.description);
  if (!description) fail("กรุณากรอกรายละเอียดสินค้า");

  const quantity = parseNumber(input.quantity as Numeric);
  if (quantity === null || quantity <= 0) fail("จำนวนสินค้าต้องมากกว่า 0");
  if (quantity > MAX_QUANTITY_OR_PRICE) fail("จำนวนสินค้ามากเกินไป");
  if (!hasAtMostDecimals(quantity, 4)) fail("จำนวนสินค้ามีทศนิยมได้ไม่เกิน 4 ตำแหน่ง");

  const unitPrice = parseNumber(input.unitPrice as Numeric);
  if (unitPrice === null || unitPrice < 0) fail("ราคาสินค้าไม่ถูกต้อง");
  if (unitPrice > MAX_QUANTITY_OR_PRICE) fail("ราคาสินค้ามากเกินไป");
  if (!hasAtMostDecimals(unitPrice, 4)) fail("ราคาสินค้ามีทศนิยมได้ไม่เกิน 4 ตำแหน่ง");

  const vatInput = input.vat;
  const vat =
    vatInput === undefined || vatInput === null || vatInput === "" ? 0 : parseNumber(vatInput as Numeric);
  if (vat === null || vat < 0 || vat > 100 || !hasAtMostDecimals(vat, 2)) {
    fail("VAT ต้องอยู่ระหว่าง 0-100% (ทศนิยมไม่เกิน 2 ตำแหน่ง)");
  }

  const { base } = calcLine({ quantity, unitPrice });
  if (base > MAX_LINE_AMOUNT) fail("ยอดเงินของรายการมากเกินไป");

  let discount: ParsedDiscount;
  try {
    discount = parseDiscount(input.discount as Numeric, base);
  } catch (error) {
    if (error instanceof MoneyInputError) fail(error.message);
    throw error;
  }
  if (!hasAtMostDecimals(discount.value, 4)) fail("Discount มีทศนิยมได้ไม่เกิน 4 ตำแหน่ง");

  const { amount } = calcLine({
    quantity,
    unitPrice,
    discount: discount.value,
    discountType: discount.type,
  });

  return {
    itemNo: index + 1,
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
 * Amount of a line for the live preview in the form, same formula as cleanPoItem.
 * Never throws: an invalid discount is ignored here (cleanPoItems reports it on submit).
 */
export function previewPoLine(input: PoItemInput): number {
  const quantity = toNumber(input.quantity as Numeric);
  const unitPrice = toNumber(input.unitPrice as Numeric);
  const { base } = calcLine({ quantity, unitPrice });

  try {
    const discount = parseDiscount(input.discount as Numeric, base);
    return calcLine({ quantity, unitPrice, discount: discount.value, discountType: discount.type }).amount;
  } catch {
    return base;
  }
}

type StoredPoItem = {
  description: string;
  quantity: Numeric;
  unit: string | null;
  unitPrice: Numeric;
  discount: Numeric;
  discountType: string;
  vat: Numeric;
};

/** True when the submitted lines are the same as the stored ones (ignoring whitespace and the type of a zero discount). */
export function samePoItems(stored: StoredPoItem[], submitted: CleanPoItem[]): boolean {
  if (stored.length !== submitted.length) return false;

  return stored.every((item, index) => {
    const next = submitted[index];
    const storedDiscount = toNumber(item.discount);

    return (
      item.description.trim() === next.description &&
      (item.unit?.trim() || null) === next.unit &&
      toNumber(item.quantity) === next.quantity &&
      toNumber(item.unitPrice) === next.unitPrice &&
      toNumber(item.vat) === next.vat &&
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
        "PO นี้มี Invoice แล้ว จึงแก้ไขลูกค้า เลขที่ PO และรายการสินค้าไม่ได้ (แก้ไขได้เฉพาะข้อมูลทั่วไปและหมายเหตุ)",
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
