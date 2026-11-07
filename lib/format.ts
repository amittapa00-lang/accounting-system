/**
 * Display formatting shared by server and client components.
 *
 * Dates are always formatted in Thai time (Asia/Bangkok) so the result does not
 * depend on the timezone of the server or of the browser, and server and client
 * render the same text (no hydration mismatch).
 */
import { round2, toNumber, type Numeric } from "@/lib/money";

export const APP_TIME_ZONE = "Asia/Bangkok";

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 1234.5 -> "1,234.50" */
export function formatMoney(value: Numeric): string {
  return round2(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 2.5 -> "2.5%", 0 -> "" (empty when there is no percentage to show) */
export function formatPercent(value: Numeric): string {
  const n = toNumber(value);
  if (n === 0) return "";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}%`;
}

/** Thai date with Buddhist year: "07/11/2569". Returns `fallback` when empty/invalid. */
export function formatDate(value: DateInput, fallback = "-"): string {
  const date = toDate(value);
  if (!date) return fallback;

  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });
}

/** Thai date and time: "07/11/2569 14:05". */
export function formatDateTime(value: DateInput, fallback = "-"): string {
  const date = toDate(value);
  if (!date) return fallback;

  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

/** Value for <input type="date">: "2026-11-07" in Thai time. Empty string when empty/invalid. */
export function toDateInputValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "";

  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/** Today's date in Thai time for <input type="date"> defaults. */
export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

/**
 * Parses a "YYYY-MM-DD" value from <input type="date"> (or a full ISO date-time string).
 * Returns null when empty or invalid, including impossible dates such as 2026-02-31
 * (which `new Date` would silently roll over to 3 March). Callers decide whether null is allowed.
 * A plain date becomes UTC midnight, the same as `new Date("YYYY-MM-DD")`.
 */
export function parseDateInput(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const text = value.trim();

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (ymd) {
    const [year, month, day] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
    const date = new Date(Date.UTC(year, month - 1, day));
    const sameDay =
      date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    return sameDay ? date : null;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Year and month of a date in Thai time, e.g. { year: 2026, month: "11" }. */
export function yearMonthInThailand(value: Date): { year: number; month: string } {
  const [year, month] = toDateInputValue(value).split("-");
  return { year: Number(year), month };
}
