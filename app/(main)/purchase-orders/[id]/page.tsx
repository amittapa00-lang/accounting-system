import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FilePlus2, FileText, Pencil } from "lucide-react";

import { InvoiceStatusBadge, PoStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { DetailBlock, DetailList } from "@/components/ui/data-display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requirePageSession } from "@/lib/auth";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { billingBalance, billingLines, invoiceGroupOf } from "@/lib/invoice-billing";
import { formatLineDiscount, formatQuantity } from "@/lib/invoices";
import { displayLineDescription, displayLineNumbers, lineHasAmount, toLineType } from "@/lib/lines";
import { calcTotals, sumMoney, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
  }>;
};

/** Columns of the items table after "#" (a heading's description spans all of them). */
const ITEM_COLUMNS_AFTER_NUMBER = 7;

export default async function PurchaseOrderDetailPage({ params }: Props) {
  await requirePageSession();

  const { id } = await params;

  const [purchaseOrder, lines, group, balance] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
        items: {
          orderBy: {
            itemNo: "asc",
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            subNumber: true,
            saleOrderNumber: true,
            invoiceDate: true,
            grandTotal: true,
            status: true,
          },
          orderBy: [{ createdAt: "asc" }, { subNumber: "asc" }],
        },
      },
    }),
    billingLines(prisma, id),
    invoiceGroupOf(prisma, id),
    billingBalance(prisma, id),
  ]);

  if (!purchaseOrder) {
    notFound();
  }

  const { subtotal, vat, grandTotal } = calcTotals(purchaseOrder.items);
  const numbers = displayLineNumbers(purchaseOrder.items);
  const billingById = new Map(lines.map((line) => [line.id, line]));

  // One PO = one invoice number, billed in parts as sub-invoices (ใบย่อย 1, 2, 3 ...)
  const isCancelled = purchaseOrder.status === "CANCELLED";
  const hasPricedLines = lines.some((line) => lineHasAmount(line));
  // Every invoice is deducted from the PO total (before VAT); more can be created while some is left
  const canCreateInvoice = !isCancelled && balance.remaining > 0;
  const fullyBilled = hasPricedLines && balance.remaining <= 0;

  const createHref = `/invoices/new?purchaseOrderId=${purchaseOrder.id}`;
  const createLabel = group ? `สร้างใบย่อยถัดไป (ใบที่ ${group.nextSubNumber})` : "สร้าง Invoice จาก PO";

  const activeInvoices = purchaseOrder.invoices.filter((invoice) => invoice.status !== "CANCELLED");
  const activeTotal = sumMoney(activeInvoices.map((invoice) => invoice.grandTotal));
  const cancelledCount = purchaseOrder.invoices.length - activeInvoices.length;

  // "Invoice No. IV2026/001 · 2 ใบ · ยกเลิก 1 ใบ · ยอดรวม 1,000.00" (the total leaves out cancelled ones)
  const invoiceSummary =
    purchaseOrder.invoices.length > 0
      ? [
          group && `Invoice No. ${group.invoiceNumber}`,
          `${activeInvoices.length} ใบ`,
          cancelledCount > 0 && `ยกเลิก ${cancelledCount} ใบ`,
          `ยอดรวม ${formatMoney(activeTotal)}`,
          `เรียกเก็บแล้ว ${formatMoney(balance.billed)} จาก ${formatMoney(balance.total)} (ก่อน VAT)`,
          `คงเหลือ ${formatMoney(balance.remaining)}`,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;

  return (
    <>
      <PageHeader
        back={{ href: "/purchase-orders", label: "กลับรายการ PO" }}
        title={`PO No. ${purchaseOrder.poNumber}`}
        description={`รายละเอียด Purchase Order · ${purchaseOrder.customer.name}`}
        meta={<PoStatusBadge status={purchaseOrder.status} />}
        actions={
          <>
            <ButtonLink href={`/purchase-orders/${purchaseOrder.id}/edit`} variant="outline">
              <Pencil /> แก้ไข PO
            </ButtonLink>

            {canCreateInvoice && (
              <ButtonLink href={createHref} variant="brand">
                <FilePlus2 /> {createLabel}
              </ButtonLink>
            )}
          </>
        }
      />

      {isCancelled ? (
        <Alert tone="warning" title="PO นี้ถูกยกเลิกแล้ว" className="mb-6">
          จึงสร้าง Invoice จาก PO นี้ไม่ได้
        </Alert>
      ) : fullyBilled ? (
        <Alert tone="info" title="เรียกเก็บครบยอด PO แล้ว" className="mb-6">
          ยอด PO {formatMoney(balance.total)} บาท (ก่อน VAT) ถูกเรียกเก็บแล้ว
          {group && ` ใน Invoice ${group.invoiceNumber} (${activeInvoices.length} ใบ)`}
        </Alert>
      ) : (
        !hasPricedLines && (
          <Alert tone="warning" title="PO นี้ยังไม่มีรายการที่มีราคา" className="mb-6">
            เพิ่มรายการประเภท &quot;รายการ&quot; หรือ &quot;ย่อย&quot; ก่อน จึงจะสร้าง Invoice ได้
          </Alert>
        )
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* Main column: lines and invoices */}
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="รายการสินค้า" description={`${purchaseOrder.items.length} รายการ`} />

            <Table>
              <thead>
                <tr>
                  <Th align="center" className="w-12">
                    #
                  </Th>
                  <Th>รายละเอียด</Th>
                  <Th align="right">จำนวน</Th>
                  <Th align="center">หน่วย</Th>
                  <Th align="right">ราคาต่อหน่วย</Th>
                  <Th align="right">ส่วนลด</Th>
                  <Th align="right">VAT</Th>
                  <Th align="right">จำนวนเงิน</Th>
                </tr>
              </thead>

              <tbody>
                {purchaseOrder.items.map((item, index) => {
                  const lineType = toLineType(item.lineType);
                  const description = displayLineDescription(item.description, lineType);

                  // Text line (no price, e.g. a heading): number and description only
                  if (!lineHasAmount(item)) {
                    return (
                      <Tr key={item.id}>
                        <Td align="center" className="tabular-nums text-slate-400">
                          {numbers[index] ?? ""}
                        </Td>

                        <Td
                          colSpan={ITEM_COLUMNS_AFTER_NUMBER}
                          className={cn("min-w-48 whitespace-pre-line text-slate-900", lineType === "SUB" && "pl-10 text-slate-700")}
                        >
                          {description}
                        </Td>
                      </Tr>
                    );
                  }

                  const billing = billingById.get(item.id);

                  return (
                    <Tr key={item.id}>
                      <Td align="center" className="tabular-nums text-slate-400">
                        {numbers[index] ?? ""}
                      </Td>

                      <Td className={cn("min-w-48 text-slate-900", lineType === "SUB" && "pl-10 text-slate-700")}>
                        <span className="whitespace-pre-line">{description}</span>

                        {/* Billing progress (under the description so the table stays narrow);
                            lines typed on an invoice (ทำรายการใหม่) only count in the PO balance */}
                        {billing && billing.billed > 0 && (
                          <span
                            className={cn(
                              "mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums",
                              billing.remaining <= 0 ? "text-emerald-700" : "text-slate-500"
                            )}
                          >
                            {billing.remaining <= 0 ? (
                              <>
                                <CheckCircle2 className="size-3.5" />
                                เรียกเก็บครบแล้ว ({formatQuantity(billing.billed)} {item.unit ?? ""})
                              </>
                            ) : (
                              <>
                                <span>เรียกเก็บแล้ว {formatQuantity(billing.billed)}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-amber-700">
                                  คงเหลือ {formatQuantity(billing.remaining)} {item.unit ?? ""}
                                </span>
                              </>
                            )}
                          </span>
                        )}
                      </Td>

                      <Td align="right" className="whitespace-nowrap tabular-nums">
                        {formatQuantity(item.quantity)}
                      </Td>

                      <Td align="center" className="whitespace-nowrap">
                        {item.unit || "-"}
                      </Td>

                      <Td align="right" className="whitespace-nowrap tabular-nums">
                        {toNumber(item.unitPrice) > 0 ? formatMoney(item.unitPrice) : "-"}
                      </Td>

                      <Td align="right" className="whitespace-nowrap tabular-nums">
                        {formatLineDiscount(item.discount, item.discountType) || "-"}
                      </Td>

                      <Td align="right" className="whitespace-nowrap tabular-nums">
                        {formatPercent(item.vat) || "0%"}
                      </Td>

                      <Td align="right" className="whitespace-nowrap font-medium tabular-nums text-slate-900">
                        {formatMoney(item.amount)}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>

            {/* Summary */}
            <div className="flex justify-end rounded-b-xl bg-slate-50/60 px-5 py-4">
              <dl className="w-full max-w-sm space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">รวมก่อน VAT</dt>
                  <dd className="font-medium tabular-nums text-slate-900">{formatMoney(subtotal)}</dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">VAT</dt>
                  <dd className="font-medium tabular-nums text-slate-900">{formatMoney(vat)}</dd>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
                  <dt className="font-semibold text-slate-900">ยอดรวมทั้งสิ้น</dt>
                  <dd className="text-xl font-semibold tabular-nums text-slate-900">{formatMoney(grandTotal)}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Invoice ที่เกี่ยวข้อง"
              description={invoiceSummary}
              actions={
                canCreateInvoice &&
                purchaseOrder.invoices.length > 0 && (
                  <ButtonLink href={createHref} variant="outline" size="sm">
                    <FilePlus2 /> {createLabel}
                  </ButtonLink>
                )
              }
            />

            {purchaseOrder.invoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="ยังไม่มี Invoice ที่สร้างจาก PO นี้"
                description="PO หนึ่งใบใช้เลข Invoice เดียว และเรียกเก็บเป็นใบย่อยได้หลายครั้ง"
                className="py-8"
                action={
                  canCreateInvoice && (
                    <ButtonLink href={createHref} variant="outline" size="sm">
                      <FilePlus2 /> {createLabel}
                    </ButtonLink>
                  )
                }
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Invoice No.</Th>
                    <Th>Sale Order No.</Th>
                    <Th align="center">ใบย่อยที่</Th>
                    <Th>วันที่</Th>
                    <Th>สถานะ</Th>
                    <Th align="right">ยอดรวม</Th>
                  </tr>
                </thead>

                <tbody>
                  {purchaseOrder.invoices.map((invoice) => {
                    const cancelled = invoice.status === "CANCELLED";
                    const muted = cancelled && "text-slate-400";

                    return (
                      <Tr key={invoice.id} className={cn(cancelled && "bg-slate-50/60")}>
                        <Td className="whitespace-nowrap">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            aria-label={`Invoice ${invoice.invoiceNumber} ใบย่อยที่ ${invoice.subNumber}`}
                            className={cn("font-medium text-slate-900 hover:text-brand-700", muted)}
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </Td>

                        <Td className={cn("whitespace-nowrap", muted)}>{invoice.saleOrderNumber || "-"}</Td>

                        <Td align="center" className={cn("tabular-nums", muted)}>
                          {invoice.subNumber}
                        </Td>

                        <Td className={cn("whitespace-nowrap", muted)}>{formatDate(invoice.invoiceDate)}</Td>

                        <Td>
                          <InvoiceStatusBadge status={invoice.status} />
                        </Td>

                        <Td
                          align="right"
                          className={cn(
                            "whitespace-nowrap font-medium tabular-nums text-slate-900",
                            cancelled && "text-slate-400 line-through"
                          )}
                        >
                          {formatMoney(invoice.grandTotal)}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        {/* Side column (shown first on small screens): PO, customer and other information */}
        <div className="order-first min-w-0 space-y-6 xl:order-none">
          <Card>
            <CardHeader title="ข้อมูล PO" />
            <CardBody className="py-2">
              <DetailList
                items={[
                  { label: "วันที่ PO", value: formatDate(purchaseOrder.poDate) },
                  { label: "PLANT", value: purchaseOrder.plant || "-" },
                  { label: "วันที่ส่งสินค้า", value: formatDate(purchaseOrder.deliveryDate) },
                  { label: "สถานที่ส่งสินค้า", value: purchaseOrder.deliveryPlace || "-" },
                  { label: "วางบิล", value: purchaseOrder.billPlacement || "-" },
                  { label: "เครดิต / Payment Term", value: purchaseOrder.paymentTerm || "-" },
                  { label: "Quotation No.", value: purchaseOrder.quotationNumber || "-" },
                  { label: "วันที่ Quotation", value: formatDate(purchaseOrder.quotationDate) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="ข้อมูลลูกค้า" />
            <CardBody className="space-y-4">
              <div className="min-w-0">
                <Link
                  href={`/customers/${purchaseOrder.customer.id}`}
                  className="font-medium text-slate-900 hover:text-brand-700"
                >
                  {purchaseOrder.customer.name}
                </Link>
                <p className="text-xs text-slate-500">รหัสลูกค้า {purchaseOrder.customer.code}</p>
              </div>

              <DetailBlock label="ที่อยู่">{purchaseOrder.customer.address}</DetailBlock>

              <DetailList
                className="border-t border-slate-100"
                items={[
                  { label: "โทรศัพท์", value: purchaseOrder.customer.tel || "-" },
                  { label: "เลขประจำตัวผู้เสียภาษี", value: purchaseOrder.customer.taxId || "-" },
                  {
                    label: "ผู้ติดต่อ",
                    value: purchaseOrder.contactName || purchaseOrder.customer.contactName || "-",
                  },
                  { label: "โทรศัพท์ผู้ติดต่อ", value: purchaseOrder.contactPhone || "-" },
                  { label: "มือถือผู้ติดต่อ", value: purchaseOrder.contactMobile || "-" },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="ข้อมูลเพิ่มเติม" />
            <CardBody className="space-y-4">
              <DetailBlock label="เงื่อนไขการรับสินค้า / ตรวจรับ">{purchaseOrder.acceptanceCondition}</DetailBlock>
              <DetailBlock label="หมายเหตุ">{purchaseOrder.note}</DetailBlock>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
