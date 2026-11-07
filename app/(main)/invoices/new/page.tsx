import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePageSession } from "@/lib/auth";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

import InvoiceForm from "@/components/invoices/InvoiceForm";

export const instant = false;

type Props = {
  searchParams: Promise<{
    purchaseOrderId?: string;
  }>;
};

/** Shown instead of the form when an invoice cannot be created from this PO. */
function Notice({
  title,
  message,
  href,
  linkLabel,
}: {
  title: string;
  message: React.ReactNode;
  href: string;
  linkLabel: string;
}) {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>

          <p className="mt-2 text-sm text-slate-500">{message}</p>

          <Link
            href={href}
            className="mt-6 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {linkLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function NewInvoicePage({ searchParams }: Props) {
  await requirePageSession();

  const { purchaseOrderId } = await searchParams;

  if (!purchaseOrderId) {
    return (
      <Notice
        title="ไม่พบ Purchase Order"
        message={<>กรุณาเข้าหน้า Purchase Order แล้วกด &quot;สร้าง Invoice จาก PO&quot;</>}
        href="/purchase-orders"
        linkLabel="กลับ Purchase Order"
      />
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
      // 1 PO = 1 Invoice: a cancelled invoice does not count
      invoices: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, invoiceNumber: true },
        take: 1,
      },
    },
  });

  if (!purchaseOrder) {
    notFound();
  }

  const poHref = `/purchase-orders/${purchaseOrder.id}`;
  const activeInvoice = purchaseOrder.invoices[0];

  if (activeInvoice) {
    return (
      <Notice
        title="Purchase Order นี้มี Invoice แล้ว"
        message={
          <>
            Purchase Order {purchaseOrder.poNumber} ออก Invoice {activeInvoice.invoiceNumber} ไปแล้ว (1 PO ออกได้ 1
            Invoice) หากต้องการออกใหม่ ให้ยกเลิก Invoice ฉบับร่างเดิมก่อน
          </>
        }
        href={`/invoices/${activeInvoice.id}`}
        linkLabel={`ดู Invoice ${activeInvoice.invoiceNumber}`}
      />
    );
  }

  if (purchaseOrder.status === "CANCELLED") {
    return (
      <Notice
        title="Purchase Order นี้ถูกยกเลิกแล้ว"
        message={`ไม่สามารถสร้าง Invoice จาก Purchase Order ${purchaseOrder.poNumber} ที่ถูกยกเลิกได้`}
        href={poHref}
        linkLabel="กลับ Purchase Order"
      />
    );
  }

  if (purchaseOrder.items.length === 0) {
    return (
      <Notice
        title="Purchase Order นี้ยังไม่มีรายการสินค้า"
        message="กรุณาเพิ่มรายการสินค้าใน Purchase Order ก่อนสร้าง Invoice"
        href={poHref}
        linkLabel="กลับ Purchase Order"
      />
    );
  }

  const initialData = {
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,

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
      quantity: toNumber(item.quantity),
      unit: item.unit ?? "",
      unitPrice: toNumber(item.unitPrice),
      discount: toNumber(item.discount),
      discountType: item.discountType,
      vat: toNumber(item.vat),
    })),
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">สร้าง Invoice</h1>

          <p className="mt-1 text-sm text-slate-500">สร้าง Invoice จาก Purchase Order {purchaseOrder.poNumber}</p>
        </div>

        <InvoiceForm initialData={initialData} />
      </div>
    </main>
  );
}
