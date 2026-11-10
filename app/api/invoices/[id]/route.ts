/**
 * PUT /api/invoices/[id] — edits an invoice in any status except CANCELLED (DELETE below deletes one).
 *
 * Body: the same fields as POST /api/invoices (without purchaseOrderId).
 *   documentType, invoiceDate   required
 *   dueDate, billDiscount       always applied (empty = none)
 *   billingMode      "PO" (default) | "CUSTOM", as in POST
 *   items            PO: required, [{ purchaseOrderItemId, quantity }] chosen again from the PO; this
 *                    invoice's own quantities count as not billed, so they can be kept or changed
 *   customItems      CUSTOM: required, the typed lines (and vatRate)
 *   With the other invoices of the PO it must fit in the PO total before VAT (an older invoice
 *   already over it can still be edited as long as its amount does not go up).
 *   invoiceNumber    can change only while no other sub-invoice of the PO shares the number; the new
 *                    number may be one another PO uses when the Sale Order No. differs
 *   text fields      (shipToSnapshot, paymentTerm, saleOrderNumber, saleName, entryBy, note)
 *                    not sent = kept as they are
 *
 * Money already received stays: the new grand total cannot be less than it, and the status
 * follows the new total (PARTIAL / PAID). Every edit is written to the invoice history.
 */
import { NextResponse } from "next/server";

import { ApiError, handleApiError, readJson } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import {
  billingBalance,
  billingLines,
  claimInvoiceNumber,
  lockInvoiceNumbering,
  withSavedQuantities,
} from "@/lib/invoice-billing";
import { describeInvoiceChanges, logInvoice, type InvoiceSnapshot } from "@/lib/invoice-log";
import { documentTypeForStatus, poBalanceError, saleOrderKey } from "@/lib/invoices";
import { compareMoney, paymentSummary, toNumber } from "@/lib/money";
import { statusAfterPayment } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

