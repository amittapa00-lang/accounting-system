import { NextResponse } from "next/server";

import { ApiError, handleApiError, readJson } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanPoItems } from "@/lib/purchase-orders";

import { parsePurchaseOrderHeader, PO_NUMBER_CONFLICT } from "./input";

// POST: สร้าง PO พร้อมรายการสินค้า
export async function POST(request: Request) {
  try {
    await requireApiSession();

    const body = await readJson(request);
    const header = parsePurchaseOrderHeader(body);
    const items = cleanPoItems(body.items);

    const customer = await prisma.customer.findUnique({
      where: { id: header.customerId },
      select: { isActive: true },
    });

    if (!customer) {
      throw new ApiError(400, "ไม่พบข้อมูลลูกค้าที่เลือก");
    }

    if (!customer.isActive) {
      throw new ApiError(400, "ลูกค้าที่เลือกถูกปิดใช้งานแล้ว");
    }

    // poNumber is @unique: a duplicate (including two saves at the same moment) is P2002 -> 409
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        ...header,
        status: "DRAFT",
        items: {
          create: items,
        },
      },
      include: {
        customer: true,
        items: {
          orderBy: { itemNo: "asc" },
        },
      },
    });

    return NextResponse.json(
      {
        message: "บันทึก PO สำเร็จ",
        purchaseOrder,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "เกิดข้อผิดพลาดในการบันทึก PO", {
      conflict: PO_NUMBER_CONFLICT,
      inUse: "ไม่พบข้อมูลลูกค้าที่เลือก",
    });
  }
}
