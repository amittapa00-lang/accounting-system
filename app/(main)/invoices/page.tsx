import Link from "next/link";
import { ClipboardList, Eye, FilePen, FileSpreadsheet, FileText, Wallet } from "lucide-react";

import { Badge, InvoiceStatusBadge } from "@/components/ui/badge";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { StatCard } from "@/components/ui/data-display";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requirePageSession } from "@/lib/auth";
import { formatDate, formatMoney, yearMonthInThailand } from "@/lib/format";
import { isBilledInvoiceStatus, isInvoiceOverdue } from "@/lib/invoices";
import { documentTypeLabel } from "@/lib/labels";
import { sumMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const instant = false;

type PageProps = {
  searchParams: Promise<{
    /** "2026" (C.E.) or "all"; empty = the current year in Thai time */
    year?: string | string[];
  }>;
};

const ALL_YEARS = "all";

/** Years (C.E., Thai time) that have at least one invoice, newest first. */
async function invoiceYears(): Promise<number[]> {
  // invoiceDate is a timestamp without time zone holding UTC: convert to Thai time before taking the year
  const rows = await prisma.$queryRaw<{ year: number }[]>`
    SELECT DISTINCT EXTRACT(YEAR FROM ("invoiceDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::int AS year
    FROM "Invoice"
    ORDER BY year DESC
  `;
  return rows.map((row) => Number(row.year));
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  await requirePageSession();

  const params = await searchParams;
  const yearParam = Array.isArray(params.year) ? params.year[0] : params.year;

  const currentYear = yearMonthInThailand(new Date()).year;

  // null = all years. Anything that is not a plausible C.E. year falls back to the current year.
  const requestedYear = Number(yearParam);
  const selectedYear: number | null =
    yearParam === ALL_YEARS
      ? null
      : Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2999
        ? requestedYear
        : currentYear;

  const [invoices, yearsWithInvoices] = await Promise.all([
    prisma.invoice.findMany({
      // Invoice dates are stored as UTC midnight of the chosen day
      where:
        selectedYear === null
          ? undefined
          : {
              invoiceDate: {
                gte: new Date(Date.UTC(selectedYear, 0, 1)),
                lt: new Date(Date.UTC(selectedYear + 1, 0, 1)),
              },
            },
      orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }, { subNumber: "asc" }],
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
    }),
    invoiceYears(),
  ]);

  // The current and the selected year are always offered, even without invoices yet
  const yearOptions = [...new Set([currentYear, ...(selectedYear ? [selectedYear] : []), ...yearsWithInvoices])].sort(
    (a, b) => b - a
  );

  const periodLabel = selectedYear === null ? "ทุกปี" : `ปี ${selectedYear}`;

  // Only invoices that were actually billed (not drafts, not cancelled)
  const billedTotal = sumMoney(
    invoices.filter((invoice) => isBilledInvoiceStatus(invoice.status)).map((invoice) => invoice.grandTotal)
  );

  const draftCount = invoices.filter((invoice) => invoice.status === "DRAFT").length;

  const yearFilter = (
    <nav aria-label="กรองตามปี" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm text-slate-500">ปี (ค.ศ.)</span>
      {[
        { value: ALL_YEARS, label: "ทั้งหมด", active: selectedYear === null, title: undefined },
        ...yearOptions.map((year) => ({
          value: String(year),
          label: String(year),
          active: selectedYear === year,
          title: `พ.ศ. ${year + 543}`,
        })),
      ].map((option) => (
        <Link
          key={option.value}
          // The current year is the default, so it gets the clean URL
          href={option.value === String(currentYear) ? "/invoices" : `/invoices?year=${option.value}`}
          title={option.title}
          aria-current={option.active ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium tabular-nums transition-colors",
            option.active
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      <PageHeader title="Invoice" description="รายการใบแจ้งหนี้และเอกสารการขาย" actions={yearFilter} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="จำนวน Invoice"
          value={invoices.length.toLocaleString("en-US")}
          hint={`${periodLabel} · รวมทุกสถานะ`}
          icon={FileText}
          tone="info"
        />
        <StatCard
          label="ยอดรวม Invoice ที่ออกแล้ว"
          value={`฿${formatMoney(billedTotal)}`}
          hint={`${periodLabel} · ไม่รวมฉบับร่างและที่ยกเลิก`}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Invoice ฉบับร่าง"
          value={draftCount.toLocaleString("en-US")}
          hint={`${periodLabel} · ยังไม่ได้ออก Invoice`}
          icon={FilePen}
          tone="warning"
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title={selectedYear === null ? "Invoice ทั้งหมด" : `Invoice ปี ${selectedYear}`}
          description={`${invoices.length.toLocaleString("en-US")} รายการ เรียงตามวันที่ ล่าสุดก่อน`}
        />

        {invoices.length === 0 ? (
          selectedYear !== null && yearsWithInvoices.length > 0 ? (
            <EmptyState
              icon={FileText}
              title={`ไม่มี Invoice ในปี ${selectedYear}`}
              description="เลือกปีอื่นด้านบน หรือดู Invoice ทุกปี"
              action={
                <ButtonLink href={`/invoices?year=${ALL_YEARS}`} variant="outline" size="sm">
                  ดู Invoice ทุกปี
                </ButtonLink>
              }
            />
          ) : (
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
          )
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
                      {(invoice.saleOrderNumber || invoice.subNumber > 1) && (
                        <p className="whitespace-nowrap text-xs text-slate-600">
                          {invoice.saleOrderNumber}
                          {invoice.subNumber > 1 && (
                            <span className="text-brand-700">
                              {invoice.saleOrderNumber && " · "}ใบย่อยที่ {invoice.subNumber}
                            </span>
                          )}
                        </p>
                      )}
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