import { parseBillingMode, parseInvoiceDates, parseRequestedNumber, priceInvoice, textOrDefault } from "../input";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireApiSession();

    const { id } = await context.params;

    const body = await readJson(request);
    // POST defaults a missing date to today; an edit must not silently move the date
    if (body.invoiceDate === undefined || body.invoiceDate === null || body.invoiceDate === "") {
      throw new ApiError(400, "กรุณาระบุวันที่ Invoice");
    }
    const { documentType, invoiceDate, dueDate } = parseInvoiceDates(body);
    const requestedNumber = parseRequestedNumber(body.invoiceNumber);
    if (parseBillingMode(body.billingMode) === "PO" && !Array.isArray(body.items)) {
      throw new ApiError(400, "กรุณาเลือกรายการที่จะเรียกเก็บ");
    }

    const invoice = await prisma.$transaction(
      async (tx) => {
        const found = await tx.invoice.findUnique({
          where: { id },
          select: { purchaseOrderId: true },
        });
        if (!found) {
          throw new ApiError(404, "ไม่พบ Invoice ที่ต้องการแก้ไข");
        }

        // Same lock order as POST /api/invoices (PO first): invoices of this PO are billed one
        // at a time, so the quantities read below cannot be billed twice.
        await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${found.purchaseOrderId} FOR UPDATE`;
        // Then the invoice row: status changes and payments wait until this edit is saved.
        await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;

        const existing = await tx.invoice.findUniqueOrThrow({
          where: { id },
          include: {
            items: { orderBy: { itemNo: "asc" } },
            payments: { select: { amount: true } },
            purchaseOrder: { select: { status: true } },
          },
        });

        if (existing.status === "CANCELLED") {
          throw new ApiError(409, "Invoice นี้ถูกยกเลิกแล้ว แก้ไขไม่ได้");
        }
        if (existing.purchaseOrder.status === "CANCELLED") {
          throw new ApiError(409, "Purchase Order นี้ถูกยกเลิกแล้ว ไม่สามารถแก้ไข Invoice ได้");
        }

        const saved = new Map<string, number>();
        for (const item of existing.items) {
          if (item.purchaseOrderItemId) saved.set(item.purchaseOrderItemId, toNumber(item.quantity));
        }
        const lines = withSavedQuantities(await billingLines(tx, existing.purchaseOrderId, id), saved);
        const { totals, items } = priceInvoice(body, lines);

        // Together with the other invoices of the PO, at most the PO total before VAT. Older data may
        // already be over it: such an invoice can still be edited while its amount does not go up.
        const balanceError = poBalanceError(totals.subtotal, await billingBalance(tx, existing.purchaseOrderId, id));
        if (balanceError && compareMoney(totals.subtotal, existing.subtotal) > 0) {
          throw new ApiError(400, balanceError);
        }

        // Money already received must still fit in the new total
        const paidAmounts = existing.payments.map((payment) => payment.amount);
        const after = paymentSummary(totals.grandTotal, paidAmounts);
        if (compareMoney(after.paid, totals.grandTotal) > 0) {
          throw new ApiError(
            409,
            `ยอดรวมใหม่ ${formatMoney(totals.grandTotal)} บาท น้อยกว่ายอดที่รับชำระแล้ว ${formatMoney(after.paid)} บาท`
          );
        }
        // DRAFT stays a draft; a billed invoice follows what has been received of the new total
        const status =
          existing.status === "DRAFT" ? "DRAFT" : after.paid > 0 ? statusAfterPayment(after) : "ISSUED";

        // Invoice number: changes only while no other sub-invoice of this PO shares it. The new
        // number may be one another PO uses, with a different Sale Order No. (next sub-number).
        const saleOrderNumber = textOrDefault(body.saleOrderNumber, existing.saleOrderNumber);
        let invoiceNumber = existing.invoiceNumber;
        let subNumber = existing.subNumber;
        if (requestedNumber && requestedNumber !== existing.invoiceNumber) {
          await lockInvoiceNumbering(tx);
          const shared = await tx.invoice.count({
            where: { invoiceNumber: existing.invoiceNumber, purchaseOrderId: existing.purchaseOrderId, id: { not: id } },
          });
          if (shared > 0) {
            throw new ApiError(409, "เปลี่ยนเลข Invoice ไม่ได้ เพราะมีใบย่อยอื่นใช้เลขเดียวกันอยู่");
          }
          subNumber = await claimInvoiceNumber(tx, {
            invoiceNumber: requestedNumber,
            saleOrderNumber,
            purchaseOrderId: existing.purchaseOrderId,
            excludeInvoiceId: id,
          });
          invoiceNumber = requestedNumber;
        } else if (saleOrderKey(saleOrderNumber) !== saleOrderKey(existing.saleOrderNumber)) {
          // Same number, new Sale Order No.: it must still differ from other POs using the number
          await lockInvoiceNumbering(tx);
          await claimInvoiceNumber(tx, {
            invoiceNumber,
            saleOrderNumber,
            purchaseOrderId: existing.purchaseOrderId,
            excludeInvoiceId: id,
          });
        }

        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

        const updated = await tx.invoice.update({
          where: { id },
          data: {
            invoiceNumber,
            subNumber,
            // the type chosen in the form, unless the new total changes the status (then it follows the status)
            documentType: status !== existing.status ? documentTypeForStatus(status) : documentType,
            invoiceDate,
            dueDate,

            shipToSnapshot: textOrDefault(body.shipToSnapshot, existing.shipToSnapshot),
            paymentTerm: textOrDefault(body.paymentTerm, existing.paymentTerm),
            saleOrderNumber,
            saleName: textOrDefault(body.saleName, existing.saleName),
            entryBy: textOrDefault(body.entryBy, existing.entryBy),
            note: textOrDefault(body.note, existing.note),

            ...totals,
            status,

            items: { create: items },
          },
          include: { items: true },
        });

        const changes = describeInvoiceChanges(existing as InvoiceSnapshot, updated as InvoiceSnapshot);
        if (status !== existing.status) {
          changes.push(`สถานะเปลี่ยนตามยอดใหม่ (รับชำระแล้ว ${formatMoney(after.paid)} บาท)`);
        }
        await logInvoice(tx, id, "EDITED", session, changes.length > 0 ? changes : "บันทึกโดยไม่มีการเปลี่ยนแปลง");

        return updated;
      },
      // Waiting for the PO / invoice / numbering locks counts against the timeout
      { timeout: 15_000 }
    );

    return NextResponse.json({ message: "แก้ไข Invoice สำเร็จ", invoice });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถแก้ไข Invoice ได้", {
      conflict: "เลข Invoice ซ้ำ กรุณาใช้เลขอื่น",
      notFound: "ไม่พบ Invoice ที่ต้องการแก้ไข",
    });
  }
}

/**
 * DELETE /api/invoices/[id] — deletes an invoice for good, in any status: its lines, its
 * payments and its history go with it. The PO quantities it billed can be billed again.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireApiSession();

    const { id } = await context.params;

    await prisma.$transaction(async (tx) => {
      // Waits for an edit, payment or status change on this invoice to finish first
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
      if (locked.length === 0) {
        throw new ApiError(404, "ไม่พบ Invoice ที่ต้องการลบ");
      }

      // Payments block deleting their invoice (onDelete: Restrict); lines and history cascade
      await tx.payment.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    return NextResponse.json({ message: "ลบ Invoice แล้ว" });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถลบ Invoice ได้", {
      notFound: "ไม่พบ Invoice ที่ต้องการลบ",
    });
  }
}
