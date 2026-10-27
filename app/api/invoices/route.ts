import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import authOptions from "../../../auth";
import { prisma } from "../../../lib/prisma";

function getInvoiceNumber(date: Date, runningNumber: number) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const running = String(runningNumber).padStart(4, "0");

  return `INV-${year}${month}-${running}`;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      purchaseOrderId,
      documentType,
      invoiceDate,
      dueDate,
      paymentTerm,
      saleOrderNumber,
      saleName,
      entryBy,
      shipToSnapshot,
    } = body;

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: "ไม่พบ Purchase Order" },
        { status: 400 }
      );
    }

    if (!documentType) {
      return NextResponse.json(
        { error: "กรุณาระบุประเภทเอกสาร" },
        { status: 400 }
      );
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        customer: true,
        items: {
          orderBy: {
            itemNo: "asc",
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "ไม่พบ Purchase Order ที่ต้องการ" },
        { status: 404 }
      );
    }

    if (purchaseOrder.items.length === 0) {
      return NextResponse.json(
        { error: "Purchase Order นี้ยังไม่มีรายการสินค้า" },
        { status: 400 }
      );
    }

    const invoiceDateValue = invoiceDate
      ? new Date(invoiceDate)
      : new Date();

    if (Number.isNaN(invoiceDateValue.getTime())) {
      return NextResponse.json(
        { error: "วันที่ Invoice ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // ==========================================
      // สร้างเลข Invoice แบบแยกตามปี + เดือน
      // เช่น INV-202610-0001
      // ==========================================

      const year = invoiceDateValue.getFullYear();

      const month = String(
        invoiceDateValue.getMonth() + 1
      ).padStart(2, "0");

      const prefix = `INV-${year}${month}-`;

      const lastInvoice = await tx.invoice.findFirst({
        where: {
          invoiceNumber: {
            startsWith: prefix,
          },
        },
        orderBy: {
          invoiceNumber: "desc",
        },
      });

      let runningNumber = 1;

      if (lastInvoice) {
        const lastNumber = Number(
          lastInvoice.invoiceNumber.replace(prefix, "")
        );

        if (!Number.isNaN(lastNumber)) {
          runningNumber = lastNumber + 1;
        }
      }

      const invoiceNumber = getInvoiceNumber(
        invoiceDateValue,
        runningNumber
      );

      // ==========================================
      // เตรียมรายการสินค้า
      // ==========================================

      const items = purchaseOrder.items.map((item, index) => {
        const amount = Number(item.amount);

        return {
          itemNo: index + 1,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountPercent:
            item.discountType === "PERCENT"
              ? item.discount
              : 0,
          amount,
        };
      });

      // ==========================================
      // คำนวณยอดรวม
      // ==========================================

      const subtotal = items.reduce(
        (sum, item) => sum + item.amount,
        0
      );

      const vat = purchaseOrder.items.reduce(
        (sum, item) => {
          const amount = Number(item.amount);
          const vatPercent = Number(item.vat);

          return sum + amount * (vatPercent / 100);
        },
        0
      );

      const grandTotal = subtotal + vat;

      // ==========================================
      // สร้าง Invoice
      // ==========================================

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          documentType,
          invoiceDate: invoiceDateValue,

          customerCodeSnapshot:
            purchaseOrder.customer.code,

          customerNameSnapshot:
            purchaseOrder.customer.name,

          customerAddressSnapshot:
            purchaseOrder.customer.address,

          customerTaxIdSnapshot:
            purchaseOrder.customer.taxId,

          shipToSnapshot:
            shipToSnapshot ||
            purchaseOrder.deliveryPlace,

          dueDate: dueDate
            ? new Date(dueDate)
            : null,

          paymentTerm:
            paymentTerm ||
            purchaseOrder.paymentTerm,

          saleOrderNumber:
            saleOrderNumber ||
            purchaseOrder.poNumber,

          saleName:
            saleName || null,

          entryBy:
            entryBy || null,

          purchaseOrderId:
            purchaseOrder.id,

          subtotal,
          vat,
          grandTotal,

          status: "DRAFT",

          items: {
            create: items,
          },
        },

        include: {
          items: true,
        },
      });

      return invoice;
    });

    return NextResponse.json(
      {
        message: "สร้าง Invoice สำเร็จ",
        invoice: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST /api/invoices error:",
      error
    );

    // กรณีเลข Invoice ซ้ำ
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        {
          error:
            "เลข Invoice ซ้ำ กรุณาลองสร้างใหม่อีกครั้ง",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "ไม่สามารถสร้าง Invoice ได้",
      },
      { status: 500 }
    );
  }
}