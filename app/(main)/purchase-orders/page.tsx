import { requirePageSession } from "@/lib/auth";
import { calcTotals } from "@/lib/money";
import { prisma } from "@/lib/prisma";

import PurchaseOrderList from "@/components/purchase-orders/PurchaseOrderList";

export const instant = false;

export default async function PurchaseOrdersPage() {
  await requirePageSession();

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      customer: {
        select: {
          code: true,
          name: true,
        },
      },
      items: {
        select: {
          amount: true,
          vat: true,
        },
      },
    },
  });

  const formattedPurchaseOrders = purchaseOrders.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    poDate: po.poDate.toISOString(),
    status: po.status,
    customer: {
      code: po.customer.code,
      name: po.customer.name,
    },
    itemCount: po.items.length,
    // Same total as the PO detail page: subtotal + VAT
    grandTotal: calcTotals(po.items).grandTotal,
  }));

  return (
    <main className="p-6">
      <div className="mx-auto max-w-7xl">
        <PurchaseOrderList purchaseOrders={formattedPurchaseOrders} />
      </div>
    </main>
  );
}
