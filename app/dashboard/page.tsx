import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import authOptions from "@/auth";
import LogoutButton from "@/components/LogoutButton";

export const instant = false;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const menus = [
    {
      category: "จัดการข้อมูล",
      title: "ลูกค้า",
      description: "เพิ่ม แก้ไข และค้นหาข้อมูลลูกค้า",
      href: "/customers",
    },
    {
      category: "เอกสาร",
      title: "Purchase Order",
      description: "จัดการ PO และรายการสินค้า",
      href: "/purchase-orders",
    },
    {
      category: "เอกสาร",
      title: "Invoice",
      description: "สร้างและติดตาม Invoice",
      href: "/invoices",
    },
    {
      category: "การเงิน",
      title: "การรับชำระเงิน",
      description: "บันทึกและติดตามยอดชำระ",
      href: "/payments",
    },
  ];

  const summaries = [
    { title: "ลูกค้า", value: "0" },
    { title: "Purchase Order", value: "0" },
    { title: "Invoice", value: "0" },
    { title: "ยอดค้างชำระ", value: "฿0.00" },
  ];

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Accounting System
            </h1>

            <p className="text-sm text-gray-500">
              ระบบจัดการบัญชีและลูกหนี้
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold text-gray-800">
                {session.user?.name ?? "ผู้ใช้งาน"}
              </p>

              <p className="text-sm text-gray-500">
                {"role" in (session.user ?? {})
                  ? String(session.user?.role ?? "")
                  : "ผู้ใช้งาน"}
              </p>
            </div>

            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Dashboard
        </h2>

        <p className="mt-2 text-gray-600">
          ยินดีต้อนรับเข้าสู่ระบบจัดการบัญชี
        </p>

        {/* Menu */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {menus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="rounded-xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-sm text-gray-500">
                {menu.category}
              </p>

              <h3 className="mt-2 text-xl font-bold text-gray-900">
                {menu.title}
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                {menu.description}
              </p>

              <p className="mt-4 text-sm font-semibold text-blue-600">
                เข้าสู่เมนู →
              </p>
            </Link>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {summaries.map((summary) => (
            <div
              key={summary.title}
              className="rounded-xl bg-white p-6 shadow-sm"
            >
              <p className="text-sm text-gray-500">
                {summary.title}
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {summary.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
