import Link from "next/link";
import {
  CircleCheck,
  CircleX,
  ClipboardList,
  Eye,
  FilePen,
  FileSpreadsheet,
  FileText,
  SearchX,
  Send,
  type LucideIcon,
} from "lucide-react";

import DeleteInvoiceButton from "@/components/invoices/DeleteInvoiceButton";
import InvoiceSearch from "@/components/invoices/InvoiceSearch";
import InvoiceStatusSelect from "@/components/invoices/InvoiceStatusSelect";
import { Badge } from "@/components/ui/badge";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requirePageSession } from "@/lib/auth";
import { formatDate, formatMoney, yearMonthInThailand } from "@/lib/format";
import { isBilledInvoiceStatus, isInvoiceOverdue } from "@/lib/invoices";
import { documentTypeLabel, type Tone } from "@/lib/labels";
import { paymentSummary, sumMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const instant = false;

type PageProps = {
  searchParams: Promise<{
    /** "2026" (C.E.) or "all"; empty = the current year in Thai time */
    year?: string | string[];
    /** one of STATUS_FILTERS (draft / billed / paid / cancelled); empty = every status */
    status?: string | string[];
    /** search text: invoice no., Sale Order No., customer, PO no. */
    q?: string | string[];
  }>;
};

const ALL_YEARS = "all";
const MAX_SEARCH_LENGTH = 100;

/**
 * Status summary of the list, the same four steps as the status menu (lib/invoices.ts
 * INVOICE_STATUS_CHOICES). รับเงินบางส่วน (PARTIAL) counts as วางบิลแล้ว: billed, money still owed.
 */
const STATUS_FILTERS = [
  { value: "draft", label: "ยังไม่วางบิล", statuses: ["DRAFT"], icon: FilePen, tone: "neutral" },
  { value: "billed", label: "วางบิลแล้ว", statuses: ["ISSUED", "PARTIAL"], icon: Send, tone: "info" },
  { value: "paid", label: "รับเงินแล้ว", statuses: ["PAID"], icon: CircleCheck, tone: "success" },
  { value: "cancelled", label: "ยกเลิก", statuses: ["CANCELLED"], icon: CircleX, tone: "danger" },
] as const satisfies readonly { value: string; label: string; statuses: readonly string[]; icon: LucideIcon; tone: Tone }[];

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

const TILE_TONES: Record<Tone, { icon: string; active: string }> = {
  neutral: { icon: "bg-slate-100 text-slate-600", active: "border-slate-500 ring-slate-200" },
  info: { icon: "bg-blue-50 text-blue-600", active: "border-blue-500 ring-blue-100" },
  warning: { icon: "bg-amber-50 text-amber-600", active: "border-amber-500 ring-amber-100" },
  success: { icon: "bg-emerald-50 text-emerald-600", active: "border-emerald-500 ring-emerald-100" },
  danger: { icon: "bg-red-50 text-red-600", active: "border-red-500 ring-red-100" },
  brand: { icon: "bg-brand-50 text-brand-600", active: "border-brand-500 ring-brand-100" },
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
  const yearParam = firstParam(params.year);
  const statusParam = firstParam(params.status);
  const search = (firstParam(params.q) ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const statusFilter = STATUS_FILTERS.find((filter) => filter.value === statusParam) ?? null;

  const currentYear = yearMonthInThailand(new Date()).year;

  // null = all years. Anything that is not a plausible C.E. year falls back to the current year.
  const requestedYear = Number(yearParam);
  const selectedYear: number | null =
    yearParam === ALL_YEARS
      ? null
      : Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2999
        ? requestedYear
        : currentYear;

  const contains = { contains: search, mode: "insensitive" as const };

  // Year and search here; the status filter is applied below, so the summary counts every status
  const [yearInvoices, yearsWithInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        // Invoice dates are stored as UTC midnight of the chosen day
        ...(selectedYear === null
          ? {}
          : {
              invoiceDate: {
                gte: new Date(Date.UTC(selectedYear, 0, 1)),
                lt: new Date(Date.UTC(selectedYear + 1, 0, 1)),
              },
            }),
        ...(search
          ? {
              OR: [
                { invoiceNumber: contains },
                { saleOrderNumber: contains },
                { customerNameSnapshot: contains },
                { customerCodeSnapshot: contains },
                { purchaseOrder: { poNumber: contains } },
              ],
            }
          : {}),
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
        // for the status menu and delete confirmations (what happens to the money)
        payments: {
          select: { amount: true },
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
    yearInvoices.filter((invoice) => isBilledInvoiceStatus(invoice.status)).map((invoice) => invoice.grandTotal)
  );

  const statusSummary = STATUS_FILTERS.map((filter) => {
    const matching = yearInvoices.filter((invoice) => (filter.statuses as readonly string[]).includes(invoice.status));
    return {
      ...filter,
      count: matching.length,
      total: sumMoney(matching.map((invoice) => invoice.grandTotal)),
      partialCount: matching.filter((invoice) => invoice.status === "PARTIAL").length,
    };
  });

  const invoices = statusFilter
    ? yearInvoices.filter((invoice) => (statusFilter.statuses as readonly string[]).includes(invoice.status))
    : yearInvoices;

  /** /invoices with the current filters, changed by `change` (null = remove) */
  function listHref(change: { year?: string | null; status?: StatusFilter | null; q?: string | null }) {
    const next = {
      year: selectedYear === null ? ALL_YEARS : String(selectedYear),
      status: statusFilter?.value ?? null,
      q: search || null,
      ...change,
    };
    const query = new URLSearchParams();
    // The current year is the default, so it is left out of the URL
    if (next.year && next.year !== String(currentYear)) query.set("year", next.year);
    if (next.status) query.set("status", next.status);
    if (next.q) query.set("q", next.q);
    const text = query.toString();
    return text ? `/invoices?${text}` : "/invoices";
  }

  // Filters kept by the search box when the search text changes
  const searchKeep: Record<string, string> = {};
  if (selectedYear !== currentYear) searchKeep.year = selectedYear === null ? ALL_YEARS : String(selectedYear);
  if (statusFilter) searchKeep.status = statusFilter.value;

  const filtering = Boolean(search || statusFilter);

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
          href={listHref({ year: option.value })}
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

      {/* Status summary: each tile filters the list, click again (or ทั้งหมด) to show every status */}
      <nav aria-label="สรุปสถานะ Invoice" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatusTile
          href={listHref({ status: null })}
          active={statusFilter === null}
          label="ทั้งหมด"
          count={yearInvoices.length}
          hint={`ออกแล้ว ฿${formatMoney(billedTotal)}`}
          hintTitle="ยอดรวม Invoice ที่วางบิลและรับเงินแล้ว ไม่รวมที่ยังไม่วางบิลและที่ยกเลิก"
          icon={FileText}
          tone="brand"
        />
        {statusSummary.map((summary) => (
          <StatusTile
            key={summary.value}
            href={listHref({ status: statusFilter?.value === summary.value ? null : summary.value })}
            active={statusFilter?.value === summary.value}
            label={summary.label}
            count={summary.count}
            hint={`฿${formatMoney(summary.total)}`}
            note={summary.partialCount > 0 ? `รวมรับเงินบางส่วน ${summary.partialCount} ใบ` : undefined}
            icon={summary.icon}
            tone={summary.tone}
          />
        ))}
      </nav>

      <Card className="mt-6">
        <CardHeader
          title={
            <>
              {selectedYear === null ? "Invoice ทั้งหมด" : `Invoice ปี ${selectedYear}`}
              {statusFilter && <span className="font-normal text-slate-500"> · {statusFilter.label}</span>}
            </>
          }
          description={
            filtering
              ? `พบ ${invoices.length.toLocaleString("en-US")} รายการ${search ? ` ที่ตรงกับ “${search}”` : ""} เรียงตามวันที่ ล่าสุดก่อน`
              : `${invoices.length.toLocaleString("en-US")} รายการ เรียงตามวันที่ ล่าสุดก่อน`
          }
          actions={<InvoiceSearch value={search} keep={searchKeep} />}
        />

        {invoices.length === 0 && filtering ? (
          <EmptyState
            icon={SearchX}
            title={search ? `ไม่พบ Invoice ที่ตรงกับ “${search}”` : `ไม่มี Invoice สถานะ${statusFilter?.label ?? ""}`}
            description={
              search
                ? `ลองค้นหาด้วย Invoice No., Sale Order No., ชื่อหรือรหัสลูกค้า หรือเลข PO${selectedYear !== null ? " หรือค้นหาในทุกปี" : ""}`
                : `${periodLabel} ยังไม่มี Invoice ในสถานะนี้`
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {search && selectedYear !== null && (
                  <ButtonLink href={listHref({ year: ALL_YEARS })} variant="outline" size="sm">
                    ค้นหาในทุกปี
                  </ButtonLink>
                )}
                <ButtonLink href={listHref({ status: null, q: null })} variant="outline" size="sm">
                  ล้างตัวกรอง
                </ButtonLink>
              </div>
            }
          />
        ) : invoices.length === 0 ? (
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
                const { paid, remaining } = paymentSummary(
                  invoice.grandTotal,
                  invoice.payments.map((payment) => payment.amount)
                );

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
                        <InvoiceStatusSelect
                          invoiceId={invoice.id}
                          invoiceNumber={invoice.invoiceNumber}
                          status={invoice.status}
                          paid={paid}
                          remaining={remaining}
                          paymentCount={invoice.payments.length}
                          size="sm"
                        />
                        {isInvoiceOverdue(invoice.status, invoice.dueDate) && <Badge tone="danger">เกินกำหนด</Badge>}
                      </div>
                    </Td>

                    <Td>
                      <div className="flex gap-1.5">
                        <ButtonLink href={`/invoices/${invoice.id}`} variant="ghost" size="sm" title="ดูรายละเอียด">
                          <Eye /> ดู
                        </ButtonLink>

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

                        <ButtonAnchor
                          href={`/api/invoices/${invoice.id}/excel`}
                          variant="outline"
                          size="sm"
                          title="ดาวน์โหลด Excel"
                        >
                          <FileSpreadsheet /> Excel
                        </ButtonAnchor>

                        <DeleteInvoiceButton
                          invoiceId={invoice.id}
                          invoiceNumber={invoice.invoiceNumber}
                          paid={paid}
                          paymentCount={invoice.payments.length}
                          compact
                        />
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

/** One tile of the status summary: count and amount, links to the list filtered by that status. */
function StatusTile({
  href,
  active,
  label,
  count,
  hint,
  hintTitle,
  note,
  icon: Icon,
  tone,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  hint: string;
  hintTitle?: string;
  note?: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block rounded-xl border bg-white p-4 shadow-sm transition",
        active
          ? cn("ring-2", TILE_TONES[tone].active)
          : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TILE_TONES[tone].icon)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{count.toLocaleString("en-US")}</p>
      <p className="mt-0.5 truncate text-xs tabular-nums text-slate-500" title={hintTitle}>
        {hint}
      </p>
      {note && <p className="mt-0.5 text-xs text-amber-700">{note}</p>}
    </Link>
  );
}
