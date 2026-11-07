import { notFound } from "next/navigation";

import { requirePageSession } from "@/lib/auth";
import { toDateInputValue } from "@/lib/format";
import { formatDiscountInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ACTIVE_INVOICE_WHERE, getPoLock } from "@/lib/purchase-orders";

import PurchaseOrderForm, { type PurchaseOrderInitialData } from "@/components/purchase-orders/PurchaseOrderForm";
import { PoStatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditPurchaseOrderPage({ params }: Props) {
  await requirePageSession();

  const { id } = await params;

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: {
      id,
    },
    include: {
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

  const [customers, activeInvoiceCount] = await Promise.all([
    prisma.customer.findMany({
      // The PO's own customer stays selectable even after it has been deactivated
      where: {
        OR: [{ isActive: true }, { id: purchaseOrder.customerId }],
      },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        tel: true,
        taxId: true,
        contactName: true,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.invoice.count({
      where: { purchaseOrderId: purchaseOrder.id, ...ACTIVE_INVOICE_WHERE },
    }),
  ]);

  const lock = getPoLock(purchaseOrder.status, activeInvoiceCount > 0);

  const initialData: PurchaseOrderInitialData = {
    id: purchaseOrder.id,
    header: {
      poNumber: purchaseOrder.poNumber,
      customerId: purchaseOrder.customerId,
      plant: purchaseOrder.plant ?? "",
      poDate: toDateInputValue(purchaseOrder.poDate),
      deliveryDate: toDateInputValue(purchaseOrder.deliveryDate),
      deliveryPlace: purchaseOrder.deliveryPlace ?? "",
      billPlacement: purchaseOrder.billPlacement ?? "",
      paymentTerm: purchaseOrder.paymentTerm ?? "",
      quotationNumber: purchaseOrder.quotationNumber ?? "",
      quotationDate: toDateInputValue(purchaseOrder.quotationDate),
      contactName: purchaseOrder.contactName ?? "",
      contactPhone: purchaseOrder.contactPhone ?? "",
      contactMobile: purchaseOrder.contactMobile ?? "",
      acceptanceCondition: purchaseOrder.acceptanceCondition ?? "",
      note: purchaseOrder.note ?? "",
      status: purchaseOrder.status,
    },
    items: purchaseOrder.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit ?? "",
      unitPrice: Number(item.unitPrice),
      discount: formatDiscountInput(item.discount, item.discountType),
      vat: Number(item.vat),
    })),
  };

  return (
    <>
      <PageHeader
        back={{ href: `/purchase-orders/${purchaseOrder.id}`, label: "กลับรายละเอียด PO" }}
        title="แก้ไข Purchase Order"
        description={`PO No. ${purchaseOrder.poNumber} · แก้ไขข้อมูล PO และรายการสินค้า`}
        meta={<PoStatusBadge status={purchaseOrder.status} />}
      />

      <PurchaseOrderForm customers={customers} initialData={initialData} lock={lock} />
    </>
  );
}
