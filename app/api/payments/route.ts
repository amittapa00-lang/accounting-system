import { NextResponse } from "next/server";

import { ApiError, handleApiError, optionalText, readJson, requiredText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { isPaymentMethod } from "@/lib/labels";
import { compareMoney, paymentSummary } from "@/lib/money";
import {
  exceedsRemainingMessage,
  parsePaymentAmount,
  parsePaymentDate,
  paymentBlockedReason,
  statusAfterPayment,
} from "@/lib/payments";
import { prisma } from "@/lib/prisma";

/** Records a payment against one invoice and updates the invoice status (PARTIAL / PAID). */
export async function POST(request: Request) {
  try {
    const session = await requireApiSession();
    const body = await readJson(request);

    // ==========================================
    // ตรวจสอบข้อมูล (ก่อนเปิด transaction)
    // ==========================================

    const invoiceId = requiredText(body.invoiceId, "ไม่พบ Invoice ที่ต้องการรับชำระ");

    // Format checks here; "not more than the remaining amount" is checked inside the transaction.
    const parsedAmount = parsePaymentAmount(body.amount);
    if ("error" in parsedAmount) {
      throw new ApiError(400, parsedAmount.error);
    }
    const { amount } = parsedAmount;

    if (!isPaymentMethod(body.paymentMethod)) {
      throw new ApiError(400, "กรุณาเลือกวิธีชำระเงินให้ถูกต้อง");
    }
    const paymentMethod = body.paymentMethod;

    const paymentDate = parsePaymentDate(body.paymentDate);
    if ("error" in paymentDate) {
      throw new ApiError(400, paymentDate.error);
    }

    // Who received the money. Blank = the signed-in user.
    const receivedBy =
      optionalText(body.receivedBy) ?? session.user.name ?? session.user.username ?? null;

    // ==========================================
    // Transaction
    // ==========================================

    const result = await prisma.$transaction(async (tx) => {
      // Lock the invoice row first, so two payments for the same invoice run one
      // after the other and the second one sees the first (no overpayment).
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new ApiError(404, "ไม่พบ Invoice ที่ต้องการรับชำระ");
      }

      // Re-read status and payments after taking the lock.
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          status: true,
          grandTotal: true,
          payments: { select: { amount: true } },
        },
      });

      if (!invoice) {
        throw new ApiError(404, "ไม่พบ Invoice ที่ต้องการรับชำระ");
      }

      const blockedReason = paymentBlockedReason(invoice.status);
      if (blockedReason) {
        throw new ApiError(409, blockedReason);
      }

      const paidAmounts = invoice.payments.map((payment) => payment.amount);
      const before = paymentSummary(invoice.grandTotal, paidAmounts);

      if (before.isFullyPaid) {
        throw new ApiError(409, "Invoice นี้ชำระเงินครบแล้ว");
      }

      if (compareMoney(amount, before.remaining) > 0) {
        throw new ApiError(400, exceedsRemainingMessage(before.remaining));
      }

      const payment = await tx.payment.create({
        data: {
          paymentDate: paymentDate.date,
          // String keeps the exact 2-decimal value (no float on the way to DECIMAL(14,2)).
          amount: amount.toFixed(2),
          paymentMethod,
          referenceNumber: optionalText(body.referenceNumber),
          note: optionalText(body.note),
          receivedBy,
          invoiceId: invoice.id,
        },
      });

      const after = paymentSummary(invoice.grandTotal, [...paidAmounts, amount]);

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: statusAfterPayment(after) },
      });

      return {
        payment,
        invoice: updatedInvoice,
        totalPaid: after.paid,
        remainingAmount: after.remaining,
      };
    });

    return NextResponse.json(
      {
        message: "บันทึกการรับชำระเงินสำเร็จ",
        payment: result.payment,
        invoice: result.invoice,
        totalPaid: result.totalPaid,
        remainingAmount: result.remainingAmount,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "ไม่สามารถบันทึกการรับชำระเงินได้", {
      notFound: "ไม่พบ Invoice ที่ต้องการรับชำระ",
    });
  }
}
