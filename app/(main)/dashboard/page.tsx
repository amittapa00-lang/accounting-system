import Link from "next/link";

import { Prisma } from "@/generated/prisma/client";
import { requirePageSession } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { OPEN_INVOICE_STATUSES } from "@/lib/labels";
import { subtractMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const instant = false;

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

function roleLabel(role: string | undefined) {
  switch (role) {
    case "ADMIN":
      return "ผู้ดูแลระบบ";
    case "USER":
    case undefined:
      return "ผู้ใช้งาน";
    default:
      return role;
  }
}

async function getSummary() {
  const openInvoice = { status: { in: OPEN_INVOICE_STATUSES } };

  // One REPEATABLE READ snapshot, so a payment recorded between the two sums
  // (which can move an invoice from PARTIAL to PAID) cannot skew the outstanding amount.
  const [customerCount, purchaseOrderCount, invoiceCount, openTotals, openPayments] =
    await prisma.$transaction(
      [
        prisma.customer.count(),
        prisma.purchaseOrder.count({ where: { status: { not: "CANCELLED" } } }),
        prisma.invoice.count({ where: { status: { not: "CANCELLED" } } }),
        prisma.invoice.aggregate({ where: openInvoice, _sum: { grandTotal: true } }),
        prisma.payment.aggregate({ where: { invoice: openInvoice }, _sum: { amount: true } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );

  // Outstanding = invoiced on open invoices (ISSUED, PARTIAL) - received on those invoices
  const outstanding = subtractMoney(openTotals._sum.grandTotal, openPayments._sum.amount);

  return { customerCount, purchaseOrderCount, invoiceCount, outstanding };
}

export default async function DashboardPage() {
  const session = await requirePageSession();

  const summary = await getSummary();

  const summaries = [
    {
      title: "ลูกค้า",
      value: summary.customerCount.toLocaleString("th-TH"),
      note: "ทั้งหมดในระบบ",
    },
    {
      title: "Purchase Order",
      value: summary.purchaseOrderCount.toLocaleString("th-TH"),
      note: "ไม่รวมที่ยกเลิก",
    },
    {
      title: "Invoice",
      value: summary.invoiceCount.toLocaleString("th-TH"),
      note: "ไม่รวมที่ยกเลิก",
    },
    {
      title: "ยอดค้างชำระ",
      value: `฿${formatMoney(summary.outstanding)}`,
      note: "Invoice ที่ออกแล้วและยังชำระไม่ครบ",
    },
  ];

  const userName = session.user.name ?? session.user.username ?? "ผู้ใช้งาน";

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h2 className="text-xl font-semibold text-gray-900">
        Dashboard
      </h2>

      <p className="mt-2 text-gray-600">
        สวัสดี {userName}{" "}
        <span className="text-sm text-gray-500">
          ({roleLabel(session.user.role)})
        </span>{" "}
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
        {summaries.map((item) => (
          <div
            key={item.title}
            className="rounded-xl bg-white p-6 shadow-sm"
          >
            <p className="text-sm text-gray-500">
              {item.title}
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {item.value}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              {item.note}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
