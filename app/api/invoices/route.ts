/**
 * POST /api/invoices — creates a (sub-)invoice for a purchase order.
 *
 * Body
 *   purchaseOrderId, documentType, invoiceDate, dueDate, paymentTerm, saleName, entryBy, shipToSnapshot
 *   invoiceNumber    first invoice of the PO only; empty = next running number (IV2026/007)
 *   saleOrderNumber  absent = "TC 2026/007-00{sub}"
 *   note             หมายเหตุ printed on the form
 *   billDiscount     "10%" | "4800" | "" (bill discount, before VAT)
 *   items            [{ purchaseOrderItemId, quantity }] lines to bill now; absent = everything still unbilled
 *
 * See lib/invoice-billing.ts for the numbering and partial-billing rules.
 */
import { NextResponse } from "next/server";

import { ApiError, handleApiError, optionalText, readJson, requiredText } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { parseDateInput, todayInputValue } from "@/lib/format";
import {
  billingLines,
  hasUnbilled,
  invoiceGroupOf,
  lockInvoiceNumbering,
  nextInvoiceNumber,
  type BillingLine,
} from "@/lib/invoice-billing";
import { buildInvoiceLines, defaultSaleOrderNumber } from "@/lib/invoices";
import { isDocumentType } from "@/lib/labels";
import { lineHasAmount } from "@/lib/lines";
import { parseDiscount, parseNumber, type Numeric } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const MAX_INVOICE_NUMBER_LENGTH = 40;

/** Text field that falls back to a default only when the client did not send it at all. */
function textOrDefault(value: unknown, fallback: string | null) {
  return value === undefined ? fallback : optionalText(value);
}

function hasAtMost4Decimals(value: number) {
  const shifted = Number(`${Math.abs(value)}e4`);
  return Number.isFinite(shifted) && Math.abs(shifted - Math.round(shifted)) < 1e-6;
}

/** Headings are kept when at least one of the lines below them (up to the next heading) is billed. */
function withHeadings(lines: BillingLine[], chosen: Set<string>): Set<string> {
  const result = new Set(chosen);
  lines.forEach((line, index) => {
    if (line.lineType !== "HEADER") return;
    for (let i = index + 1; i < lines.length && lines[i].lineType !== "HEADER"; i++) {
      if (chosen.has(lines[i].id)) {
        result.add(line.id);
        return;
      }
    }
  });
  return result;
}

/** The lines to bill: what the client chose, or everything still unbilled. */
function selectLines(lines: BillingLine[], rawItems: unknown): { line: BillingLine; quantity: number }[] {
  const byId = new Map(lines.map((line) => [line.id, line]));

  if (rawItems === undefined) {
    const chosen = new Set(lines.filter((l) => lineHasAmount(l.lineType) && l.remaining > 0).map((l) => l.id));
    const keep = withHeadings(lines, chosen);
    return lines.filter((l) => keep.has(l.id)).map((line) => ({ line, quantity: line.remaining }));
  }

  if (!Array.isArray(rawItems)) {
    throw new ApiError(400, "รายการที่เลือกไม่ถูกต้อง");
  }

  const quantities = new Map<string, number>();
  for (const raw of rawItems) {
    const entry = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const id = typeof entry.purchaseOrderItemId === "string" ? entry.purchaseOrderItemId : "";
    const line = byId.get(id);
    if (!line) throw new ApiError(400, "มีรายการที่ไม่อยู่ใน Purchase Order นี้");
    if (quantities.has(id)) throw new ApiError(400, "เลือกรายการซ้ำ");

    const label = `รายการ "${line.description}"`;

    if (!lineHasAmount(line.lineType)) {
      quantities.set(id, 0);
      continue;
    }

    const quantity = parseNumber(entry.quantity as Numeric);
    if (quantity === null || quantity <= 0) throw new ApiError(400, `${label}: จำนวนที่เรียกเก็บต้องมากกว่า 0`);
    if (!hasAtMost4Decimals(quantity)) throw new ApiError(400, `${label}: จำนวนมีทศนิยมได้ไม่เกิน 4 ตำแหน่ง`);
    if (quantity > line.remaining + 1e-9) {
      throw new ApiError(
        400,
        `${label}: เรียกเก็บได้อีกไม่เกิน ${line.remaining} (PO ${line.quantity}, เรียกเก็บแล้ว ${line.billed})`
      );
    }
    quantities.set(id, quantity);
  }

  const selected = lines.filter((line) => quantities.has(line.id));
  if (!selected.some((line) => lineHasAmount(line.lineType))) {
    throw new ApiError(400, "กรุณาเลือกรายการที่จะเรียกเก็บอย่างน้อย 1 รายการ");
  }

  return selected.map((line) => ({ line, quantity: quantities.get(line.id) ?? 0 }));
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

    const requestedNumber = optionalText(body.invoiceNumber);
    if (requestedNumber && requestedNumber.length > MAX_INVOICE_NUMBER_LENGTH) {
      throw new ApiError(400, "เลข Invoice ยาวเกินไป");
    }

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
        if (!hasUnbilled(lines)) {
          throw new ApiError(409, "Purchase Order นี้ออก Invoice ครบทุกรายการแล้ว");
        }

        const selection = selectLines(lines, body.items);

        // Bill discount is validated against this invoice's line total
        const preview = buildInvoiceLines(selection);
        const discount = parseDiscount(body.billDiscount as Numeric, preview.totals.itemsTotal);
        const { lines: invoiceLines, totals } = buildInvoiceLines(
          selection.map(({ line, quantity }) => ({ line, quantity, billedBefore: line.billed })),
          { value: discount.value, type: discount.type }
        );

        // Numbering: one invoice number per PO, sub-numbers for each billing
        await lockInvoiceNumbering(tx);
        const group = await invoiceGroupOf(tx, purchaseOrderId);

        let invoiceNumber: string;
        let subNumber: number;
        if (group) {
          invoiceNumber = group.invoiceNumber;
          subNumber = group.nextSubNumber;
        } else {
          invoiceNumber = requestedNumber ?? (await nextInvoiceNumber(tx, invoiceDate));
          subNumber = 1;
          const taken = await tx.invoice.findFirst({ where: { invoiceNumber }, select: { id: true } });
          if (taken) {
            throw new ApiError(409, `เลข Invoice ${invoiceNumber} ถูกใช้แล้ว กรุณาใช้เลขอื่น`);
          }
        }

        return tx.invoice.create({
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
            saleOrderNumber: textOrDefault(body.saleOrderNumber, defaultSaleOrderNumber(invoiceNumber, subNumber)),
            saleName: optionalText(body.saleName),
            entryBy: optionalText(body.entryBy),
            note: textOrDefault(body.note, purchaseOrder.note),

            purchaseOrderId: purchaseOrder.id,

            billDiscount: discount.value,
            billDiscountType: discount.type,
            billDiscountAmount: totals.discountAmount,
            subtotal: totals.subtotal,
            vat: totals.vat,
            grandTotal: totals.grandTotal,

            status: "DRAFT",

            items: {
              create: invoiceLines.map(({ line, quantity, amount, discount: lineDiscount, discountType }, index) => ({
                itemNo: index + 1,
                lineType: line.lineType,
                description: line.description,
                quantity,
                unit: line.unit,
                unitPrice: lineHasAmount(line.lineType) ? line.unitPrice : 0,
                discount: lineDiscount,
                discountType,
                amount,
                purchaseOrderItemId: line.id,
              })),
            },
          },
          include: { items: true },
        });
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
