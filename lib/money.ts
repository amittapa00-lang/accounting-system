/**
 * Money helpers shared by API routes (server) and forms (client).
 *
 * Every amount is Thai baht with exactly 2 decimal places. JavaScript floats
 * cannot represent most decimals exactly (0.1 + 0.2 !== 0.3), so all sums and
 * comparisons go through integer satang (1 baht = 100 satang).
 *
 * Calculation rules (used everywhere: PO form, PO/invoice APIs, detail pages):
 *   base     = round2(quantity * unitPrice)
 *   discount = PERCENT ? round2(base * discount / 100) : round2(discount)
 *   amount   = base - discount
 *   subtotal = sum(amount)
 *   vat      = sum over each VAT rate of round2(subtotal of that rate * rate / 100)
 *   total    = subtotal + vat
 *
 * This module must stay free of server-only imports so client components can use it.
 */

/** Anything that can hold a number: number, numeric string, Prisma.Decimal, ... */
export type Numeric = number | string | { toString(): string } | null | undefined;

export type DiscountType = "PERCENT" | "AMOUNT";

/** Thrown when user input cannot be turned into a valid amount. Message is Thai, safe to show. */
export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyInputError";
  }
}

/** Parses a number, accepting "1,234.50". Returns null when the value is empty or not a finite number. */
export function parseNumber(value: Numeric): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const text = String(value).trim().replace(/,/g, "");
  if (text === "") return null;

  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Like parseNumber but returns 0 for empty/invalid input. Use for display, not validation. */
export function toNumber(value: Numeric): number {
  return parseNumber(value) ?? 0;
}

/** Converts baht to integer satang, rounding half away from zero (10.165 -> 1017). */
export function toSatang(value: Numeric): number {
  const n = toNumber(value);
  const abs = Math.abs(n);
  if (abs < 1e-6) return 0;

  // Shifting the decimal point through a string avoids float error:
  // 1.005 * 100 === 100.49999999999999, but Number("1.005e2") === 100.5
  const satang = Math.round(Number(`${abs}e2`));
  return n < 0 ? -satang : satang;
}

export function fromSatang(satang: number): number {
  return satang / 100;
}

/** Rounds to 2 decimal places, half away from zero. */
export function round2(value: Numeric): number {
  return fromSatang(toSatang(value));
}

/** Exact sum of money values. */
export function sumMoney(values: Numeric[]): number {
  return fromSatang(values.reduce<number>((sum, v) => sum + toSatang(v), 0));
}

/** Exact a - b. */
export function subtractMoney(a: Numeric, b: Numeric): number {
  return fromSatang(toSatang(a) - toSatang(b));
}

/** Compares two amounts at satang precision: -1 if a < b, 0 if equal, 1 if a > b. */
export function compareMoney(a: Numeric, b: Numeric): -1 | 0 | 1 {
  const diff = toSatang(a) - toSatang(b);
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

/** True when the value has at most 2 decimal places (e.g. 10.5, 10.25 but not 10.255). */
export function hasAtMost2Decimals(value: Numeric): boolean {
  const n = parseNumber(value);
  if (n === null) return false;
  return Math.abs(Number(`${Math.abs(n)}e2`) - Math.round(Number(`${Math.abs(n)}e2`))) < 1e-9;
}

export type ParsedDiscount = {
  /** The number the user typed: a percentage (PERCENT) or baht (AMOUNT). */
  value: number;
  type: DiscountType;
  /** Discount in baht, rounded to 2 decimals. */
  amount: number;
};

/**
 * Parses the discount box of a PO line. "10%" = percent, "50" = baht, "" = none.
 * Throws MoneyInputError with a Thai message when invalid.
 */
export function parseDiscount(input: Numeric, baseAmount: number): ParsedDiscount {
  const raw = String(input ?? "").trim().replace(/,/g, "");

  if (!raw) return { value: 0, type: "PERCENT", amount: 0 };

  const isPercent = raw.endsWith("%");
  const value = Number(isPercent ? raw.slice(0, -1).trim() : raw);

  if (!Number.isFinite(value) || value < 0) {
    throw new MoneyInputError("Discount ไม่ถูกต้อง");
  }

  if (isPercent) {
    if (value > 100) throw new MoneyInputError("Discount % ต้องไม่เกิน 100%");
    return { value, type: "PERCENT", amount: discountAmount(baseAmount, value, "PERCENT") };
  }

  if (compareMoney(value, baseAmount) > 0) {
    throw new MoneyInputError("Discount แบบจำนวนเงินต้องไม่เกินยอดสินค้า");
  }

  return { value, type: "AMOUNT", amount: round2(value) };
}

/** Turns a stored discount back into the text shown in the discount box ("10%" or "50"). */
export function formatDiscountInput(value: Numeric, type: string | null | undefined): string {
  const n = toNumber(value);
  if (n === 0) return "";
  return type === "AMOUNT" ? String(n) : `${n}%`;
}

/** Discount in baht for a line, rounded to 2 decimals. */
export function discountAmount(baseAmount: Numeric, discount: Numeric, type: string | null | undefined): number {
  if (type === "AMOUNT") return round2(discount);
  return round2((toNumber(baseAmount) * toNumber(discount)) / 100);
}

export type LineInput = {
  quantity: Numeric;
  unitPrice: Numeric;
  discount?: Numeric;
  discountType?: string | null;
};

export type LineResult = {
  /** quantity x unitPrice, rounded */
  base: number;
  /** discount in baht, rounded */
  discountAmount: number;
  /** base - discountAmount */
  amount: number;
};

export function calcLine(line: LineInput): LineResult {
  const base = round2(toNumber(line.quantity) * toNumber(line.unitPrice));
  const discount = discountAmount(base, line.discount, line.discountType);
  return { base, discountAmount: discount, amount: subtractMoney(base, discount) };
}

export type Totals = {
  subtotal: number;
  vat: number;
  grandTotal: number;
};

/**
 * Document totals. VAT is computed per VAT rate on the subtotal of that rate and
 * rounded once per rate (not per line), which is how Thai tax invoices are calculated.
 */
export function calcTotals(lines: { amount: Numeric; vat?: Numeric }[]): Totals {
  const subtotalByRate = new Map<number, number>(); // rate in basis points -> satang

  for (const line of lines) {
    const rateBp = Math.round(toNumber(line.vat) * 100);
    subtotalByRate.set(rateBp, (subtotalByRate.get(rateBp) ?? 0) + toSatang(line.amount));
  }

  let subtotal = 0;
  let vat = 0;
  for (const [rateBp, satang] of subtotalByRate) {
    subtotal += satang;
    vat += Math.round((satang * rateBp) / 10000);
  }

  return {
    subtotal: fromSatang(subtotal),
    vat: fromSatang(vat),
    grandTotal: fromSatang(subtotal + vat),
  };
}

export type PaymentSummary = {
  paid: number;
  remaining: number;
  isFullyPaid: boolean;
};

/** Paid / remaining for an invoice. remaining never goes below 0. */
export function paymentSummary(grandTotal: Numeric, paymentAmounts: Numeric[]): PaymentSummary {
  const totalSatang = toSatang(grandTotal);
  const paidSatang = paymentAmounts.reduce<number>((sum, v) => sum + toSatang(v), 0);
  const remainingSatang = Math.max(totalSatang - paidSatang, 0);

  return {
    paid: fromSatang(paidSatang),
    remaining: fromSatang(remainingSatang),
    isFullyPaid: remainingSatang === 0,
  };
}
