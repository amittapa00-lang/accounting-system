import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import authOptions from "../../../auth";
import { prisma } from "../../../lib/prisma";
import InvoiceForm from "../InvoiceForm";

type Props = {
  searchParams: Promise<{
    purchaseOrderId?: string;
  }>;
};

export default async function NewInvoicePage({
  searchParams,
}: Props) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { purchaseOrderId } = await searchParams;

  if (!purchaseOrderId) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-800">
              ไม่พบ Purchase Order
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              กรุณาเข้าหน้า Purchase Order แล้วกด
              &quot;สร้าง Invoice จาก PO&quot;
            </p>

            <Link
              href="/purchase-orders"
              className="mt-6 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              กลับ Purchase Order
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: {
      id: purchaseOrderId,
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

  if (!purchaseOrder) {
    notFound();
  }

  const initialData = {
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    poDate: purchaseOrder.poDate.toISOString().slice(0, 10),

    customerCode: purchaseOrder.customer.code,
    customerName: purchaseOrder.customer.name,
    customerAddress: purchaseOrder.customer.address ?? "",
    customerTaxId: purchaseOrder.customer.taxId ?? "",

    deliveryPlace: purchaseOrder.deliveryPlace ?? "",
    paymentTerm: purchaseOrder.paymentTerm ?? "",

    items: purchaseOrder.items.map((item) => ({
      id: item.id,
      itemNo: item.itemNo,
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit ?? "",
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      discountType: item.discountType,
      vat: Number(item.vat),
      amount: Number(item.amount),
    })),
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">
            สร้าง Invoice
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            สร้าง Invoice จาก Purchase Order{" "}
            {purchaseOrder.poNumber}
          </p>
        </div>

        <InvoiceForm initialData={initialData} />
      </div>
    </main>
  );
}