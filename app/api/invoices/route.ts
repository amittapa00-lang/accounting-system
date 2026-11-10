/**
 * POST /api/invoices — creates a (sub-)invoice for a purchase order.
 *
 * Body
 *   purchaseOrderId, documentType, invoiceDate, dueDate, paymentTerm, saleName, entryBy, shipToSnapshot
 *   invoiceNumber    first invoice of the PO only, must start with IV; empty = next running number (IV2026/007).
 *                    May be a number another PO uses when the Sale Order No. differs (next sub-number).
 *   saleOrderNumber  typed by the user; blank = none (duplicates are allowed, except with the same invoice number)
 *   note             หมายเหตุ printed on the form
 *   billDiscount     "10%" | "4800" | "" (bill discount, before VAT)
 *   billingMode      "PO" (default, เลือกจากรายการ PO) | "CUSTOM" (ทำรายการใหม่)
 *   items            PO: [{ purchaseOrderItemId, quantity }] lines to bill now; absent = everything still unbilled
 *   customItems      CUSTOM: [{ lineType, description, quantity, unit, unitPrice, discount, amount }] typed lines, same as PO lines
 *   vatRate          CUSTOM: VAT % for the typed lines (one rate for the invoice)
 * Either way the invoice must fit in what is left of the PO total before VAT.
 *
 * See lib/invoice-billing.ts for the numbering and partial-billing rules.
 */
import { NextResponse } from "next/server";

import { ApiError, handleApiError, optionalText, readJson, requiredText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import {
  billingBalance,
  billingLines,
  claimInvoiceNumber,
  hasUnbilled,
  invoiceGroupOf,
  lockInvoiceNumbering,
  nextInvoiceNumber,
} from "@/lib/invoice-billing";
import { logInvoice } from "@/lib/invoice-log";
import { poBalanceError } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";

import { parseBillingMode, parseInvoiceDates, parseRequestedNumber, priceInvoice, textOrDefault } from "./input";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession();

    const body = await readJson(request);

    const purchaseOrderId = requiredText(body.purchaseOrderId, "ไม่พบ Purchase Order");
    const { documentType, invoiceDate, dueDate } = parseInvoiceDates(body);
    const requestedNumber = parseRequestedNumber(body.invoiceNumber);

    const invoice = await prisma.$transaction(
      async (tx) => {
        // Lock the PO row first: two requests for the same PO run one after the other,
        // so the unbilled quantities read below cannot be billed twice.
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "PurchaseOrder" WHERE id = ${purchaseOrderId} FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new ApiError(404, "ไม่พบ Purchase Order ที่ต้องการ");
        }

        const purchaseOrder = await tx.purchaseOrder.findUniqueOrThrow({
          where: { id: purchaseOrderId },
          include: { customer: true },
        });

        if (purchaseOrder.status === "CANCELLED") {
          throw new ApiError(409, "Purchase Order นี้ถูกยกเลิกแล้ว ไม่สามารถสร้าง Invoice ได้");
        }

        const lines = await billingLines(tx, purchaseOrderId);
        if (lines.length === 0) {
          throw new ApiError(400, "Purchase Order นี้ยังไม่มีรายการสินค้า");
        }
        if (parseBillingMode(body.billingMode) === "PO" && !hasUnbilled(lines)) {
          throw new ApiError(409, "รายการใน Purchase Order นี้ออก Invoice ครบแล้ว (ใช้ \"ทำรายการใหม่\" เพื่อเรียกเก็บยอดที่เหลือ)");
        }

        const { totals, items } = priceInvoice(body, lines);

        // Every invoice is deducted from the PO: together they bill at most the PO total before VAT
        const balanceError = poBalanceError(totals.subtotal, await billingBalance(tx, purchaseOrderId));
        if (balanceError) {
          throw new ApiError(400, balanceError);
        }

        // Numbering: one invoice number per PO, sub-numbers for each billing
        await lockInvoiceNumbering(tx);
        const group = await invoiceGroupOf(tx, purchaseOrderId);

        let invoiceNumber: string;
        let subNumber: number;
        if (group) {
          invoiceNumber = group.invoiceNumber;
          subNumber = group.nextSubNumber;
        } else {
          // A typed number may be one another PO uses, with a different Sale Order No.
          invoiceNumber = requestedNumber ?? (await nextInvoiceNumber(tx, invoiceDate));
          subNumber = await claimInvoiceNumber(tx, {
            invoiceNumber,
            saleOrderNumber: optionalText(body.saleOrderNumber),
            purchaseOrderId,
          });
        }

        const created = await tx.invoice.create({
          data: {
            invoiceNumber,
            subNumber,
            documentType,
            invoiceDate,

            customerCodeSnapshot: purchaseOrder.customer.code,
            customerNameSnapshot: purchaseOrder.customer.name,
            customerAddressSnapshot: purchaseOrder.customer.address,
            customerTaxIdSnapshot: purchaseOrder.customer.taxId,

            shipToSnapshot: textOrDefault(body.shipToSnapshot, purchaseOrder.deliveryPlace),
            dueDate,
            paymentTerm: textOrDefault(body.paymentTerm, purchaseOrder.paymentTerm),
            saleOrderNumber: optionalText(body.saleOrderNumber),
            saleName: optionalText(body.saleName),
            entryBy: optionalText(body.entryBy),
            note: textOrDefault(body.note, purchaseOrder.note),

            purchaseOrderId: purchaseOrder.id,

            ...totals,

            status: "DRAFT",

            items: { create: items },
          },
          include: { items: true },
        });

        await logInvoice(tx, created.id, "CREATED", session, subNumber > 1 ? `ใบย่อยที่ ${subNumber}` : null);

        return created;
      },
      // Waiting for the PO / numbering locks counts against the timeout
      { timeout: 15_000 }
    );

    return NextResponse.json(
      { message: "สร้าง Invoice สำเร็จ", invoice },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "ไม่สามารถสร้าง Invoice ได้", {
      conflict: "เลข Invoice ซ้ำ กรุณาลองสร้างใหม่อีกครั้ง",
    });
  }
}
