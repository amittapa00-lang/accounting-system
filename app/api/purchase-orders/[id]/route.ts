import { NextResponse } from "next/server";

import { ApiError, handleApiError, readJson } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_INVOICE_WHERE, cleanPoItems, getPoLock, samePoItems } from "@/lib/purchase-orders";

import { parsePurchaseOrderHeader, parsePurchaseOrderStatus, PO_NUMBER_CONFLICT } from "../input";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// GET: ดูรายละเอียด PO
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireApiSession();

    const { id } = await context.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          orderBy: { itemNo: "asc" },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            documentType: true,
            grandTotal: true,
            status: true,
          },
          orderBy: { invoiceDate: "desc" },
        },
      },
    });

    if (!purchaseOrder) {
      throw new ApiError(404, "ไม่พบข้อมูล PO");
    }

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    return handleApiError(error, "เกิดข้อผิดพลาดในการดึงข้อมูล PO");
  }
}

// PUT: แก้ไข PO
// - "items" not sent: lines stay as they are
// - PO has an invoice that is not cancelled: customer, PO No. and lines cannot change
// - PO is cancelled: lines cannot change
export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireApiSession();

    const { id } = await context.params;

    const body = await readJson(request);
    const header = parsePurchaseOrderHeader(body);
    const status = parsePurchaseOrderStatus(body.status);
    const items = body.items === undefined ? null : cleanPoItems(body.items);

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Lock the PO row: invoice creation locks the same row, so "has an invoice"
      // cannot change between the check below and the write.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "PurchaseOrder" WHERE id = ${id} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new ApiError(404, "ไม่พบข้อมูล PO ที่ต้องการแก้ไข");
      }

      const existing = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            orderBy: { itemNo: "asc" },
          },
        },
      });

      const hasActiveInvoice =
        (await tx.invoice.count({
          where: { purchaseOrderId: id, ...ACTIVE_INVOICE_WHERE },
        })) > 0;

      const lock = getPoLock(existing.status, hasActiveInvoice);

      // Compare trimmed: a PO No. saved with stray spaces before trimming existed is not a change
      const poNumberChanged = existing.poNumber.trim() !== header.poNumber;
      const customerChanged = existing.customerId !== header.customerId;
      const itemsChanged = items !== null && !samePoItems(existing.items, items);

      if (lock && (itemsChanged || (lock.identityLocked && (poNumberChanged || customerChanged)))) {
        throw new ApiError(409, lock.message);
      }

      const nextStatus = status ?? existing.status;

      if (nextStatus === "CANCELLED" && existing.status !== "CANCELLED" && hasActiveInvoice) {
        throw new ApiError(409, "ไม่สามารถยกเลิก PO ที่มี Invoice อยู่ได้ กรุณายกเลิก Invoice ก่อน");
      }

      if (customerChanged) {
        const customer = await tx.customer.findUnique({
          where: { id: header.customerId },
          select: { isActive: true },
        });

        if (!customer) {
          throw new ApiError(400, "ไม่พบข้อมูลลูกค้าที่เลือก");
        }

        // The current customer may be inactive (the PO stays editable), but a PO cannot be moved to one
        if (!customer.isActive) {
          throw new ApiError(400, "ลูกค้าที่เลือกถูกปิดใช้งานแล้ว");
        }
      }

      if (itemsChanged && items) {
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      const { poNumber, ...headerFields } = header;

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...headerFields,
          ...(poNumberChanged ? { poNumber } : {}),
          status: nextStatus,
          ...(itemsChanged && items ? { items: { create: items } } : {}),
        },
        include: {
          customer: true,
          items: {
            orderBy: { itemNo: "asc" },
          },
        },
      });
    });

    return NextResponse.json({
      message: "แก้ไข PO สำเร็จ",
      purchaseOrder,
    });
  } catch (error) {
    return handleApiError(error, "เกิดข้อผิดพลาดในการแก้ไข PO", {
      conflict: PO_NUMBER_CONFLICT,
      notFound: "ไม่พบข้อมูล PO ที่ต้องการแก้ไข",
      inUse: "ไม่พบข้อมูลลูกค้าที่เลือก",
    });
  }
}
