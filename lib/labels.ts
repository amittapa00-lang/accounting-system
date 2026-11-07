/**
 * Status / type codes stored in the database, with their Thai labels and colour tone.
 * One place for every page so labels and colours stay consistent.
 * Render statuses with <InvoiceStatusBadge> / <PoStatusBadge> from components/ui/badge.
 */

/** Colour meaning shared by badges, icons and alerts. */
export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "brand";

type Option<T extends string> = { value: T; label: string; tone: Tone };

function lookup<T extends string>(options: readonly Option<T>[], value: string) {
  return options.find((o) => o.value === value);
}

function isOneOf<T extends string>(options: readonly { value: T }[], value: unknown): value is T {
  return typeof value === "string" && options.some((o) => o.value === value);
}

/** Tailwind classes for a small coloured pill (kept for places that cannot use <Badge>). */
const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-800",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-700",
  brand: "bg-brand-50 text-brand-700",
};

// ---------------------------------------------------------------- Invoice status

export const INVOICE_STATUSES = [
  { value: "DRAFT", label: "ฉบับร่าง", tone: "neutral" },
  { value: "ISSUED", label: "รอชำระเงิน", tone: "info" },
  { value: "PARTIAL", label: "ชำระบางส่วน", tone: "warning" },
  { value: "PAID", label: "ชำระครบแล้ว", tone: "success" },
  { value: "CANCELLED", label: "ยกเลิก", tone: "danger" },
] as const satisfies readonly Option<string>[];

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["value"];

/** Invoices that are real receivables (issued, not cancelled, not fully paid). */
export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ["ISSUED", "PARTIAL"];

export function invoiceStatusLabel(status: string) {
  return lookup(INVOICE_STATUSES, status)?.label ?? status;
}

export function invoiceStatusTone(status: string): Tone {
  return lookup(INVOICE_STATUSES, status)?.tone ?? "neutral";
}

export function invoiceStatusClass(status: string) {
  return TONE_CLASSES[invoiceStatusTone(status)];
}

// ---------------------------------------------------------------- Purchase order status

export const PO_STATUSES = [
  { value: "DRAFT", label: "ฉบับร่าง", tone: "neutral" },
  { value: "CONFIRMED", label: "ยืนยันแล้ว", tone: "info" },
  { value: "COMPLETED", label: "เสร็จสิ้น", tone: "success" },
  { value: "CANCELLED", label: "ยกเลิก", tone: "danger" },
] as const satisfies readonly Option<string>[];

export type PoStatus = (typeof PO_STATUSES)[number]["value"];

export function isPoStatus(value: unknown): value is PoStatus {
  return isOneOf(PO_STATUSES, value);
}

export function poStatusLabel(status: string) {
  return lookup(PO_STATUSES, status)?.label ?? status;
}

export function poStatusTone(status: string): Tone {
  return lookup(PO_STATUSES, status)?.tone ?? "neutral";
}

export function poStatusClass(status: string) {
  return TONE_CLASSES[poStatusTone(status)];
}

// ---------------------------------------------------------------- Invoice document type

export const DOCUMENT_TYPES = [
  { value: "TAX_INVOICE_DELIVERY", label: "ใบกำกับภาษี / ใบส่งของ / ใบแจ้งหนี้", tone: "neutral" },
  { value: "BILLING_INVOICE", label: "ใบวางบิล / ใบแจ้งหนี้", tone: "neutral" },
  { value: "RECEIPT", label: "ใบเสร็จรับเงิน", tone: "neutral" },
] as const satisfies readonly Option<string>[];

export type DocumentType = (typeof DOCUMENT_TYPES)[number]["value"];

export function isDocumentType(value: unknown): value is DocumentType {
  return isOneOf(DOCUMENT_TYPES, value);
}

export function documentTypeLabel(type: string) {
  return lookup(DOCUMENT_TYPES, type)?.label ?? type;
}

// ---------------------------------------------------------------- Payment method

export const PAYMENT_METHODS = [
  { value: "TRANSFER", label: "โอนเงิน", tone: "neutral" },
  { value: "CASH", label: "เงินสด", tone: "neutral" },
  { value: "CHEQUE", label: "เช็ค", tone: "neutral" },
  { value: "CREDIT_CARD", label: "บัตรเครดิต", tone: "neutral" },
  { value: "OTHER", label: "อื่น ๆ", tone: "neutral" },
] as const satisfies readonly Option<string>[];

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return isOneOf(PAYMENT_METHODS, value);
}

export function paymentMethodLabel(method: string) {
  return lookup(PAYMENT_METHODS, method)?.label ?? method;
}

// ---------------------------------------------------------------- User role

export function roleLabel(role: string | undefined) {
  if (role === "ADMIN") return "ผู้ดูแลระบบ";
  return "ผู้ใช้งาน";
}
