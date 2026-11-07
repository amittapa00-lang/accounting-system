import { NextResponse } from "next/server";

import { ApiError, handleApiError, optionalText, readJson, requiredText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { parseDateInput, todayInputValue } from "@/lib/format";
import { formatInvoiceNumber, invoiceLinesFromPo, invoiceNumberPrefix } from "@/lib/invoices";
import { isDocumentType } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Next running number for the month of `prefix`.
 * Must run inside the transaction that creates the invoice: the advisory lock is held
 * until that transaction ends, so concurrent creates for the same month wait for each other
 * instead of computing the same number.
 */
async function nextInvoiceNumber(tx: Prisma.TransactionClient, prefix: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice-number:${prefix}`}))`;

  // Longest first, then descending: orders the running part numerically (…-9999 < …-10000)
  const last = await tx.$queryRaw<{ invoiceNumber: string }[]>`
    SELECT "invoiceNumber" FROM "Invoice"
    WHERE "invoiceNumber" LIKE ${`${prefix}%`}
    ORDER BY length("invoiceNumber") DESC, "invoiceNumber" DESC
    LIMIT 1
  `;

  const lastRunning = last.length > 0 ? Number(last[0].invoiceNumber.slice(prefix.length)) : 0;
  const running = Number.isInteger(lastRunning) && lastRunning > 0 ? lastRunning + 1 : 1;

  return formatInvoiceNumber(prefix, running);
}

/** Text field that falls back to a PO value only when the client did not send it at all. */
function textOrDefault(value: unknown, fallback: string | null) {
  return value === undefined ? fallback : optionalText(value);
}

export async function POST(request: Request) {
  try {
    await requireApiSession();

    const body = await readJson(request);

    const purchaseOrderId = requiredText(body.purchaseOrderId, "ไม่พบ Purchase Order");

    const documentType = body.documentType;
    if (!isDocumentType(documentType)) {
      throw new ApiError(400, "กรุณาเลือกประเภทเอกสารให้ถูกต้อง");
    }

    const invoiceDate =
      body.invoiceDate === undefined || body.invoiceDate === null || body.invoiceDate === ""
        ? parseDateInput(todayInputValue())
        : parseDateInput(body.invoiceDate);
    if (!invoiceDate) {
      throw new ApiError(400, "วันที่ Invoice ไม่ถูกต้อง");
    }

    let dueDate: Date | null = null;
    if (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "") {
      dueDate = parseDateInput(body.dueDate);
      if (!dueDate) {
        throw new ApiError(400, "วันครบกำหนดชำระไม่ถูกต้อง");
      }
      if (dueDate < invoiceDate) {
        throw new ApiError(400, "วันครบกำหนดชำระต้องไม่ก่อนวันที่ Invoice");
      }
    }

    const invoice = await prisma.$transaction(
      async (tx) => {
        // Lock the PO row first: two requests for the same PO run one after the other,
        // so the "already has an invoice" check below cannot be passed by both.
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "PurchaseOrder" WHERE id = ${purchaseOrderId} FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new ApiError(404, "ไม่พบ Purchase Order ที่ต้องการ");
        }

        const purchaseOrder = await tx.purchaseOrder.findUniqueOrThrow({
          where: { id: purchaseOrderId },
          include: {
            customer: true,
            items: { orderBy: { itemNo: "asc" } },
          },
        });

        if (purchaseOrder.status === "CANCELLED") {
          throw new ApiError(409, "Purchase Order นี้ถูกยกเลิกแล้ว ไม่สามารถสร้าง Invoice ได้");
        }

        const activeInvoice = await tx.invoice.findFirst({
          where: { purchaseOrderId, status: { not: "CANCELLED" } },
          select: { invoiceNumber: true },
        });
        if (activeInvoice) {
          throw new ApiError(
            409,
            `Purchase Order นี้มี Invoice ${activeInvoice.invoiceNumber} อยู่แล้ว (1 PO ออกได้ 1 Invoice) หากต้องการออกใหม่ ให้ยกเลิก Invoice ฉบับร่างเดิมก่อน`
          );
        }

        if (purchaseOrder.items.length === 0) {
          throw new ApiError(400, "Purchase Order นี้ยังไม่มีรายการสินค้า");
        }

        const { lines, totals } = invoiceLinesFromPo(purchaseOrder.items);

        const invoiceNumber = await nextInvoiceNumber(tx, invoiceNumberPrefix(invoiceDate));

        return tx.invoice.create({
          data: {
            invoiceNumber,
            documentType,
            invoiceDate,

            customerCodeSnapshot: purchaseOrder.customer.code,
            customerNameSnapshot: purchaseOrder.customer.name,
            customerAddressSnapshot: purchaseOrder.customer.address,
            customerTaxIdSnapshot: purchaseOrder.customer.taxId,

            shipToSnapshot: textOrDefault(body.shipToSnapshot, purchaseOrder.deliveryPlace),
            dueDate,
            paymentTerm: textOrDefault(body.paymentTerm, purchaseOrder.paymentTerm),
            saleOrderNumber: textOrDefault(body.saleOrderNumber, purchaseOrder.poNumber),
            saleName: optionalText(body.saleName),
            entryBy: optionalText(body.entryBy),

            purchaseOrderId: purchaseOrder.id,

            subtotal: totals.subtotal,
            vat: totals.vat,
            grandTotal: totals.grandTotal,

            status: "DRAFT",

            items: {
              create: lines.map(({ item, amount }, index) => ({
                itemNo: index + 1,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                discount: item.discount,
                discountType: item.discountType,
                amount,
              })),
            },
          },
          include: { items: true },
        });
      },
      // Waiting for the PO / numbering locks counts against the timeout
      { timeout: 15_000 }
    );

    return NextResponse.json({ message: "สร้าง Invoice สำเร็จ", invoice }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถสร้าง Invoice ได้", {
      conflict: "เลข Invoice ซ้ำ กรุณาลองสร้างใหม่อีกครั้ง",
    });
  }
}
