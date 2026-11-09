import Link from "next/link";
import { FileText, Receipt, Wallet } from "lucide-react";

import { Badge, InvoiceStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/data-display";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requirePageSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/labels";
import { sumMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function PaymentsPage() {
  await requirePageSession();

  const payments = await prisma.payment.findMany({
    // createdAt breaks ties so payments on the same day keep a stable order
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          saleOrderNumber: true,
          customerNameSnapshot: true,
          status: true,
        },
      },
    },
  });

  const totalPayment = sumMoney(payments.map((payment) => payment.amount));

  const invoiceCount = new Set(payments.map((payment) => payment.invoice.id)).size;

  return (
    <>
      <PageHeader
        title="รับชำระเงิน"
        description="รายการรับชำระเงินทั้งหมด บันทึกการรับเงินได้จากหน้า Invoice"
        actions={
          <ButtonLink href="/invoices" variant="outline">
            <FileText /> ไปหน้า Invoice
          </ButtonLink>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="ยอดรับชำระรวม"
          value={<span className="text-emerald-700">฿{formatMoney(totalPayment)}</span>}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="จำนวนรายการรับเงิน"
          value={
            <>
              {payments.length.toLocaleString("th-TH")}{" "}
              <span className="text-base font-normal text-slate-500">รายการ</span>
            </>
          }
          icon={Receipt}
          tone="info"
        />
        <StatCard
          label="Invoice ที่มีการรับเงิน"
          value={
            <>
              {invoiceCount.toLocaleString("th-TH")}{" "}
              <span className="text-base font-normal text-slate-500">ใบ</span>
            </>
          }
          icon={FileText}
          tone="neutral"
        />
      </div>

      {/* Payment Table */}
      <Card className="mt-6">
        <CardHeader title="รายการรับชำระเงิน" description="เรียงตามวันที่รับเงิน ล่าสุดก่อน" />

        {payments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="ยังไม่มีรายการรับชำระเงิน"
            description="เปิด Invoice ที่ออกแล้ว แล้วกด “รับชำระเงิน” เพื่อบันทึกการรับเงินรายการแรก"
            action={
              <ButtonLink href="/invoices" variant="outline" size="sm">
                <FileText /> ไปหน้า Invoice
              </ButtonLink>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>วันที่</Th>
                <Th>Invoice No.</Th>
                <Th>ลูกค้า</Th>
                <Th>วิธีชำระ</Th>
                <Th>เลขที่อ้างอิง</Th>
                <Th>สถานะ Invoice</Th>
                <Th align="right">จำนวนเงิน (บาท)</Th>
              </tr>
            </thead>

            <tbody>
              {payments.map((payment) => (
                <Tr key={payment.id}>
                  <Td className="whitespace-nowrap">{formatDate(payment.paymentDate)}</Td>

                  <Td className="whitespace-nowrap">
                    <Link
                      href={`/invoices/${payment.invoice.id}`}
                      className="font-medium text-slate-900 underline-offset-4 hover:text-brand-700 hover:underline"
                    >
                      {payment.invoice.invoiceNumber}
                    </Link>
                    {payment.invoice.saleOrderNumber && (
                      <p className="text-xs text-slate-500">{payment.invoice.saleOrderNumber}</p>
                    )}
                  </Td>

                  <Td className="min-w-40">{payment.invoice.customerNameSnapshot}</Td>

                  <Td>
                    <Badge>{paymentMethodLabel(payment.paymentMethod)}</Badge>
                  </Td>

                  <Td className="text-slate-500">{payment.referenceNumber || "-"}</Td>

                  <Td>
                    <InvoiceStatusBadge status={payment.invoice.status} />
                  </Td>

                  <Td align="right" className="whitespace-nowrap font-semibold tabular-nums text-emerald-700">
                    {formatMoney(payment.amount)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
