import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseDiscount(
  discountInput: string | number | null | undefined,
  baseAmount: number
) {
  const rawValue = String(discountInput ?? "")
    .trim()
    .replace(/,/g, "");

  if (!rawValue) {
    return {
      value: 0,
      type: "PERCENT",
      amount: 0,
    };
  }

  const isPercent = rawValue.endsWith("%");

  const numericText = isPercent
    ? rawValue.slice(0, -1).trim()
    : rawValue;

  const numericValue = Number(numericText);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error("Discount ไม่ถูกต้อง");
  }

  if (isPercent) {
    if (numericValue > 100) {
      throw new Error("Discount % ต้องไม่เกิน 100%");
    }

    return {
      value: numericValue,
      type: "PERCENT",
      amount: baseAmount * (numericValue / 100),
    };
  }

  if (numericValue > baseAmount) {
    throw new Error("Discount แบบจำนวนเงินต้องไม่เกินยอดสินค้า");
  }

  return {
    value: numericValue,
    type: "AMOUNT",
    amount: numericValue,
  };
}

// GET: ดูรายละเอียด PO
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
        items: {
          orderBy: {
            itemNo: "asc",
          },
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
          orderBy: {
            invoiceDate: "desc",
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        {
          error: "ไม่พบข้อมูล PO",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      purchaseOrder,
    });
  } catch (error) {
    console.error("GET PURCHASE ORDER ERROR:", error);

    return NextResponse.json(
      {
        error: "เกิดข้อผิดพลาดในการดึงข้อมูล PO",
      },
      {
        status: 500,
      }
    );
  }
}

// PUT: แก้ไข PO
export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const body = await request.json();

    const {
      poNumber,
      customerId,
      plant,
      poDate,
      deliveryDate,
      deliveryPlace,
      billPlacement,
      paymentTerm,
      quotationNumber,
      quotationDate,
      contactName,
      contactPhone,
      contactMobile,
      acceptanceCondition,
      note,
      status,
      items,
    } = body;

    if (!poNumber || !customerId || !poDate) {
      return NextResponse.json(
        {
          error: "กรุณากรอก PO No., ลูกค้า และวันที่ PO",
        },
        {
          status: 400,
        }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ",
        },
        {
          status: 400,
        }
      );
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: {
        id,
      },
      include: {
        items: true,
      },
    });

    if (!existingPO) {
      return NextResponse.json(
        {
          error: "ไม่พบข้อมูล PO ที่ต้องการแก้ไข",
        },
        {
          status: 404,
        }
      );
    }

    const duplicatePO = await prisma.purchaseOrder.findFirst({
      where: {
        poNumber,
        NOT: {
          id,
        },
      },
    });

    if (duplicatePO) {
      return NextResponse.json(
        {
          error: "เลขที่ PO นี้มีอยู่ในระบบแล้ว กรุณาใช้เลขที่ PO อื่น",
        },
        {
          status: 409,
        }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          error: "ไม่พบข้อมูลลูกค้าที่เลือก",
        },
        {
          status: 404,
        }
      );
    }

    const cleanedItems = items.map(
      (
        item: {
          description: string;
          quantity: number | string;
          unit?: string;
          unitPrice: number | string;
          discount?: string | number;
          discountType?: string;
          vat?: number | string;
        },
        index: number
      ) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const vat = Number(item.vat || 0);

        if (!item.description?.trim()) {
          throw new Error(
            `กรุณากรอกรายละเอียดสินค้า รายการที่ ${index + 1}`
          );
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(
            `จำนวนสินค้าไม่ถูกต้อง รายการที่ ${index + 1}`
          );
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new Error(
            `ราคาสินค้าไม่ถูกต้อง รายการที่ ${index + 1}`
          );
        }

        if (!Number.isFinite(vat) || vat < 0) {
          throw new Error(
            `VAT ไม่ถูกต้อง รายการที่ ${index + 1}`
          );
        }

        const beforeDiscount = quantity * unitPrice;

        const discount = parseDiscount(
          item.discount,
          beforeDiscount
        );

        const netAmount = beforeDiscount - discount.amount;

        return {
          itemNo: index + 1,
          description: item.description.trim(),
          quantity,
          unit: item.unit?.trim() || null,
          unitPrice,
          discount: discount.value,
          discountType: discount.type,
          vat,
          amount: netAmount,
        };
      }
    );

    const updatedPurchaseOrder =
      await prisma.$transaction(async (tx) => {
        await tx.purchaseOrderItem.deleteMany({
          where: {
            purchaseOrderId: id,
          },
        });

        return tx.purchaseOrder.update({
          where: {
            id,
          },
          data: {
            poNumber,
            customerId,
            plant: plant || null,
            poDate: new Date(poDate),
            deliveryDate: deliveryDate
              ? new Date(deliveryDate)
              : null,
            deliveryPlace: deliveryPlace || null,
            billPlacement: billPlacement || null,
            paymentTerm: paymentTerm || null,
            quotationNumber: quotationNumber || null,
            quotationDate: quotationDate
              ? new Date(quotationDate)
              : null,
            contactName: contactName || null,
            contactPhone: contactPhone || null,
            contactMobile: contactMobile || null,
            acceptanceCondition:
              acceptanceCondition || null,
            note: note || null,
            status: status || existingPO.status,
            items: {
              create: cleanedItems,
            },
          },
          include: {
            customer: true,
            items: {
              orderBy: {
                itemNo: "asc",
              },
            },
          },
        });
      });

    return NextResponse.json({
      message: "แก้ไข PO สำเร็จ",
      purchaseOrder: updatedPurchaseOrder,
    });
  } catch (error) {
    console.error("UPDATE PURCHASE ORDER ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "เกิดข้อผิดพลาดในการแก้ไข PO";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}