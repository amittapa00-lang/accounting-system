import { notFound } from "next/navigation";
import Link from "next/link";

import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import CustomerForm from "@/components/customers/CustomerForm";

export const instant = false;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailPage({ params }: PageProps) {
  await requirePageSession();

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
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
      email: true,
      note: true,
      isActive: true,
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <main>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">แก้ไขข้อมูลลูกค้า</h1>

            <p className="text-sm text-gray-500">Customer Master</p>
          </div>

          <Link
            href="/customers"
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ← กลับรายชื่อลูกค้า
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <CustomerForm customer={customer} />
      </div>
    </main>
  );
}
