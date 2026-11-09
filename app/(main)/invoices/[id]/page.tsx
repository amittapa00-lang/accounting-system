import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, FilePlus2, Plus, Receipt, Wallet } from "lucide-react";

import { Badge, InvoiceStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { DetailBlock, DetailList } from "@/components/ui/data-display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requirePageSession } from "@/lib/auth";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { billingLines, hasUnbilled, invoiceGroupOf } from "@/lib/invoice-billing";
import { formatLineDiscount, formatQuantity, isBilledInvoiceStatus, isInvoiceOverdue } from "@/lib/invoices";
import { documentTypeLabel, OPEN_INVOICE_STATUSES, paymentMethodLabel, type Tone } from "@/lib/labels";
import { displayLineDescription, displayLineNumbers, lineHasAmount, toLineType } from "@/lib/lines";
import { paymentSummary, sumMoney, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

import DraftInvoiceActions from "@/components/invoices/DraftInvoiceActions";
import FormPdfActions from "@/components/invoices/FormPdfActions";

export const instant = false;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InvoiceDetailPage({ params }: PageProps) {
  await requirePageSession();

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: {
      id,
    },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          poDate: true,
          status: true,
          billPlacement: true,
          contactPhone: true,
          contactMobile: true,
          acceptanceCondition: true,
          note: true,
        },
      },
      items: {
        orderBy: {
          itemNo: "asc",
        },
      },
      payments: {
        orderBy: {
          paymentDate: "desc",
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  const purchaseOrderId = invoice.purchaseOrder.id;
  const isPoCancelled = invoice.purchaseOrder.status === "CANCELLED";

  // ==========================================
  // ใบย่อย: ทุกใบของ PO นี้ที่ใช้เลข Invoice เดียวกัน (IV2026/001 ใบย่อยที่ 1, 2, 3 ...)
  // ==========================================

  const [subInvoices, group, poLines] = await Promise.all([
    prisma.invoice.findMany({
      where: { purchaseOrderId, invoiceNumber: invoice.invoiceNumber },
      orderBy: { subNumber: "asc" },
      select: {
        id: true,
        subNumber: true,
        saleOrderNumber: true,
        invoiceDate: true,
        status: true,
        grandTotal: true,
      },
    }),
    invoiceGroupOf(prisma, purchaseOrderId),
    isPoCancelled ? Promise.resolve([]) : billingLines(prisma, purchaseOrderId),
  ]);

  const hasSubInvoices = subInvoices.length > 1 || invoice.subNumber > 1;

  // ใบย่อยถัดไปจะใช้เลขของกลุ่มล่าสุดของ PO จึงแสดงปุ่มเฉพาะในกลุ่มนั้น
  const canCreateNextSub =
    !isPoCancelled && group?.invoiceNumber === invoice.invoiceNumber && hasUnbilled(poLines);

  const subInvoicesTotal = sumMoney(
    subInvoices.filter((sub) => sub.status !== "CANCELLED").map((sub) => sub.grandTotal)
  );

  // ==========================================
  // รายการ: ลำดับที่แสดง (ITEM มีเลข, SUB ไม่มี) และยอดรวมก่อนส่วนลดท้ายบิล
  // ==========================================

  const lineNumbers = displayLineNumbers(invoice.items);

  const itemsTotal = sumMoney(
    invoice.items.filter((item) => lineHasAmount(item)).map((item) => item.amount)
  );

  const billDiscountAmount = toNumber(invoice.billDiscountAmount);

  const billDiscountLabel =
    invoice.billDiscountType === "PERCENT" && formatPercent(invoice.billDiscount)
      ? `ส่วนลดท้ายบิล (${formatPercent(invoice.billDiscount)})`
      : "ส่วนลดท้ายบิล";

  const note = invoice.note?.trim() ?? "";

  // ==========================================
  // ยอดรับชำระ (คำนวณเป็นสตางค์ ไม่มีเศษทศนิยมคลาดเคลื่อน)
  // ==========================================

  const {
    paid: totalPaid,
    remaining: remainingAmount,
    isFullyPaid,
  } = paymentSummary(
    invoice.grandTotal,
    invoice.payments.map((payment) => payment.amount)
  );

  // รับชำระได้เฉพาะ Invoice ที่ออกแล้วและยังชำระไม่ครบ
  const canReceivePayment =
    (OPEN_INVOICE_STATUSES as string[]).includes(invoice.status) && remainingAmount > 0;

  const isCancelled = invoice.status === "CANCELLED";

  // ถือว่า "วางบิลแล้ว" เมื่อออก Invoice แล้ว (ไม่ใช่ฉบับร่าง/ยกเลิก)
  const isBilled = isBilledInvoiceStatus(invoice.status);

  const hasPayment = totalPaid > 0;

  const paymentStateLabel = isFullyPaid ? "รับเงินแล้ว" : hasPayment ? "รับเงินบางส่วน" : "ยังไม่ได้รับเงิน";

  const paymentStateTone: Tone = isFullyPaid ? "success" : hasPayment ? "info" : "neutral";

  // Width of the progress bar only (display). Not fully paid implies grandTotal > 0.
  const paidPercent = isFullyPaid
    ? 100
    : Math.min(100, Math.floor((totalPaid / toNumber(invoice.grandTotal)) * 100));

  const receivePaymentHref = `/payments/new?invoiceId=${invoice.id}`;

  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        description={invoice.customerNameSnapshot}
        back={{ href: "/invoices", label: "Invoice ทั้งหมด" }}
        meta={
          <>
            {hasSubInvoices && <Badge tone="brand">ใบย่อยที่ {invoice.subNumber}</Badge>}
            {invoice.saleOrderNumber && (
              <span className="text-sm text-slate-500">
                Sale Order No. <span className="font-medium text-slate-700">{invoice.saleOrderNumber}</span>
              </span>
            )}
            <InvoiceStatusBadge status={invoice.status} />
            {isInvoiceOverdue(invoice.status, invoice.dueDate) && <Badge tone="danger">เกินกำหนดชำระ</Badge>}
            <Badge tone={isBilled ? "success" : "neutral"}>{isBilled ? "วางบิลแล้ว" : "ยังไม่วางบิล"}</Badge>
            <Badge tone={paymentStateTone}>{paymentStateLabel}</Badge>
          </>
        }
        actions={
          <>
            <ButtonLink href={`/purchase-orders/${invoice.purchaseOrder.id}`} variant="outline">
              <ClipboardList /> ดู Purchase Order
            </ButtonLink>

            {canCreateNextSub && (
              <ButtonLink href={`/invoices/new?purchaseOrderId=${purchaseOrderId}`} variant="outline">
                <FilePlus2 /> สร้างใบย่อยถัดไป
              </ButtonLink>
            )}

            {invoice.status === "DRAFT" && <DraftInvoiceActions invoiceId={invoice.id} />}

            {canReceivePayment && (
              <ButtonLink href={receivePaymentHref} variant="success">
                <Wallet /> รับชำระเงิน
              </ButtonLink>
            )}
          </>
        }
      />

      {isCancelled && (
        <Alert tone="danger" className="mb-6">
          Invoice นี้ถูกยกเลิกแล้ว ไม่สามารถพิมพ์หรือรับชำระเงินได้
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* ================================== */}
        {/* Main column */}
        {/* ================================== */}

        <div className="min-w-0 space-y-6 xl:col-span-2">
          {/* Document */}
          <Card>
            <CardHeader title="ข้อมูลเอกสาร" />

            <CardBody className="grid grid-cols-1 gap-x-8 py-2 sm:grid-cols-2">
              <DetailList
                className="min-w-0"
                items={[
                  {
                    label: "Invoice No.",
                    value: hasSubInvoices ? `${invoice.invoiceNumber} (ใบย่อยที่ ${invoice.subNumber})` : invoice.invoiceNumber,
                  },
                  { label: "ประเภทเอกสาร", value: documentTypeLabel(invoice.documentType) },
                  {
                    label: "Purchase Order",
                    value: (
                      <Link
                        href={`/purchase-orders/${invoice.purchaseOrder.id}`}
                        className="text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {invoice.purchaseOrder.poNumber}
                      </Link>
                    ),
                  },
                ]}
              />

              <DetailList
                className="min-w-0 border-t border-slate-100 sm:border-t-0"
                items={[
                  { label: "วันที่ Invoice", value: formatDate(invoice.invoiceDate) },
                  { label: "วันครบกำหนด", value: formatDate(invoice.dueDate) },
                  { label: "Payment Term", value: invoice.paymentTerm || "-" },
                  { label: "Sale Order No.", value: invoice.saleOrderNumber || "-" },
                ]}
              />
            </CardBody>
          </Card>

          {/* Sub-invoices sharing this invoice number */}
          {subInvoices.length > 1 && (
            <Card>
              <CardHeader
                title={`ใบย่อยของ Invoice ${invoice.invoiceNumber}`}
                description={`${subInvoices.length} ใบ · รวม ${formatMoney(subInvoicesTotal)} บาท (ไม่รวมที่ยกเลิก)`}
              />

              <ul className="divide-y divide-slate-100">
                {subInvoices.map((sub) => {
                  const isCurrent = sub.id === invoice.id;
                  const label = sub.saleOrderNumber || `${invoice.invoiceNumber} ใบย่อยที่ ${sub.subNumber}`;

                  const content = (
                    <>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            isCurrent ? "text-brand-700" : "text-slate-900 group-hover:text-brand-700"
                          )}
                        >
                          {label}
                          {isCurrent && <span className="ml-2 text-xs font-normal text-brand-600">(ใบนี้)</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          ใบย่อยที่ {sub.subNumber} · {formatDate(sub.invoiceDate)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <InvoiceStatusBadge status={sub.status} />
                        <span
                          className={cn(
                            "w-28 text-right text-sm font-semibold tabular-nums",
                            sub.status === "CANCELLED" ? "text-slate-400 line-through" : "text-slate-900"
                          )}
                        >
                          {formatMoney(sub.grandTotal)}
                        </span>
                      </div>
                    </>
                  );

                  const rowClass = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-5 py-2.5";

                  return (
                    <li key={sub.id}>
                      {isCurrent ? (
                        <div aria-current="page" className={cn(rowClass, "border-l-2 border-brand-500 bg-brand-50/60 pl-[18px]")}>
                          {content}
                        </div>
                      ) : (
                        <Link
                          href={`/invoices/${sub.id}`}
                          className={cn(rowClass, "group transition-colors hover:bg-slate-50")}
                        >
                          {content}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* Items */}
          <Card>
            <CardHeader title="รายการสินค้า" description={`${invoice.items.length} รายการ`} />

            {/* Slightly tighter cells: the table shares the row with the side column on desktop */}
            <Table className="[&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <Th align="center">#</Th>
                  <Th>รายละเอียด</Th>
                  <Th align="right">จำนวน</Th>
                  <Th>หน่วย</Th>
                  <Th align="right">ราคาต่อหน่วย</Th>
                  <Th align="right">ส่วนลด</Th>
                  <Th align="right">จำนวนเงิน</Th>
                </tr>
              </thead>

              <tbody>
                {invoice.items.map((item, index) => {
                  const lineType = toLineType(item.lineType);
                  // a line without price is text only (heading or note)
                  const textOnly = !lineHasAmount(item);

                  return (
                    <Tr key={item.id}>
                      <Td align="center" className="tabular-nums text-slate-500">
                        {lineNumbers[index] ?? ""}
                      </Td>

                      <Td className="min-w-48 text-slate-900">
                        {/* SUB lines are indented under their heading. The padding is on the inner
                            block because the table's [&_td]:px-3 wins over a padding class on the cell. */}
                        <div className={cn("whitespace-pre-line", lineType === "SUB" && "pl-5")}>
                          {displayLineDescription(item.description, lineType)}
                        </div>
                      </Td>

                      {textOnly ? (
                        <>
                          <Td />
                          <Td />
                          <Td />
                          <Td />
                          <Td />
                        </>
                      ) : (
                        <>
                          <Td align="right" className="tabular-nums">
                            {formatQuantity(item.quantity)}
                          </Td>

                          <Td>{item.unit || "-"}</Td>

                          <Td align="right" className="tabular-nums">
                            {formatMoney(item.unitPrice)}
                          </Td>

                          <Td align="right" className="tabular-nums">
                            {formatLineDiscount(item.discount, item.discountType) || "-"}
                          </Td>

                          <Td align="right" className="font-medium tabular-nums text-slate-900">
                            {formatMoney(item.amount)}
                          </Td>
                        </>
                      )}
                    </Tr>
                  );
                })}
              </tbody>
            </Table>

            {note && (
              <CardBody className="border-t border-slate-100 py-4">
                <DetailBlock label="หมายเหตุ">{note}</DetailBlock>
              </CardBody>
            )}
          </Card>

          {/* Purchase Order contact and conditions */}
          <Card>
            <CardHeader
              title="ข้อมูลผู้ติดต่อและเงื่อนไข"
              description={`จาก Purchase Order ${invoice.purchaseOrder.poNumber}`}
            />

            <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <DetailBlock label="โทรศัพท์ผู้ติดต่อ">{invoice.purchaseOrder.contactPhone}</DetailBlock>
              </div>

              <div className="min-w-0">
                <DetailBlock label="มือถือผู้ติดต่อ">{invoice.purchaseOrder.contactMobile}</DetailBlock>
              </div>

              <div className="min-w-0">
                <DetailBlock label="สถานที่วางบิล">{invoice.purchaseOrder.billPlacement}</DetailBlock>
              </div>

              <div className="min-w-0">
                <DetailBlock label="เงื่อนไขการรับสินค้า / ตรวจรับ">
                  {invoice.purchaseOrder.acceptanceCondition}
                </DetailBlock>
              </div>

              <div className="min-w-0 sm:col-span-2">
                <DetailBlock label="หมายเหตุ">{invoice.purchaseOrder.note}</DetailBlock>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ================================== */}
        {/* Side column */}
        {/* ================================== */}

        <div className="min-w-0 space-y-6">
          {/* Totals and payment summary */}
          <Card>
            <CardHeader title="สรุปยอด" />

            <CardBody className="space-y-5">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">รวมรายการ</dt>
                  <dd className="tabular-nums text-slate-900">{formatMoney(itemsTotal)} บาท</dd>
                </div>

                {billDiscountAmount > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">{billDiscountLabel}</dt>
                    <dd className="tabular-nums text-red-600">-{formatMoney(billDiscountAmount)} บาท</dd>
                  </div>
                )}

                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="tabular-nums text-slate-900">{formatMoney(invoice.subtotal)} บาท</dd>
                </div>

                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">VAT</dt>
                  <dd className="tabular-nums text-slate-900">{formatMoney(invoice.vat)} บาท</dd>
                </div>

                <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-3">
                  <dt className="font-semibold text-slate-900">ยอดรวมทั้งสิ้น</dt>
                  <dd className="text-lg font-semibold tabular-nums text-slate-900">
                    {formatMoney(invoice.grandTotal)} บาท
                  </dd>
                </div>
              </dl>

              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-slate-500">รับแล้ว</span>
                  <span className="font-medium tabular-nums text-emerald-700">{formatMoney(totalPaid)} บาท</span>
                </div>

                <div>
                  <div
                    role="progressbar"
                    aria-label="สัดส่วนที่รับชำระแล้ว"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={paidPercent}
                    className="h-2 overflow-hidden rounded-full bg-slate-100"
                  >
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPercent}%` }} />
                  </div>
                  <p className="mt-1 text-right text-xs text-slate-500">ชำระแล้ว {paidPercent}%</p>
                </div>

                <div
                  className={cn(
                    "rounded-lg px-4 py-3",
                    remainingAmount > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                  )}
                >
                  <p className="text-sm font-medium">คงเหลือ</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatMoney(remainingAmount)} <span className="text-base font-medium">บาท</span>
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* PDF / print to form */}
          {!isCancelled && <FormPdfActions invoiceId={invoice.id} />}

          {/* Customer */}
          <Card>
            <CardHeader title="ข้อมูลลูกค้า" />

            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="min-w-0">
                <DetailBlock label="รหัสลูกค้า">{invoice.customerCodeSnapshot}</DetailBlock>
              </div>

              <div className="min-w-0">
                <DetailBlock label="ชื่อลูกค้า">
                  <span className="font-medium">{invoice.customerNameSnapshot}</span>
                </DetailBlock>
              </div>

              <div className="min-w-0">
                <DetailBlock label="ที่อยู่">{invoice.customerAddressSnapshot}</DetailBlock>
              </div>

              <div className="min-w-0">
                <DetailBlock label="เลขประจำตัวผู้เสียภาษี">{invoice.customerTaxIdSnapshot}</DetailBlock>
              </div>

              <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                <DetailBlock label="สถานที่จัดส่ง">{invoice.shipToSnapshot}</DetailBlock>
              </div>
            </CardBody>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader
              title="ประวัติการรับชำระเงิน"
              description={`รับชำระแล้ว ${invoice.payments.length} รายการ`}
              actions={
                canReceivePayment && (
                  <ButtonLink href={receivePaymentHref} variant="outline" size="sm">
                    <Plus /> รับชำระเงิน
                  </ButtonLink>
                )
              }
            />

            {invoice.payments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Invoice นี้ยังไม่มีประวัติการรับชำระเงิน"
                description={
                  invoice.status === "DRAFT" ? "ต้องออก Invoice ก่อนจึงจะรับชำระเงินได้" : undefined
                }
                action={
                  canReceivePayment && (
                    <ButtonLink href={receivePaymentHref} variant="ghost" size="sm" className="text-emerald-700">
                      บันทึกการรับชำระเงิน
                    </ButtonLink>
                  )
                }
                className="py-8"
              />
            ) : (
              <>
                <ol className="divide-y divide-slate-100">
                  {invoice.payments.map((payment, index) => (
                    <li key={payment.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            <span className="mr-1.5 text-slate-400">#{index + 1}</span>
                            {formatDate(payment.paymentDate)}
                          </p>
                          <p className="text-xs text-slate-500">{paymentMethodLabel(payment.paymentMethod)}</p>
                        </div>

                        <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                          {formatMoney(payment.amount)} บาท
                        </span>
                      </div>

                      {(payment.referenceNumber || payment.receivedBy || payment.note) && (
                        <dl className="mt-1.5 space-y-0.5 text-xs">
                          {payment.referenceNumber && (
                            <div className="flex gap-1.5">
                              <dt className="shrink-0 text-slate-500">เลขที่อ้างอิง</dt>
                              <dd className="min-w-0 break-words text-slate-700">{payment.referenceNumber}</dd>
                            </div>
                          )}
                          {payment.receivedBy && (
                            <div className="flex gap-1.5">
                              <dt className="shrink-0 text-slate-500">ผู้รับเงิน</dt>
                              <dd className="min-w-0 break-words text-slate-700">{payment.receivedBy}</dd>
                            </div>
                          )}
                          {payment.note && (
                            <div className="flex gap-1.5">
                              <dt className="shrink-0 text-slate-500">หมายเหตุ</dt>
                              <dd className="min-w-0 whitespace-pre-line break-words text-slate-700">
                                {payment.note}
                              </dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </li>
                  ))}
                </ol>

                <div className="flex items-baseline justify-between gap-4 rounded-b-xl border-t border-slate-200 bg-slate-50/60 px-5 py-3">
                  <span className="text-sm font-semibold text-slate-700">รวมรับชำระ</span>
                  <span className="font-semibold tabular-nums text-emerald-700">{formatMoney(totalPaid)} บาท</span>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
