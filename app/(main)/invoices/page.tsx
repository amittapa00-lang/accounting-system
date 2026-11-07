import Link from "next/link";
import { ClipboardList, Eye, FilePen, FileSpreadsheet, FileText, Wallet } from "lucide-react";

import { Badge, InvoiceStatusBadge } from "@/components/ui/badge";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/data-display";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requirePageSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { isBilledInvoiceStatus, isInvoiceOverdue } from "@/lib/invoices";
import { documentTypeLabel } from "@/lib/labels";
import { sumMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function InvoicesPage() {
  await requirePageSession();

  const invoices = await prisma.invoice.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
        },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  // Only invoices that were actually billed (not drafts, not cancelled)
  const billedTotal = sumMoney(
    invoices.filter((invoice) => isBilledInvoiceStatus(invoice.status)).map((invoice) => invoice.grandTotal)
  );

  const draftCount = invoices.filter((invoice) => invoice.status === "DRAFT").length;

  return (
    <>
      <PageHeader title="Invoice" description="รายการใบแจ้งหนี้และเอกสารการขาย" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="จำนวน Invoice"
          value={invoices.length.toLocaleString("en-US")}
          hint="รวมทุกสถานะ"
          icon={FileText}
          tone="info"
        />
        <StatCard
          label="ยอดรวม Invoice ที่ออกแล้ว"
          value={`฿${formatMoney(billedTotal)}`}
          hint="ไม่รวมฉบับร่างและที่ยกเลิก"
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Invoice ฉบับร่าง"
          value={draftCount.toLocaleString("en-US")}
          hint="ยังไม่ได้ออก Invoice"
          icon={FilePen}
          tone="warning"
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="Invoice ทั้งหมด" description={`${invoices.length.toLocaleString("en-US")} รายการ ล่าสุดก่อน`} />

        {invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="ยังไม่มี Invoice"
            description="สร้าง Invoice ได้จากหน้า Purchase Order โดยกด “สร้าง Invoice จาก PO”"
            action={
              <ButtonLink href="/purchase-orders" variant="outline" size="sm">
                <ClipboardList /> ไปที่ Purchase Order
              </ButtonLink>
            }
          />
        ) : (
          // Slightly tighter cells than the default so all columns fit next to the sidebar at 1280px
          <Table className="[&_td]:px-3 [&_th]:px-3">
            <thead>
              <tr>
                <Th>Invoice No.</Th>
                <Th>ลูกค้า</Th>
                <Th>วันที่</Th>
                <Th align="right">จำนวนเงิน</Th>
                <Th>สถานะ</Th>
                <Th>จัดการ</Th>
              </tr>
            </thead>

            <tbody>
              {invoices.map((invoice) => {
                const itemCount = invoice._count.items;
                const isCancelled = invoice.status === "CANCELLED";

                return (
                  <Tr key={invoice.id}>
                    <Td>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="whitespace-nowrap font-medium text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                      <p className="max-w-44 text-xs text-slate-500">
                        {documentTypeLabel(invoice.documentType)}{" "}
                        <span className="whitespace-nowrap">· {itemCount} รายการ</span>
                      </p>
                    </Td>

                    <Td className="min-w-40">
                      <p className="font-medium text-slate-900">{invoice.customerNameSnapshot}</p>
                      <Link
                        href={`/purchase-orders/${invoice.purchaseOrder.id}`}
                        className="text-xs text-slate-500 hover:text-brand-700 hover:underline"
                      >
                        PO {invoice.purchaseOrder.poNumber}
                      </Link>
                    </Td>

                    <Td className="whitespace-nowrap tabular-nums">
                      {formatDate(invoice.invoiceDate)}
                      {invoice.dueDate && (
                        <p className="text-xs text-slate-500">ครบ {formatDate(invoice.dueDate)}</p>
                      )}
                    </Td>

                    <Td align="right" className="whitespace-nowrap">
                      <span className="font-semibold tabular-nums text-slate-900">{formatMoney(invoice.grandTotal)}</span>
                      <p className="text-xs tabular-nums text-slate-500">VAT {formatMoney(invoice.vat)}</p>
                    </Td>

                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <InvoiceStatusBadge status={invoice.status} />
                        {isInvoiceOverdue(invoice.status, invoice.dueDate) && <Badge tone="danger">เกินกำหนด</Badge>}
                      </div>
                    </Td>

                    <Td>
                      <div className="flex gap-1.5">
                        <ButtonLink href={`/invoices/${invoice.id}`} variant="ghost" size="sm" title="ดูรายละเอียด">
                          <Eye /> ดู
                        </ButtonLink>

                        {/* Invoice ที่ยกเลิกแล้วดาวน์โหลดไม่ได้ (route ตอบ 409) */}
                        {!isCancelled && (
                          <ButtonAnchor
                            href={`/api/invoices/${invoice.id}/pdf`}
                            target="_blank"
                            rel="noopener"
                            variant="outline"
                            size="sm"
                            title="เปิด PDF"
                          >
                            <FileText /> PDF
                          </ButtonAnchor>
                        )}

                        {!isCancelled && (
                          <ButtonAnchor
                            href={`/api/invoices/${invoice.id}/excel`}
                            variant="outline"
                            size="sm"
                            title="ดาวน์โหลด Excel"
                          >
                            <FileSpreadsheet /> Excel
                          </ButtonAnchor>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
