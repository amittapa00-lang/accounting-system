/**
 * Payment rules shared by the payment API, the new-payment page and the dashboard.
 *
 * Money math itself lives in lib/money.ts (satang integers). This module only adds the
 * invoice-status rules around it. It must stay free of server-only imports.
 */
import { compareMoney, hasAtMost2Decimals, parseNumber, round2, type PaymentSummary } from "@/lib/money";
import { formatMoney, todayInputValue } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";

/**
 * Why an invoice with this status cannot receive a payment (Thai, safe to show),
 * or null when it can (ISSUED / PARTIAL).
 */
export function paymentBlockedReason(status: string): string | null {
  switch (status) {
    case "ISSUED":
    case "PARTIAL":
      return null;
    case "DRAFT":
      return "Invoice นี้ยังเป็นฉบับร่าง กรุณาออก Invoice ก่อนรับชำระเงิน";
    case "CANCELLED":
      return "Invoice นี้ถูกยกเลิกแล้ว ไม่สามารถรับชำระเงินได้";
    case "PAID":
      return "Invoice นี้ชำระเงินครบแล้ว";
    default:
      return `Invoice สถานะ "${invoiceStatusLabel(status)}" ไม่สามารถรับชำระเงินได้`;
  }
}

/** Invoice status once payments are recorded: PAID exactly when nothing remains. */
export function statusAfterPayment(summary: PaymentSummary): "PAID" | "PARTIAL" {
  return summary.isFullyPaid ? "PAID" : "PARTIAL";
}

/** Largest amount a DECIMAL(14,2) column can hold is 999,999,999,999.99. */
const MAX_AMOUNT_EXCLUSIVE = 1_000_000_000_000;

/**
 * Parses a payment amount typed by the user ("1,234.50" or a number).
 * Rejects blanks, more than 2 decimals, zero/negative and out-of-range values.
 * Whether it exceeds the invoice's remaining amount is checked separately (compareMoney).
 */
export function parsePaymentAmount(value: unknown): { amount: number } | { error: string } {
  const amount = typeof value === "number" || typeof value === "string" ? parseNumber(value) : null;

  if (amount === null) return { error: "กรุณาระบุจำนวนเงิน" };
  if (Math.abs(amount) >= MAX_AMOUNT_EXCLUSIVE) return { error: "จำนวนเงินมากเกินไป" };
  if (!hasAtMost2Decimals(amount)) return { error: "จำนวนเงินต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง" };
  if (compareMoney(amount, 0) <= 0) return { error: "จำนวนเงินต้องมากกว่า 0" };

  return { amount: round2(amount) };
}

/** Message shown when a payment is larger than what is still owed on the invoice. */
export function exceedsRemainingMessage(remaining: number): string {
  return `จำนวนเงินที่รับชำระมากกว่ายอดคงเหลือ (คงเหลือ ${formatMoney(remaining)} บาท)`;
}

/**
 * Parses the payment date from <input type="date"> ("YYYY-MM-DD").
 * Blank means today (Thai time). Rejects impossible dates such as 2026-02-31
 * (which `new Date` silently rolls over to March) and dates after today.
 * Returns the date at UTC midnight, the same way other date inputs are stored.
 */
export function parsePaymentDate(value: unknown): { date: Date } | { error: string } {
  const text = typeof value === "string" ? value.trim() : "";
  const today = todayInputValue();
  const input = text === "" ? today : text;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return { error: "วันที่รับชำระเงินไม่ถูกต้อง" };
  }

  const date = new Date(`${input}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
    return { error: "วันที่รับชำระเงินไม่ถูกต้อง" };
  }

  // Both values are YYYY-MM-DD, so string comparison is date comparison.
  if (input > today) {
    return { error: "วันที่รับชำระเงินต้องไม่เกินวันนี้" };
  }

  return { date };
}
