import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import authOptions from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    // ==========================================
    // ตรวจสอบ Login
    // ==========================================

    const session =
      await getServerSession(authOptions);

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
    // รับ Invoice ID
    // ==========================================

    const { id } = await context.params;

    if (!id) {
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
    // Transaction
    // ==========================================

    const result = await prisma.$transaction(
      async (tx) => {
        const invoice =
          await tx.invoice.findUnique({
            where: {
              id,
            },
          });

        // --------------------------------------
        // ไม่พบ Invoice
        // --------------------------------------

        if (!invoice) {
          throw new Error(
            "INVOICE_NOT_FOUND"
          );
        }

        // --------------------------------------
        // Invoice ถูกยกเลิก
        // --------------------------------------

        if (invoice.status === "CANCELLED") {
          throw new Error(
            "INVOICE_CANCELLED"
          );
        }

        // --------------------------------------
        // Invoice ออกไปแล้ว
        // --------------------------------------

        if (invoice.status !== "DRAFT") {
          throw new Error(
            "INVOICE_ALREADY_ISSUED"
          );
        }

        // --------------------------------------
        // เปลี่ยนสถานะ DRAFT → ISSUED
        // --------------------------------------

        const updatedInvoice =
          await tx.invoice.update({
            where: {
              id: invoice.id,
            },
            data: {
              status: "ISSUED",
            },
          });

        return updatedInvoice;
      }
    );

    // ==========================================
    // สำเร็จ
    // ==========================================

    return NextResponse.json(
      {
        message: "ออก Invoice สำเร็จ",
        invoice: result,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/invoices/[id]/issue error:",
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
          error: "ไม่พบ Invoice ที่ต้องการ",
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
            "Invoice นี้ถูกยกเลิกแล้ว",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // ออก Invoice ไปแล้ว
    // ==========================================

    if (
      error instanceof Error &&
      error.message ===
        "INVOICE_ALREADY_ISSUED"
    ) {
      return NextResponse.json(
        {
          error:
            "Invoice นี้ถูกออกเอกสารไปแล้ว",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // Error อื่น ๆ
    // ==========================================

    return NextResponse.json(
      {
        error:
          "ไม่สามารถออก Invoice ได้",
      },
      {
        status: 500,
      }
    );
  }
}