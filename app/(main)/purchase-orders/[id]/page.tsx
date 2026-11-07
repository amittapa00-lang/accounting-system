import { notFound } from "next/navigation";
import Link from "next/link";
import { FilePlus2, FileText, Pencil } from "lucide-react";

import { InvoiceStatusBadge, PoStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DetailBlock, DetailList } from "@/components/ui/data-display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { requirePageSession } from "@/lib/auth";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { formatLineDiscount, formatQuantity } from "@/lib/invoices";
import { documentTypeLabel } from "@/lib/labels";
import { calcTotals } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchaseOrderDetailPage({ params }: Props) {
  await requirePageSession();

  const { id } = await params;

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
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
          invoiceDate: true,
          documentType: true,
          grandTotal: true,
          status: true,
        },
        orderBy: {
          invoiceDate: "desc",
        },
      },
    },
  });

  if (!purchaseOrder) {
    notFound();
  }

  const { subtotal, vat, grandTotal } = calcTotals(purchaseOrder.items);

  // 1 PO = 1 Invoice: a cancelled invoice frees the PO for a new one
  const activeInvoice = purchaseOrder.invoices.find((invoice) => invoice.status !== "CANCELLED");
  const canCreateInvoice = !activeInvoice && purchaseOrder.status !== "CANCELLED";

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

            {activeInvoice && (
              <ButtonLink href={`/invoices/${activeInvoice.id}`} variant="primary">
                <FileText /> ดู Invoice {activeInvoice.invoiceNumber}
              </ButtonLink>
            )}

            {canCreateInvoice && (
              <ButtonLink href={`/invoices/new?purchaseOrderId=${purchaseOrder.id}`} variant="brand">
                <FilePlus2 /> สร้าง Invoice จาก PO
              </ButtonLink>
            )}
          </>
        }
      />

      {activeInvoice ? (
        <Alert tone="info" title="PO นี้มี Invoice แล้ว" className="mb-6">
          <Link href={`/invoices/${activeInvoice.id}`} className="font-medium underline underline-offset-2">
            Invoice {activeInvoice.invoiceNumber}
          </Link>{" "}
          สร้างจาก PO นี้แล้ว (1 PO ออก Invoice ได้ 1 ใบ) หากต้องการออกใหม่ ให้ยกเลิก Invoice เดิมก่อน
        </Alert>
      ) : (
        purchaseOrder.status === "CANCELLED" && (
          <Alert tone="warning" title="PO นี้ถูกยกเลิกแล้ว" className="mb-6">
            จึงสร้าง Invoice จาก PO นี้ไม่ได้
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
                {purchaseOrder.items.map((item) => (
                  <Tr key={item.id}>
                    <Td align="center" className="tabular-nums text-slate-400">
                      {item.itemNo}
                    </Td>

                    <Td className="min-w-56 text-slate-900">{item.description}</Td>

                    <Td align="right" className="whitespace-nowrap tabular-nums">
                      {formatQuantity(item.quantity)}
                    </Td>

                    <Td align="center" className="whitespace-nowrap">
                      {item.unit || "-"}
                    </Td>

                    <Td align="right" className="whitespace-nowrap tabular-nums">
                      {formatMoney(item.unitPrice)}
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
                ))}
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
            <CardHeader title="Invoice ที่เกี่ยวข้อง" />

            {purchaseOrder.invoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="ยังไม่มี Invoice ที่สร้างจาก PO นี้"
                className="py-8"
                action={
                  canCreateInvoice && (
                    <ButtonLink
                      href={`/invoices/new?purchaseOrderId=${purchaseOrder.id}`}
                      variant="outline"
                      size="sm"
                    >
                      <FilePlus2 /> สร้าง Invoice จาก PO
                    </ButtonLink>
                  )
                }
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Invoice No.</Th>
                    <Th>วันที่</Th>
                    <Th>ประเภท</Th>
                    <Th align="right">ยอดรวม</Th>
                    <Th>สถานะ</Th>
                  </tr>
                </thead>

                <tbody>
                  {purchaseOrder.invoices.map((invoice) => (
                    <Tr key={invoice.id}>
                      <Td className="whitespace-nowrap">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="font-medium text-slate-900 hover:text-brand-700"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </Td>

                      <Td className="whitespace-nowrap">{formatDate(invoice.invoiceDate)}</Td>

                      <Td className="min-w-48">{documentTypeLabel(invoice.documentType)}</Td>

                      <Td align="right" className="whitespace-nowrap font-medium tabular-nums text-slate-900">
                        {formatMoney(invoice.grandTotal)}
                      </Td>

                      <Td>
                        <InvoiceStatusBadge status={invoice.status} />
                      </Td>
                    </Tr>
                  ))}
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
