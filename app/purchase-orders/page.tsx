import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import authOptions from "../../auth";
import { prisma } from "../../lib/prisma";
import PurchaseOrderList from "./PurchaseOrderList";

export default async function PurchaseOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

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
          id: true,
          amount: true,
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
    items: po.items.map((item) => ({
      id: item.id,
      amount: Number(item.amount),
    })),
  }));

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <PurchaseOrderList purchaseOrders={formattedPurchaseOrders} />
      </div>
    </main>
  );
}