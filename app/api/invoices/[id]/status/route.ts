/**
 * POST /api/invoices/[id]/status — the status menu on the invoice page and the invoice list.
 *
 * Body: { status } — one of DRAFT (ยังไม่วางบิล) | ISSUED (วางบิลแล้ว) | PAID (รับเงินแล้ว) | CANCELLED (ยกเลิก)
 *
 * Any status can be chosen from any other:
 *   PAID       records a payment for the remaining amount (dated today) when something is still owed
 *   others     remove the invoice's payments, if any (their details stay in the history)
 *   from CANCELLED  brings the invoice back; refused when its PO lines have since been billed on
 *              other invoices (a PO line is never billed for more than its quantity), or when it
 *              no longer fits in what is left of the PO total before VAT
 *
 * The document type follows the new status (documentTypeForStatus in lib/invoices.ts).
 * Every change is written to the invoice history.
 */
import { NextResponse } from "next/server";

import { ApiError, handleApiError, readJson } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { formatDate, formatMoney, parseDateInput, todayInputValue } from "@/lib/format";
import { billingBalance, billingLines } from "@/lib/invoice-billing";
import { logInvoice, sessionUserName } from "@/lib/invoice-log";
import {
  documentTypeForStatus,
  formatQuantity,
  invoiceStatusChoiceLabel,
  isInvoiceStatusChoice,
  poBalanceError,
} from "@/lib/invoices";
import { documentTypeLabel, paymentMethodLabel } from "@/lib/labels";
import { lineHasAmount } from "@/lib/lines";
import { paymentSummary, toNumber } from "@/lib/money";
import { AUTO_PAYMENT_NOTE } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiSession();

    const { id } = await context.params;
    const body = await readJson(request);
    const target = body.status;
    if (!isInvoiceStatusChoice(target)) {
      throw new ApiError(400, "สถานะไม่ถูกต้อง");
    }

    const invoice = await prisma.$transaction(
      async (tx) => {
        const found = await tx.invoice.findUnique({ where: { id }, select: { purchaseOrderId: true } });
        if (!found) {
          throw new ApiError(404, "ไม่พบ Invoice ที่ต้องการ");
        }

        // Same lock order as creating / editing invoices: the PO, then the invoice
        await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${found.purchaseOrderId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;

        const current = await tx.invoice.findUniqueOrThrow({
          where: { id },
          select: {
            status: true,
            documentType: true,
            grandTotal: true,
            subtotal: true,
            purchaseOrderId: true,
            purchaseOrder: { select: { status: true } },
            items: { select: { purchaseOrderItemId: true, description: true, quantity: true, unitPrice: true, amount: true } },
            payments: {
              select: { amount: true, paymentDate: true, paymentMethod: true, referenceNumber: true },
              orderBy: { paymentDate: "asc" },
            },
          },
        });

        if (current.status === target) {
          throw new ApiError(409, `Invoice นี้อยู่ในสถานะ "${invoiceStatusChoiceLabel(target)}" อยู่แล้ว`);
        }

        const details = [`${invoiceStatusChoiceLabel(current.status)} → ${invoiceStatusChoiceLabel(target)}`];

        // Bringing a cancelled invoice back bills its PO lines again: they must still be free
        if (current.status === "CANCELLED") {
          if (current.purchaseOrder.status === "CANCELLED") {
            throw new ApiError(409, "Purchase Order ของ Invoice นี้ถูกยกเลิกแล้ว จึงนำ Invoice กลับมาไม่ได้");
          }
          const lines = new Map((await billingLines(tx, current.purchaseOrderId, id)).map((line) => [line.id, line]));
          for (const item of current.items) {
            if (!item.purchaseOrderItemId || !lineHasAmount(item)) continue;
            const line = lines.get(item.purchaseOrderItemId);
            const left = line?.remaining ?? 0;
            if (toNumber(item.quantity) > left + 1e-9) {
              throw new ApiError(
                409,
                `นำ Invoice กลับมาไม่ได้: รายการ "${item.description}" ถูกเรียกเก็บใน Invoice อื่นแล้ว (เหลือเรียกเก็บได้ ${formatQuantity(left)})`
              );
            }
          }

          // ... and its amount must still fit in what is left of the PO
          const balanceError = poBalanceError(current.subtotal, await billingBalance(tx, current.purchaseOrderId, id));
          if (balanceError) {
            throw new ApiError(409, `นำ Invoice กลับมาไม่ได้: ${balanceError}`);
          }
        }

        const summary = paymentSummary(
          current.grandTotal,
          current.payments.map((payment) => payment.amount)
        );

        if (target === "PAID") {
          if (summary.remaining > 0) {
            await tx.payment.create({
              data: {
                paymentDate: parseDateInput(todayInputValue()) ?? new Date(),
                amount: summary.remaining.toFixed(2),
                paymentMethod: "OTHER",
                note: AUTO_PAYMENT_NOTE,
                receivedBy: sessionUserName(session),
                invoiceId: id,
              },
            });
            details.push(`บันทึกรับเงิน ${formatMoney(summary.remaining)} บาท (ยอดคงเหลือ)`);
          }
        } else if (current.payments.length > 0) {
          await tx.payment.deleteMany({ where: { invoiceId: id } });
          for (const payment of current.payments) {
            details.push(
              `ลบรายการรับชำระ ${formatDate(payment.paymentDate)} ${formatMoney(payment.amount)} บาท (${paymentMethodLabel(payment.paymentMethod)}${payment.referenceNumber ? ` ${payment.referenceNumber}` : ""})`
            );
          }
        }

        // The document type follows the status (ใบกำกับภาษี / ใบวางบิล / ใบเสร็จ)
        const documentType = documentTypeForStatus(target);
        if (documentType !== current.documentType) {
          details.push(`ประเภทเอกสาร: ${documentTypeLabel(current.documentType)} → ${documentTypeLabel(documentType)}`);
        }

        await logInvoice(tx, id, "STATUS", session, details);
        return tx.invoice.update({ where: { id }, data: { status: target, documentType } });
      },
      // Waiting for the PO / invoice locks counts against the timeout
      { timeout: 15_000 }
    );

    return NextResponse.json({ message: `เปลี่ยนสถานะเป็น "${invoiceStatusChoiceLabel(target)}" แล้ว`, invoice });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถเปลี่ยนสถานะ Invoice ได้", {
      notFound: "ไม่พบ Invoice ที่ต้องการ",
    });
  }
}
