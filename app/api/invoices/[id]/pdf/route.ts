/**
 * GET /api/invoices/[id]/pdf
 *   ?mode=preview (default)  form artwork + data, to check on screen or send electronically
 *   ?mode=print              data only, to print onto the pre-printed M-T82-01 form (Epson LQ-630)
 *   ?dx=1.5&dy=-2            shift the data in millimetres (+right / +down), print alignment
 *   ?download=1              download instead of opening in the browser
 */
import { requireApiSession } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api";
import { renderInvoiceFormPdf } from "@/lib/invoiceFormPdf";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_OFFSET_MM = 20;

function offsetParam(value: string | null): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-MAX_OFFSET_MM, Math.min(MAX_OFFSET_MM, n));
}

function branchLabel(branchType: string | null, branchNumber: string | null): string | null {
  if (!branchType && !branchNumber) return null;
  if (branchType === "สาขา" || (!branchType && branchNumber)) {
    return branchNumber ? `สาขาที่ ${branchNumber}` : "สาขา";
  }
  return branchType;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireApiSession();

    const { id } = await params;
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") === "print" ? "print" : "preview";
    const download = url.searchParams.get("download") === "1";

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { orderBy: { itemNo: "asc" } },
        purchaseOrder: {
          select: {
            poNumber: true,
            // printed after the lines (lib/invoices.ts printedNoteBlocks)
            acceptanceCondition: true,
            note: true,
            customer: { select: { branchType: true, branchNumber: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new ApiError(404, "ไม่พบ Invoice ที่ต้องการ");
    }


    const pdf = await renderInvoiceFormPdf(
      {
        ...invoice,
        purchaseOrderNumber: invoice.purchaseOrder.poNumber,
        acceptanceCondition: invoice.purchaseOrder.acceptanceCondition,
        purchaseOrderNote: invoice.purchaseOrder.note,
        customerBranch: branchLabel(
          invoice.purchaseOrder.customer.branchType,
          invoice.purchaseOrder.customer.branchNumber
        ),
      },
      {
        mode,
        offsetMm: { x: offsetParam(url.searchParams.get("dx")), y: offsetParam(url.searchParams.get("dy")) },
      }
    );

    const fileName = `${invoice.invoiceNumber}${mode === "print" ? "-print" : ""}.pdf`.replace(/[^\w.-]/g, "_");

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถสร้าง PDF ได้");
  }
}
