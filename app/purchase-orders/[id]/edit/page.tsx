import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import authOptions from "@/auth";
import { prisma } from "@/lib/prisma";

import PurchaseOrderForm from "../../PurchaseOrderForm";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditPurchaseOrderPage({
  params,
}: Props) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: {
      id,
    },
    include: {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          tel: true,
          taxId: true,
          branchType: true,
          branchNumber: true,
          contactName: true,
        },
      },
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

  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      tel: true,
      taxId: true,
      branchType: true,
      branchNumber: true,
      contactName: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const initialData = {
    id: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    customerId: purchaseOrder.customerId,
    plant: purchaseOrder.plant ?? "",
    poDate: purchaseOrder.poDate.toISOString().slice(0, 10),
    deliveryDate: purchaseOrder.deliveryDate
      ? purchaseOrder.deliveryDate.toISOString().slice(0, 10)
      : "",
    deliveryPlace: purchaseOrder.deliveryPlace ?? "",
    billPlacement: purchaseOrder.billPlacement ?? "",
    paymentTerm: purchaseOrder.paymentTerm ?? "",
    quotationNumber: purchaseOrder.quotationNumber ?? "",
    quotationDate: purchaseOrder.quotationDate
      ? purchaseOrder.quotationDate.toISOString().slice(0, 10)
      : "",
    contactName: purchaseOrder.contactName ?? "",
    contactPhone: purchaseOrder.contactPhone ?? "",
    contactMobile: purchaseOrder.contactMobile ?? "",
    acceptanceCondition: purchaseOrder.acceptanceCondition ?? "",
    note: purchaseOrder.note ?? "",
    status: purchaseOrder.status,
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
            แก้ไข Purchase Order
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            แก้ไขข้อมูล PO และรายการสินค้า
          </p>
        </div>

        <PurchaseOrderForm
          customers={customers}
          initialData={initialData}
        />
      </div>
    </main>
  );
}