/**
 * Invoice history (InvoiceLog): who did what to an invoice, and when.
 *
 * Every route that changes an invoice writes one entry inside its own transaction, so the
 * history cannot miss a change or record one that was rolled back.
 */
import type { Session } from "next-auth";

import type { Prisma } from "@/generated/prisma/client";
import { formatDate, formatMoney } from "@/lib/format";
import { formatQuantity } from "@/lib/invoices";
import { lineHasAmount } from "@/lib/lines";
import { documentTypeLabel, type Tone } from "@/lib/labels";
import { formatDiscountInput, toNumber, type Numeric } from "@/lib/money";

export const INVOICE_LOG_ACTIONS = {
  CREATED: { label: "สร้าง Invoice", tone: "neutral" },
  EDITED: { label: "แก้ไข Invoice", tone: "info" },
  BILLED: { label: "วางบิล", tone: "info" },
  UNBILLED: { label: "ยกเลิกวางบิล", tone: "warning" },
  PAYMENT: { label: "รับชำระเงิน", tone: "success" },
  PAID: { label: "รับเงินแล้ว", tone: "success" },
  UNPAID: { label: "ยกเลิกรับเงิน", tone: "warning" },
  CANCELLED: { label: "ยกเลิก Invoice", tone: "danger" },
  STATUS: { label: "เปลี่ยนสถานะ", tone: "info" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

export type InvoiceLogAction = keyof typeof INVOICE_LOG_ACTIONS;

export function invoiceLogLabel(action: string): string {
  return INVOICE_LOG_ACTIONS[action as InvoiceLogAction]?.label ?? action;
}

export function invoiceLogTone(action: string): Tone {
  return INVOICE_LOG_ACTIONS[action as InvoiceLogAction]?.tone ?? "neutral";
}

/** Name shown in the history for the signed-in user. */
export function sessionUserName(session: Session): string | null {
  return session.user?.name ?? session.user?.username ?? null;
}

export async function logInvoice(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  action: InvoiceLogAction,
  session: Session,
  detail?: string | string[] | null
) {
  const text = Array.isArray(detail) ? detail.join("\n") : detail;
  await tx.invoiceLog.create({
    data: { invoiceId, action, detail: text || null, userName: sessionUserName(session) },
  });
}

// ---------------------------------------------------------------- what changed in an edit

/** The invoice fields an edit can change, as stored. */
export type InvoiceSnapshot = {
  invoiceNumber: string;
  documentType: string;
  invoiceDate: Date;
  dueDate: Date | null;
  paymentTerm: string | null;
  saleOrderNumber: string | null;
  saleName: string | null;
  entryBy: string | null;
  shipToSnapshot: string | null;
  note: string | null;
  billDiscount: Numeric;
  billDiscountType: string;
  grandTotal: Numeric;
  items: { purchaseOrderItemId: string | null; description: string; quantity: Numeric; unitPrice: Numeric; amount: Numeric }[];
};

const MAX_VALUE_LENGTH = 80;

function show(value: string | null | undefined): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "-";
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

/** One line per changed field, e.g. "วันที่ Invoice: 07/11/2569 → 09/11/2569". */
export function describeInvoiceChanges(before: InvoiceSnapshot, after: InvoiceSnapshot): string[] {
  const lines: string[] = [];
  const compare = (label: string, a: string, b: string) => {
    if (a !== b) lines.push(`${label}: ${a} → ${b}`);
  };

  compare("เลข Invoice", show(before.invoiceNumber), show(after.invoiceNumber));
  compare("ประเภทเอกสาร", documentTypeLabel(before.documentType), documentTypeLabel(after.documentType));
  compare("วันที่ Invoice", formatDate(before.invoiceDate), formatDate(after.invoiceDate));
  compare("วันครบกำหนด", formatDate(before.dueDate), formatDate(after.dueDate));
  compare("Payment Term", show(before.paymentTerm), show(after.paymentTerm));
  compare("Sale Order No.", show(before.saleOrderNumber), show(after.saleOrderNumber));
  compare("Sale Name", show(before.saleName), show(after.saleName));
  compare("Entry By", show(before.entryBy), show(after.entryBy));
  compare("Ship To", show(before.shipToSnapshot), show(after.shipToSnapshot));
  compare("หมายเหตุ", show(before.note), show(after.note));
  compare(
    "ส่วนลดท้ายบิล",
    show(formatDiscountInput(before.billDiscount, before.billDiscountType)),
    show(formatDiscountInput(after.billDiscount, after.billDiscountType))
  );

  // Lines, matched by the PO line they bill
  const key = (item: InvoiceSnapshot["items"][number]) => item.purchaseOrderItemId ?? `text:${item.description}`;
  const oldItems = new Map(before.items.map((item) => [key(item), item]));
  const newItems = new Map(after.items.map((item) => [key(item), item]));
  const priced = (item: InvoiceSnapshot["items"][number]) => lineHasAmount(item);

  for (const [id, item] of newItems) {
    const old = oldItems.get(id);
    const qty = priced(item) ? ` (จำนวน ${formatQuantity(item.quantity)})` : "";
    if (!old) {
      lines.push(`เพิ่มรายการ "${show(item.description)}"${qty}`);
    } else if (priced(item) && toNumber(old.quantity) !== toNumber(item.quantity)) {
      lines.push(`รายการ "${show(item.description)}" จำนวน: ${formatQuantity(old.quantity)} → ${formatQuantity(item.quantity)}`);
    }
  }
  for (const [id, item] of oldItems) {
    if (!newItems.has(id)) lines.push(`ลบรายการ "${show(item.description)}"`);
  }

  compare("ยอดรวมทั้งสิ้น", formatMoney(before.grandTotal), formatMoney(after.grandTotal));

  return lines;
}
