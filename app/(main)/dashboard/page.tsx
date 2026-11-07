import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  PlusCircle,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { Prisma } from "@/generated/prisma/client";
import { Badge, InvoiceStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/data-display";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requirePageSession } from "@/lib/auth";
import { formatDate, formatMoney, toDateInputValue, todayInputValue } from "@/lib/format";
import { OPEN_INVOICE_STATUSES, paymentMethodLabel, roleLabel } from "@/lib/labels";
import { paymentSummary, subtractMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const instant = false;

const OUTSTANDING_LIMIT = 8;
const RECENT_PAYMENTS_LIMIT = 5;

async function getSummary() {
  const openInvoice = { status: { in: OPEN_INVOICE_STATUSES } };

  // One REPEATABLE READ snapshot, so a payment recorded between the two sums
  // (which can move an invoice from PARTIAL to PAID) cannot skew the outstanding amount.
  const [customerCount, purchaseOrderCount, invoiceCount, openTotals, openPayments, openInvoiceCount] =
    await prisma.$transaction(
      [
        prisma.customer.count({ where: { isActive: true } }),
        prisma.purchaseOrder.count({ where: { status: { not: "CANCELLED" } } }),
        prisma.invoice.count({ where: { status: { not: "CANCELLED" } } }),
        prisma.invoice.aggregate({ where: openInvoice, _sum: { grandTotal: true } }),
        prisma.payment.aggregate({ where: { invoice: openInvoice }, _sum: { amount: true } }),
        prisma.invoice.count({ where: openInvoice }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );

  // Outstanding = invoiced on open invoices (ISSUED, PARTIAL) - received on those invoices
  const outstanding = subtractMoney(openTotals._sum.grandTotal, openPayments._sum.amount);

  return { customerCount, purchaseOrderCount, invoiceCount, outstanding, openInvoiceCount };
}

async function getOutstandingInvoices() {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: OPEN_INVOICE_STATUSES } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { invoiceDate: "asc" }],
    take: OUTSTANDING_LIMIT,
    select: {
      id: true,
      invoiceNumber: true,
      customerNameSnapshot: true,
      dueDate: true,
      status: true,
      grandTotal: true,
      payments: { select: { amount: true } },
    },
  });

  return invoices.map((invoice) => ({
    ...invoice,
    remaining: paymentSummary(
      invoice.grandTotal,
      invoice.payments.map((p) => p.amount)
    ).remaining,
  }));
}

function getRecentPayments() {
  return prisma.payment.findMany({
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    take: RECENT_PAYMENTS_LIMIT,
    select: {
      id: true,
      paymentDate: true,
      amount: true,
      paymentMethod: true,
      invoice: { select: { id: true, invoiceNumber: true, customerNameSnapshot: true } },
    },
  });
}

const QUICK_ACTIONS = [
  { href: "/purchase-orders/new", label: "สร้าง Purchase Order", description: "เริ่มงานขายใหม่", icon: PlusCircle },
  { href: "/customers", label: "เพิ่มลูกค้า", description: "ลงทะเบียนลูกค้าใหม่", icon: UserPlus },
  { href: "/invoices", label: "ดู Invoice ทั้งหมด", description: "ออก / พิมพ์ / ติดตาม", icon: FileText },
  { href: "/payments", label: "ประวัติรับชำระเงิน", description: "ตรวจสอบยอดที่ได้รับ", icon: Receipt },
];

export default async function DashboardPage() {
  const session = await requirePageSession();
  const [summary, outstandingInvoices, recentPayments] = await Promise.all([
    getSummary(),
    getOutstandingInvoices(),
    getRecentPayments(),
  ]);

  const userName = session.user.name ?? session.user.username ?? "ผู้ใช้งาน";
  const today = todayInputValue();

  return (
    <>
      <PageHeader
        title={`สวัสดี, ${userName}`}
        description={`${roleLabel(session.user.role)} · ภาพรวมวันที่ ${formatDate(new Date())}`}
        actions={
          <ButtonLink href="/purchase-orders/new" variant="brand">
            <PlusCircle /> สร้าง PO ใหม่
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="ยอดค้างรับ"
          value={`฿${formatMoney(summary.outstanding)}`}
          hint={`${summary.openInvoiceCount.toLocaleString("th-TH")} Invoice ที่ยังชำระไม่ครบ`}
          icon={Wallet}
          tone="brand"
          href="/invoices"
        />
        <StatCard
          label="Invoice"
          value={summary.invoiceCount.toLocaleString("th-TH")}
          hint="ไม่รวมที่ยกเลิก"
          icon={FileText}
          tone="info"
          href="/invoices"
        />
        <StatCard
          label="Purchase Order"
          value={summary.purchaseOrderCount.toLocaleString("th-TH")}
          hint="ไม่รวมที่ยกเลิก"
          icon={ClipboardList}
          tone="warning"
          href="/purchase-orders"
        />
        <StatCard
          label="ลูกค้า"
          value={summary.customerCount.toLocaleString("th-TH")}
          hint="ที่ใช้งานอยู่"
          icon={Users}
          tone="success"
          href="/customers"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Invoice ค้างชำระ"
            description="เรียงตามวันครบกำหนด เก่าสุดก่อน"
            actions={
              <ButtonLink href="/invoices" variant="ghost" size="sm">
                ดูทั้งหมด <ArrowRight />
              </ButtonLink>
            }
          />

          {outstandingInvoices.length === 0 ? (
            <EmptyState icon={Wallet} title="ไม่มียอดค้างชำระ" description="Invoice ที่ออกแล้วได้รับชำระครบทุกใบ" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>ครบกำหนด</Th>
                  <Th>สถานะ</Th>
                  <Th align="right">คงเหลือ</Th>
                </tr>
              </thead>
              <tbody>
                {outstandingInvoices.map((invoice) => {
                  const overdue = invoice.dueDate !== null && toDateInputValue(invoice.dueDate) < today;
                  return (
                    <Tr key={invoice.id}>
                      <Td>
                        <Link href={`/invoices/${invoice.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                          {invoice.invoiceNumber}
                        </Link>
                        <p className="max-w-xs truncate text-xs text-slate-500">{invoice.customerNameSnapshot}</p>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {formatDate(invoice.dueDate)}
                        {overdue && (
                          <Badge tone="danger" className="ml-2">
                            เกินกำหนด
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        <InvoiceStatusBadge status={invoice.status} />
                      </Td>
                      <Td align="right" className="font-medium tabular-nums text-slate-900">
                        {formatMoney(invoice.remaining)}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="ทางลัด" />
            <ul className="divide-y divide-slate-100">
              {QUICK_ACTIONS.map(({ href, label, description, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600">
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{label}</span>
                      <span className="block text-xs text-slate-500">{description}</span>
                    </span>
                    <ArrowRight className="size-4 text-slate-300 group-hover:text-slate-500" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="รับชำระล่าสุด"
              actions={
                <ButtonLink href="/payments" variant="ghost" size="sm">
                  ทั้งหมด <ArrowRight />
                </ButtonLink>
              }
            />
            {recentPayments.length === 0 ? (
              <EmptyState icon={Receipt} title="ยังไม่มีการรับชำระเงิน" className="py-8" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentPayments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${payment.invoice.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-brand-700"
                      >
                        {payment.invoice.invoiceNumber}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {formatDate(payment.paymentDate)} · {paymentMethodLabel(payment.paymentMethod)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                      +{formatMoney(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
