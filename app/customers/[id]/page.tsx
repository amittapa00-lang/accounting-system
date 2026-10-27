
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import authOptions from "../../../auth";
import { prisma } from "../../../lib/prisma";

import CustomerEditForm from "./CustomerEditForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailPage({
  params,
}: PageProps) {
  // ตรวจสอบการเข้าสู่ระบบ
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // รับ ID จาก URL
  const { id } = await params;

  // ค้นหาข้อมูลลูกค้าจากฐานข้อมูล
  const customer = await prisma.customer.findUnique({
    where: {
      id,
    },
  });

  // หากไม่พบข้อมูลลูกค้า ให้แสดงหน้า 404
  if (!customer) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              แก้ไขข้อมูลลูกค้า
            </h1>

            <p className="text-sm text-gray-500">
              Customer Master
            </p>
          </div>

          <Link
            href="/customers"
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ← กลับรายชื่อลูกค้า
          </Link>
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        <CustomerEditForm customer={customer} />
      </div>
    </main>
  );
}
