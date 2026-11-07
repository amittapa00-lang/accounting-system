import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * Moves a DRAFT invoice to ISSUED or CANCELLED (used by /api/invoices/[id]/issue and /cancel).
 *
 * The update itself is guarded by `status: "DRAFT"`, so two concurrent requests cannot
 * both succeed (e.g. issue + cancel at the same time): the second one updates 0 rows.
 */
export async function changeDraftInvoiceStatus(id: string, nextStatus: "ISSUED" | "CANCELLED") {
  const { count } = await prisma.invoice.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: nextStatus },
  });

  if (count === 0) {
    const current = await prisma.invoice.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!current) {
      throw new ApiError(404, "ไม่พบ Invoice ที่ต้องการ");
    }

    if (current.status === "CANCELLED") {
      throw new ApiError(409, "Invoice นี้ถูกยกเลิกแล้ว");
    }

    throw new ApiError(
      409,
      nextStatus === "CANCELLED"
        ? "ยกเลิกได้เฉพาะ Invoice ฉบับร่างเท่านั้น (Invoice นี้ออกเอกสารไปแล้ว)"
        : "Invoice นี้ถูกออกเอกสารไปแล้ว"
    );
  }

  return prisma.invoice.findUniqueOrThrow({ where: { id } });
}
