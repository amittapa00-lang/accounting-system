import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

function parseDiscount(
  discountInput: string | number | null | undefined,
  baseAmount: number
) {
  const rawValue = String(
    discountInput ?? ""
  )
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

  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0
  ) {
    throw new Error(
      "Discount ไม่ถูกต้อง"
    );
  }

  if (isPercent) {
    if (numericValue > 100) {
      throw new Error(
        "Discount % ต้องไม่เกิน 100%"
      );
    }

    return {
      value: numericValue,
      type: "PERCENT",
      amount:
        baseAmount *
        (numericValue / 100),
    };
  }

  if (numericValue > baseAmount) {
    throw new Error(
      "Discount แบบจำนวนเงินต้องไม่เกินยอดสินค้า"
    );
  }

  return {
    value: numericValue,
    type: "AMOUNT",
    amount: numericValue,
  };
}

export async function POST(request: Request) {
  try {
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
      items,
    } = body;

    if (
      !poNumber ||
      !customerId ||
      !poDate
    ) {
      return NextResponse.json(
        {
          error:
            "กรุณากรอก PO No., ลูกค้า และวันที่ PO",
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ",
        },
        { status: 400 }
      );
    }

    const existingPO =
      await prisma.purchaseOrder.findUnique({
        where: {
          poNumber,
        },
      });

    if (existingPO) {
      return NextResponse.json(
        {
          error:
            "เลขที่ PO นี้มีอยู่ในระบบแล้ว กรุณาใช้เลขที่ PO อื่น",
        },
        { status: 409 }
      );
    }

    const customer =
      await prisma.customer.findUnique({
        where: {
          id: customerId,
        },
      });

    if (!customer) {
      return NextResponse.json(
        {
          error:
            "ไม่พบข้อมูลลูกค้าที่เลือก",
        },
        { status: 404 }
      );
    }

    const cleanedItems = items.map(
      (
        item: {
          itemNo?: number;
          description: string;
          quantity: number;
          unit?: string;
          unitPrice: number;
          discount?: string | number;
          vat?: number;
        },
        index: number
      ) => {
        const quantity =
          Number(item.quantity);

        const unitPrice =
          Number(item.unitPrice);

        const vat =
          Number(item.vat ?? 0);

        if (
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          throw new Error(
            `รายการที่ ${
              index + 1
            }: จำนวนสินค้าต้องมากกว่า 0`
          );
        }

        if (
          !Number.isFinite(unitPrice) ||
          unitPrice < 0
        ) {
          throw new Error(
            `รายการที่ ${
              index + 1
            }: ราคาสินค้าไม่ถูกต้อง`
          );
        }

        if (
          !Number.isFinite(vat) ||
          vat < 0 ||
          vat > 100
        ) {
          throw new Error(
            `รายการที่ ${
              index + 1
            }: VAT ต้องอยู่ระหว่าง 0-100%`
          );
        }

        const baseAmount =
          quantity * unitPrice;

        const discount =
          parseDiscount(
            item.discount,
            baseAmount
          );

        const amount =
          baseAmount -
          discount.amount;

        return {
          itemNo: index + 1,
          description:
            item.description,
          quantity,
          unit: item.unit || null,
          unitPrice,
          discount: discount.value,
          discountType:
            discount.type,
          vat,
          amount,
        };
      }
    );

    const purchaseOrder =
      await prisma.purchaseOrder.create({
        data: {
          poNumber,
          customerId,

          plant: plant || null,

          poDate: new Date(poDate),

          deliveryDate: deliveryDate
            ? new Date(deliveryDate)
            : null,

          deliveryPlace:
            deliveryPlace || null,

          billPlacement:
            billPlacement || null,

          paymentTerm:
            paymentTerm || null,

          quotationNumber:
            quotationNumber || null,

          quotationDate:
            quotationDate
              ? new Date(quotationDate)
              : null,

          contactName:
            contactName || null,

          contactPhone:
            contactPhone || null,

          contactMobile:
            contactMobile || null,

          acceptanceCondition:
            acceptanceCondition || null,

          note: note || null,

          status: "DRAFT",

          items: {
            create: cleanedItems,
          },
        },

        include: {
          customer: true,
          items: true,
        },
      });

    return NextResponse.json(
      {
        message:
          "บันทึก PO สำเร็จ",
        purchaseOrder,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "CREATE PURCHASE ORDER ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "เกิดข้อผิดพลาดในการบันทึก PO";

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