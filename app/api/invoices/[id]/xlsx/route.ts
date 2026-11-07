import path from "path";
import { getServerSession } from "next-auth";
import authOptions from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";
import {
  buildInvoiceXlsx,
  InvoiceXlsxError,
} from "../../../../../lib/invoiceXlsx";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      purchaseOrder: {
        select: {
          poNumber: true,
          note: true,
          acceptanceCondition: true,
          customer: { select: { tel: true } },
        },
      },
      items: { orderBy: { itemNo: "asc" } },
    },
  });

  if (!invoice) {
    return Response.json({ error: "ไม่พบ Invoice" }, { status: 404 });
  }

  try {
    const buffer = await buildInvoiceXlsx(
      {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        customerCode: invoice.customerCodeSnapshot,
        customerName: invoice.customerNameSnapshot,
        customerAddress: invoice.customerAddressSnapshot,
        customerTaxId: invoice.customerTaxIdSnapshot,
        shipTo: invoice.shipToSnapshot,
        tel: invoice.purchaseOrder.customer?.tel,
        saleOrderNumber: invoice.saleOrderNumber,
        poNumber: invoice.purchaseOrder.poNumber,
        remark: invoice.purchaseOrder.note,
        acceptanceCondition: invoice.purchaseOrder.acceptanceCondition,
        subtotal: Number(invoice.subtotal),
        vat: Number(invoice.vat),
        grandTotal: Number(invoice.grandTotal),
        items: invoice.items.map((item) => ({
          itemNo: item.itemNo,
          description: item.description,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          discountPercent: Number(item.discountPercent),
          amount: Number(item.amount),
        })),
      },
      path.join(process.cwd(), "templates", "invoice-template.xlsx")
    );

    const fileName = `${invoice.invoiceNumber.replace(/[\\/:*?"<>|]/g, "-")}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          fileName
        )}`,
      },
    });
  } catch (error) {
    if (error instanceof InvoiceXlsxError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}