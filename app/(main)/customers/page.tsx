import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import CustomerForm from "@/components/customers/CustomerForm";
import CustomerList from "@/components/customers/CustomerList";

export const instant = false;

export default async function CustomersPage() {
  await requirePageSession();

  const customers = await prisma.customer.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      tel: true,
      taxId: true,
      contactName: true,
      isActive: true,
    },
  });

  return (
    <main>
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">ลูกค้า</h1>

          <p className="text-sm text-gray-500">Customer Master</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <CustomerForm />
          </div>

          <div className="lg:col-span-2">
            <CustomerList customers={customers} />
          </div>
        </div>
      </div>
    </main>
  );
}
