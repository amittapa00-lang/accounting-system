/**
 * How much of a purchase order has been billed, and which invoice number / sub-number the
 * next (sub-)invoice gets. Server-only (database). Shared by POST /api/invoices and the
 * create page, so the page shows exactly what the API will accept.
 *
 * Rules
 *  - A PO keeps one invoice number (IV2026/001). Each billing of the PO is a sub-invoice with
 *    the same number and the next subNumber (1, 2, 3 ...); its default Sale Order No. is
 *    "TC 2026/001-00{sub}".
 *  - Quantities are billed per PO line; cancelled invoices do not count. A line can never be
 *    billed for more than its PO quantity.
 *  - Lines without a unit price are text only (headings, notes): they are not billed by quantity
 *    and can be printed on every sub-invoice.
 */
import type { Prisma } from "@/generated/prisma/client";
import { defaultSaleOrderNumber, formatInvoiceNumber, invoiceYearPrefix, remainingQuantity } from "@/lib/invoices";
import { lineHasAmount, toLineType, type LineType } from "@/lib/lines";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** Units already billed per PO line id, on invoices that are not cancelled. */
export async function billedQuantities(db: Db, purchaseOrderId: string): Promise<Map<string, number>> {
  const rows = await db.invoiceItem.groupBy({
    by: ["purchaseOrderItemId"],
    where: {
      purchaseOrderItem: { purchaseOrderId },
      invoice: { status: { not: "CANCELLED" } },
    },
    _sum: { quantity: true },
  });

  const billed = new Map<string, number>();
  for (const row of rows) {
    if (row.purchaseOrderItemId) billed.set(row.purchaseOrderItemId, toNumber(row._sum.quantity));
  }
  return billed;
}

/**
 * The invoice number a PO already uses and the next sub-number, or null when the PO has no
 * invoice yet. Older data may have several numbers for one PO (an invoice cancelled and
 * re-created): the latest active one wins, otherwise the latest one.
 */
export async function invoiceGroupOf(
  db: Db,
  purchaseOrderId: string
): Promise<{ invoiceNumber: string; nextSubNumber: number } | null> {
  const invoices = await db.invoice.findMany({
    where: { purchaseOrderId },
    select: { invoiceNumber: true, subNumber: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (invoices.length === 0) return null;

  const invoiceNumber = (invoices.find((i) => i.status !== "CANCELLED") ?? invoices[0]).invoiceNumber;
  const lastSub = invoices.filter((i) => i.invoiceNumber === invoiceNumber).reduce((max, i) => Math.max(max, i.subNumber), 0);

  return { invoiceNumber, nextSubNumber: lastSub + 1 };
}

/** Highest running number used for the year of `invoiceDate` + 1, as "IV2026/007". */
async function nextRunningNumber(db: Db, invoiceDate: Date): Promise<string> {
  const prefix = invoiceYearPrefix(invoiceDate);
  const rows = await db.invoice.findMany({
    where: { invoiceNumber: { startsWith: prefix } },
    select: { invoiceNumber: true },
    distinct: ["invoiceNumber"],
  });

  const last = rows.reduce((max, { invoiceNumber }) => {
    const rest = invoiceNumber.slice(prefix.length);
    return /^\d+$/.test(rest) ? Math.max(max, Number(rest)) : max;
  }, 0);

  return formatInvoiceNumber(prefix, last + 1);
}

/** Suggestion for the create form (no lock: the API checks again when saving). */
export function suggestInvoiceNumber(db: Db, invoiceDate: Date) {
  return nextRunningNumber(db, invoiceDate);
}

/**
 * Serialises invoice numbering. Call first inside the transaction that creates the invoice:
 * the lock is held until the transaction ends.
 */
export async function lockInvoiceNumbering(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('invoice-number'))`;
}

export async function nextInvoiceNumber(tx: Prisma.TransactionClient, invoiceDate: Date) {
  return nextRunningNumber(tx, invoiceDate);
}

export type BillingLine = {
  id: string;
  itemNo: number;
  lineType: LineType;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discount: number;
  discountType: string;
  vat: number;
  billed: number;
  remaining: number;
};

/** PO lines with billed / remaining quantities, in PO order. */
export async function billingLines(db: Db, purchaseOrderId: string): Promise<BillingLine[]> {
  const [items, billed] = await Promise.all([
    db.purchaseOrderItem.findMany({ where: { purchaseOrderId }, orderBy: { itemNo: "asc" } }),
    billedQuantities(db, purchaseOrderId),
  ]);

  return items.map((item) => {
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const done = billed.get(item.id) ?? 0;
    return {
      id: item.id,
      itemNo: item.itemNo,
      lineType: toLineType(item.lineType),
      description: item.description,
      quantity,
      unit: item.unit,
      unitPrice,
      discount: toNumber(item.discount),
      discountType: item.discountType,
      vat: toNumber(item.vat),
      billed: done,
      // text lines (no price) have nothing to bill
      remaining: lineHasAmount({ unitPrice }) ? remainingQuantity(quantity, done) : 0,
    };
  });
}

/** True when at least one priced line still has something to bill. */
export function hasUnbilled(lines: BillingLine[]) {
  return lines.some((line) => lineHasAmount(line) && line.remaining > 0);
}

export { defaultSaleOrderNumber };
