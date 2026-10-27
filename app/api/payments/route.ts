import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import authOptions from "../../../auth";
import { prisma } from "../../../lib/prisma";

export async function POST(request: Request) {
  try {
    // ==========================================
    // ตรวจสอบ Login
    // ==========================================

    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        {
          error: "กรุณาเข้าสู่ระบบก่อน",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================
    // รับข้อมูล
    // ==========================================

    const body = await request.json();

    const {
      invoiceId,
      paymentDate,
      amount,
      paymentMethod,
      referenceNumber,
      note,
      receivedBy,
    } = body;

    // ==========================================
    // ตรวจสอบ Invoice ID
    // ==========================================

    if (!invoiceId) {
      return NextResponse.json(
        {
          error: "ไม่พบ Invoice",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // ตรวจสอบจำนวนเงิน
    // ==========================================

    const paymentAmount = Number(amount);

    if (
      amount === undefined ||
      amount === null ||
      amount === "" ||
      Number.isNaN(paymentAmount)
    ) {
      return NextResponse.json(
        {
          error: "กรุณาระบุจำนวนเงิน",
        },
        {
          status: 400,
        }
      );
    }

    if (paymentAmount <= 0) {
      return NextResponse.json(
        {
          error: "จำนวนเงินต้องมากกว่า 0",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // ตรวจสอบวิธีชำระเงิน
    // ==========================================

    if (!paymentMethod) {
      return NextResponse.json(
        {
          error: "กรุณาระบุวิธีชำระเงิน",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // ตรวจสอบวันที่
    // ==========================================

    const paymentDateValue = paymentDate
      ? new Date(paymentDate)
      : new Date();

    if (Number.isNaN(paymentDateValue.getTime())) {
      return NextResponse.json(
        {
          error: "วันที่รับชำระเงินไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // Transaction
    // ==========================================

    const result = await prisma.$transaction(
      async (tx) => {
        // --------------------------------------
        // หา Invoice
        // --------------------------------------

        const invoice =
          await tx.invoice.findUnique({
            where: {
              id: invoiceId,
            },
            include: {
              payments: true,
            },
          });

        if (!invoice) {
          throw new Error(
            "INVOICE_NOT_FOUND"
          );
        }

        // --------------------------------------
        // Invoice ถูกยกเลิก
        // --------------------------------------

        if (invoice.status === "DRAFT") {
  throw new Error(
    "INVOICE_NOT_ISSUED"
  );
}

if (invoice.status === "CANCELLED") {
  throw new Error(
    "INVOICE_CANCELLED"
  );
}

if (invoice.status === "PAID") {
  throw new Error(
    "INVOICE_ALREADY_PAID"
  );
}

        // --------------------------------------
        // Invoice ชำระครบแล้ว
        // --------------------------------------

        if (invoice.status === "PAID") {
          throw new Error(
            "INVOICE_ALREADY_PAID"
          );
        }

        // --------------------------------------
        // คำนวณยอดชำระเดิม
        // --------------------------------------

        const totalPaid =
          invoice.payments.reduce(
            (sum, payment) =>
              sum + Number(payment.amount),
            0
          );

        // --------------------------------------
        // ยอด Invoice
        // --------------------------------------

        const grandTotal = Number(
          invoice.grandTotal
        );

        // --------------------------------------
        // ยอดคงเหลือ
        // --------------------------------------

        const remainingAmount =
          grandTotal - totalPaid;

        // --------------------------------------
        // ป้องกันยอดติดลบ
        // --------------------------------------

        if (remainingAmount <= 0) {
          throw new Error(
            "INVOICE_ALREADY_PAID"
          );
        }

        // --------------------------------------
        // ป้องกันรับเงินเกิน
        // --------------------------------------

        if (
          paymentAmount >
          remainingAmount
        ) {
          throw new Error(
            "PAYMENT_EXCEEDS_REMAINING"
          );
        }

        // --------------------------------------
        // สร้าง Payment
        // --------------------------------------

        const payment =
          await tx.payment.create({
            data: {
              paymentDate:
                paymentDateValue,

              amount: paymentAmount,

              paymentMethod,

              referenceNumber:
                referenceNumber || null,

              note: note || null,

              receivedBy:
                receivedBy || null,

              invoiceId: invoice.id,
            },
          });

        // --------------------------------------
        // คำนวณยอดใหม่
        // --------------------------------------

        const newTotalPaid =
          totalPaid + paymentAmount;

        const newRemainingAmount =
          grandTotal - newTotalPaid;

        // --------------------------------------
        // กำหนดสถานะใหม่
        // --------------------------------------

        let newStatus = invoice.status;

        if (
          newRemainingAmount <= 0
        ) {
          newStatus = "PAID";
        } else {
          newStatus = "PARTIAL";
        }

        // --------------------------------------
        // Update Invoice
        // --------------------------------------

        const updatedInvoice =
          await tx.invoice.update({
            where: {
              id: invoice.id,
            },
            data: {
              status: newStatus,
            },
          });

        return {
          payment,
          invoice: updatedInvoice,
          totalPaid: newTotalPaid,
          remainingAmount:
            Math.max(
              newRemainingAmount,
              0
            ),
        };
      }
    );

    // ==========================================
    // สำเร็จ
    // ==========================================

    return NextResponse.json(
      {
        message:
          "บันทึกการรับชำระเงินสำเร็จ",

        payment: result.payment,

        invoice: result.invoice,

        totalPaid:
          result.totalPaid,

        remainingAmount:
          result.remainingAmount,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/payments error:",
      error
    );

    // ==========================================
    // ไม่พบ Invoice
    // ==========================================

    if (
      error instanceof Error &&
      error.message ===
        "INVOICE_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error:
            "ไม่พบ Invoice ที่ต้องการรับชำระ",
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================
    // Invoice ถูกยกเลิก
    // ==========================================

    if (
      error instanceof Error &&
      error.message ===
        "INVOICE_CANCELLED"
    ) {
      return NextResponse.json(
        {
          error:
            "Invoice นี้ถูกยกเลิกแล้ว ไม่สามารถรับชำระเงินได้",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // Invoice จ่ายครบแล้ว
    // ==========================================

    if (
      error instanceof Error &&
      error.message ===
        "INVOICE_ALREADY_PAID"
    ) {
      return NextResponse.json(
        {
          error:
            "Invoice นี้ชำระเงินครบแล้ว",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // จ่ายเกิน
    // ==========================================

    if (
      error instanceof Error &&
      error.message ===
        "PAYMENT_EXCEEDS_REMAINING"
    ) {
      return NextResponse.json(
        {
          error:
            "จำนวนเงินที่รับชำระมากกว่ายอดคงเหลือ",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // Error อื่น
    // ==========================================

    return NextResponse.json(
      {
        error:
          "ไม่สามารถบันทึกการรับชำระเงินได้",
      },
      {
        status: 500,
      }
    );
  }
}