/**
 * How much of a purchase order has been billed, and which invoice number / sub-number the
 * next (sub-)invoice gets. Server-only (database). Shared by POST /api/invoices and the
 * create page, so the page shows exactly what the API will accept.
 *
 * Rules
 *  - A PO keeps one invoice number (IV2026/001). Each billing of the PO is a sub-invoice with
 *    the same number and the next subNumber (1, 2, 3 ...). The Sale Order No. is typed by the
 *    user (no default).
 *  - A typed invoice number may also be one another PO already uses, as long as the Sale Order
 *    No. differs (claimInvoiceNumber); it then gets the next subNumber of that number.
 *  - An invoice bills the PO in one of two ways (lib/invoices.ts BILLING_MODES):
 *      PO      เลือกจากรายการ PO: PO lines by quantity; a line is never billed for more than its
 *              PO quantity over all invoices.
 *      CUSTOM  ทำรายการใหม่: lines typed on the invoice (no PO line).
 *  - Either way the invoice is deducted from the PO: all invoices of a PO together bill at most
 *    the PO's total before VAT (billingBalance). Cancelled invoices do not count.
 *  - Lines without a unit price or amount are text only (headings, notes): they are not billed by
 *    quantity and can be printed on every sub-invoice.
 */
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api";
import {
  blockingNumberHolders,
  formatInvoiceNumber,
  invoiceNumberTakenMessage,
  invoiceYearPrefix,
  poBalance,
  remainingQuantity,
  type PoBalance,
} from "@/lib/invoices";
import { lineHasAmount, toLineType, type LineType } from "@/lib/lines";
import { calcTotals, sumMoney, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Units already billed per PO line id, on invoices that are not cancelled.
 * `excludeInvoiceId`: leave out one invoice (the draft being edited, whose lines are chosen again).
 */
export async function billedQuantities(
  db: Db,
  purchaseOrderId: string,
  excludeInvoiceId?: string
): Promise<Map<string, number>> {
  const rows = await db.invoiceItem.groupBy({
    by: ["purchaseOrderItemId"],
    where: {
      purchaseOrderItem: { purchaseOrderId },
      invoice: { status: { not: "CANCELLED" }, ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}) },
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

  return { invoiceNumber, nextSubNumber: await nextSubNumberOf(db, invoiceNumber) };
}

/**
 * Next free sub-number of `invoiceNumber`, over every invoice using it: invoices of other POs may
 * share the number (with another Sale Order No.), and (invoiceNumber, subNumber) is unique.
 */
async function nextSubNumberOf(db: Db, invoiceNumber: string): Promise<number> {
  const { _max } = await db.invoice.aggregate({ where: { invoiceNumber }, _max: { subNumber: true } });
  return (_max.subNumber ?? 0) + 1;
}

/**
 * Checks that an invoice of `purchaseOrderId` with `saleOrderNumber` may use `invoiceNumber`, and
 * returns the sub-number it gets. The number may already be used by other POs only with a
 * different Sale Order No. (lib/invoices.ts blockingNumberHolders); this PO's own invoices and
 * `excludeInvoiceId` (the invoice being edited) are not compared. Call after lockInvoiceNumbering.
 */
export async function claimInvoiceNumber(
  tx: Prisma.TransactionClient,
  {
    invoiceNumber,
    saleOrderNumber,
    purchaseOrderId,
    excludeInvoiceId,
  }: { invoiceNumber: string; saleOrderNumber: string | null; purchaseOrderId: string; excludeInvoiceId?: string }
): Promise<number> {
  const holders = await tx.invoice.findMany({
    where: {
      invoiceNumber,
      purchaseOrderId: { not: purchaseOrderId },
      ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
    },
    select: { invoiceNumber: true, subNumber: true, saleOrderNumber: true },
    orderBy: { subNumber: "asc" },
  });
  const message = invoiceNumberTakenMessage(invoiceNumber, saleOrderNumber, blockingNumberHolders(holders, saleOrderNumber));
  if (message) {
    throw new ApiError(409, message);
  }
  return nextSubNumberOf(tx, invoiceNumber);
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
  /** the PO line's amount (typed by the user, or quantity x price - discount) */
  amount: number;
  /** units billed so far on invoices that are not cancelled */
  billed: number;
  /** units still to bill (0 for text lines) */
  remaining: number;
};

/**
 * PO lines with billed / remaining quantities, in PO order.
 * `excludeInvoiceId`: that invoice's quantities count as not billed (editing it).
 */
export async function billingLines(db: Db, purchaseOrderId: string, excludeInvoiceId?: string): Promise<BillingLine[]> {
  const [items, billed] = await Promise.all([
    db.purchaseOrderItem.findMany({ where: { purchaseOrderId }, orderBy: { itemNo: "asc" } }),
    billedQuantities(db, purchaseOrderId, excludeInvoiceId),
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
      amount: toNumber(item.amount),
      billed: done,
      // text lines (no price, no amount) have nothing to bill
      remaining: lineHasAmount({ unitPrice, amount: item.amount }) ? remainingQuantity(quantity, done) : 0,
    };
  });
}

/**
 * Lines for editing a draft (from billingLines with that invoice excluded): the draft may always
 * keep the quantity it already bills, even when other invoices have since used up the PO line
 * (older data was billed without a limit). It can lower it, but not raise it past what is left.
 */
export function withSavedQuantities(lines: BillingLine[], saved: Map<string, number>): BillingLine[] {
  return lines.map((line) => {
    const own = saved.get(line.id) ?? 0;
    return own > line.remaining ? { ...line, remaining: own } : line;
  });
}

/** True when at least one priced PO line still has a quantity to bill. */
export function hasUnbilled(lines: BillingLine[]) {
  return lines.some((line) => lineHasAmount(line) && line.remaining > 0);
}


/**
 * The PO total before VAT, what its invoices (not cancelled) have billed before VAT, and what is
 * left. `excludeInvoiceId`: leave that invoice out (it is being edited or brought back).
 */
export async function billingBalance(db: Db, purchaseOrderId: string, excludeInvoiceId?: string): Promise<PoBalance> {
  const [items, invoices] = await Promise.all([
    db.purchaseOrderItem.findMany({ where: { purchaseOrderId }, select: { amount: true, vat: true } }),
    db.invoice.findMany({
      where: {
        purchaseOrderId,
        status: { not: "CANCELLED" },
        ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
      },
      select: { subtotal: true },
    }),
  ]);

  return poBalance(calcTotals(items).subtotal, sumMoney(invoices.map((invoice) => invoice.subtotal)));
}
