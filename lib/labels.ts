/**
 * Status / type codes stored in the database, with their Thai labels and badge colours.
 * One place for every page so labels and colours stay consistent.
 */

type Option<T extends string> = { value: T; label: string; className: string };

function lookup<T extends string>(options: readonly Option<T>[], value: string) {
  return options.find((o) => o.value === value);
}

function isOneOf<T extends string>(options: readonly { value: T }[], value: unknown): value is T {
  return typeof value === "string" && options.some((o) => o.value === value);
}

const NEUTRAL = "bg-slate-100 text-slate-700";

// ---------------------------------------------------------------- Invoice status

export const INVOICE_STATUSES = [
  { value: "DRAFT", label: "ฉบับร่าง", className: "bg-slate-100 text-slate-700" },
  { value: "ISSUED", label: "ออก Invoice แล้ว", className: "bg-amber-100 text-amber-700" },
  { value: "PARTIAL", label: "ชำระบางส่วน", className: "bg-blue-100 text-blue-700" },
  { value: "PAID", label: "ชำระครบแล้ว", className: "bg-emerald-100 text-emerald-700" },
  { value: "CANCELLED", label: "ยกเลิก", className: "bg-red-100 text-red-700" },
] as const satisfies readonly Option<string>[];

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["value"];

/** Invoices that are real receivables (issued, not cancelled, not fully paid). */
export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ["ISSUED", "PARTIAL"];

export function invoiceStatusLabel(status: string) {
  return lookup(INVOICE_STATUSES, status)?.label ?? status;
}

export function invoiceStatusClass(status: string) {
  return lookup(INVOICE_STATUSES, status)?.className ?? NEUTRAL;
}

// ---------------------------------------------------------------- Purchase order status

export const PO_STATUSES = [
  { value: "DRAFT", label: "ฉบับร่าง", className: "bg-yellow-100 text-yellow-700" },
  { value: "CONFIRMED", label: "ยืนยันแล้ว", className: "bg-blue-100 text-blue-700" },
  { value: "COMPLETED", label: "เสร็จสิ้น", className: "bg-green-100 text-green-700" },
  { value: "CANCELLED", label: "ยกเลิก", className: "bg-red-100 text-red-700" },
] as const satisfies readonly Option<string>[];

export type PoStatus = (typeof PO_STATUSES)[number]["value"];

export function isPoStatus(value: unknown): value is PoStatus {
  return isOneOf(PO_STATUSES, value);
}

export function poStatusLabel(status: string) {
  return lookup(PO_STATUSES, status)?.label ?? status;
}

export function poStatusClass(status: string) {
  return lookup(PO_STATUSES, status)?.className ?? NEUTRAL;
}

// ---------------------------------------------------------------- Invoice document type

export const DOCUMENT_TYPES = [
  { value: "TAX_INVOICE_DELIVERY", label: "ใบกำกับภาษี / ใบส่งของ / ใบแจ้งหนี้", className: NEUTRAL },
  { value: "BILLING_INVOICE", label: "ใบวางบิล / ใบแจ้งหนี้", className: NEUTRAL },
  { value: "RECEIPT", label: "ใบเสร็จรับเงิน", className: NEUTRAL },
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
  { value: "TRANSFER", label: "โอนเงิน", className: NEUTRAL },
  { value: "CASH", label: "เงินสด", className: NEUTRAL },
  { value: "CHEQUE", label: "เช็ค", className: NEUTRAL },
  { value: "CREDIT_CARD", label: "บัตรเครดิต", className: NEUTRAL },
  { value: "OTHER", label: "อื่น ๆ", className: NEUTRAL },
] as const satisfies readonly Option<string>[];

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return isOneOf(PAYMENT_METHODS, value);
}

export function paymentMethodLabel(method: string) {
  return lookup(PAYMENT_METHODS, method)?.label ?? method;
}
