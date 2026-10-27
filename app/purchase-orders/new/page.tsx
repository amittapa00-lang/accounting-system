import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import authOptions from "@/auth";
import { prisma } from "@/lib/prisma";

import PurchaseOrderForm from "../PurchaseOrderForm";

export const instant = false;

export default async function NewPurchaseOrderPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
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

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">
            เพิ่ม Purchase Order
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            สร้างใบสั่งซื้อใหม่
          </p>
        </div>

        <PurchaseOrderForm customers={customers} />
      </div>
    </main>
  );
}