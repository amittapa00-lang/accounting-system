import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import authOptions from "@/auth";
import { prisma } from "@/lib/prisma";

import CustomerForm from "./CustomerForm";
import CustomerList from "./CustomerList";

export const instant = false;

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

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
    <main className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              ลูกค้า
            </h1>

            <p className="text-sm text-gray-500">
              Customer Master
            </p>
          </div>

          <a
            href="/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ← กลับ Dashboard
          </a>
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
