import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import PurchaseOrderForm from "@/components/purchase-orders/PurchaseOrderForm";

export const instant = false;

export default async function NewPurchaseOrderPage() {
  await requirePageSession();

  // A new PO can only be created for an active customer
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
      contactName: true,
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main className="p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">เพิ่ม Purchase Order</h1>

          <p className="mt-1 text-sm text-slate-500">สร้างใบสั่งซื้อใหม่</p>
        </div>

        <PurchaseOrderForm customers={customers} />
      </div>
    </main>
  );
}
