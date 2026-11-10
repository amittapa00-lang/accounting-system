import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageSession } from "@/lib/auth";
import { formatMoney, parseDateInput, todayInputValue } from "@/lib/format";
import { billingBalance, billingLines, invoiceGroupOf, suggestInvoiceNumber } from "@/lib/invoice-billing";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

import InvoiceForm from "@/components/invoices/InvoiceForm";

export const instant = false;

type Props = {
  searchParams: Promise<{
    purchaseOrderId?: string;
  }>;
};

/** Shown instead of the form when an invoice cannot be created from this PO. */
function Notice({
  title,
  message,
  href,
  linkLabel,
  tone = "warning",
  back = { href: "/purchase-orders", label: "Purchase Order" },
  forward = false,
}: {
  title: string;
  message: React.ReactNode;
  href: string;
  linkLabel: string;
  tone?: "info" | "warning" | "danger";
  back?: { href: string; label: string };
  /** the link goes on to another document (arrow icon), rather than back */
  forward?: boolean;
}) {
  return (
    <>
      <PageHeader title="สร้าง Invoice" back={back} />

      <Card className="max-w-2xl">
        <CardBody className="space-y-4">
          <Alert tone={tone} title={title}>
            {message}
          </Alert>

          <div className="flex justify-end">
            <ButtonLink href={href} variant="primary">
              {linkLabel} {forward && <ArrowRight />}
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

export default async function NewInvoicePage({ searchParams }: Props) {
  await requirePageSession();

  const { purchaseOrderId } = await searchParams;

  if (!purchaseOrderId) {
    return (
      <Notice
        title="ไม่พบ Purchase Order"
        message={<>กรุณาเข้าหน้า Purchase Order แล้วกด &quot;สร้าง Invoice จาก PO&quot;</>}
        href="/purchase-orders"
        linkLabel="กลับ Purchase Order"
      />
    );
  }

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      customer: true,
      invoices: {
        select: { id: true, invoiceNumber: true, subNumber: true, saleOrderNumber: true, status: true, grandTotal: true },
        orderBy: [{ invoiceNumber: "asc" }, { subNumber: "asc" }],
      },
    },
  });

  if (!purchaseOrder) {
    notFound();
  }

  const poHref = `/purchase-orders/${purchaseOrder.id}`;
  const poBack = { href: poHref, label: `PO ${purchaseOrder.poNumber}` };

  if (purchaseOrder.status === "CANCELLED") {
    return (
      <Notice
        title="Purchase Order นี้ถูกยกเลิกแล้ว"
        message={`ไม่สามารถสร้าง Invoice จาก Purchase Order ${purchaseOrder.poNumber} ที่ถูกยกเลิกได้`}
        href={poHref}
        linkLabel="กลับ Purchase Order"
        tone="danger"
        back={poBack}
      />
    );
  }

  const [lines, group, balance] = await Promise.all([
    billingLines(prisma, purchaseOrder.id),
    invoiceGroupOf(prisma, purchaseOrder.id),
    billingBalance(prisma, purchaseOrder.id),
  ]);

  if (lines.length === 0) {
    return (
      <Notice
        title="Purchase Order นี้ยังไม่มีรายการสินค้า"
        message="กรุณาเพิ่มรายการสินค้าใน Purchase Order ก่อนสร้าง Invoice"
        href={poHref}
        linkLabel="กลับ Purchase Order"
        back={poBack}
      />
    );
  }

  if (balance.total <= 0) {
    return (
      <Notice
        title="Purchase Order นี้ยังไม่มีรายการที่มีราคา"
        message="เพิ่มรายการที่มี Amount ใน Purchase Order ก่อน จึงจะสร้าง Invoice ได้"
        href={poHref}
        linkLabel="กลับ Purchase Order"
        back={poBack}
      />
    );
  }

  // Every invoice is deducted from the PO total (before VAT): nothing left = nothing more to bill
  if (balance.remaining <= 0) {
    const latest = purchaseOrder.invoices.findLast((invoice) => invoice.status !== "CANCELLED");
    return (
      <Notice
        title="เรียกเก็บครบยอด PO แล้ว"
        message={`Purchase Order ${purchaseOrder.poNumber} ยอด ${formatMoney(balance.total)} บาท (ก่อน VAT) ถูกเรียกเก็บใน Invoice ${group?.invoiceNumber ?? ""} ครบแล้ว`}
        href={latest ? `/invoices/${latest.id}` : poHref}
        linkLabel={latest ? `ดู Invoice ${latest.invoiceNumber}` : "กลับ Purchase Order"}
        tone="info"
        back={poBack}
        forward={Boolean(latest)}
      />
    );
  }

  const suggestedNumber =
    group?.invoiceNumber ?? (await suggestInvoiceNumber(prisma, parseDateInput(todayInputValue()) ?? new Date()));

  const initialData = {
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,

    customerCode: purchaseOrder.customer.code,
    customerName: purchaseOrder.customer.name,
    customerAddress: purchaseOrder.customer.address ?? "",
    customerTaxId: purchaseOrder.customer.taxId ?? "",

    deliveryPlace: purchaseOrder.deliveryPlace ?? "",
    paymentTerm: purchaseOrder.paymentTerm ?? "",
    note: purchaseOrder.note ?? "",

    invoiceNumber: suggestedNumber,
    /** false: the number is shared with earlier sub-invoices of this PO and cannot change */
    numberEditable: group === null,
    subNumber: group?.nextSubNumber ?? 1,
    existingInvoices: purchaseOrder.invoices.map((invoice) => ({
      id: invoice.id,
      label: invoice.saleOrderNumber || `${invoice.invoiceNumber} (${invoice.subNumber})`,
      status: invoice.status,
      grandTotal: toNumber(invoice.grandTotal),
    })),

    lines,
    balance,
  };

  return (
    <>
      <PageHeader
        title={group ? `สร้างใบย่อยที่ ${group.nextSubNumber}` : "สร้าง Invoice"}
        description={
          group
            ? `เพิ่มใบย่อยของ Invoice ${group.invoiceNumber} จาก Purchase Order ${purchaseOrder.poNumber}`
            : `สร้าง Invoice จาก Purchase Order ${purchaseOrder.poNumber}`
        }
        back={poBack}
      />

      {/* key: Next keeps visited pages (and their client state) alive; a new sub-invoice must
          start with a fresh form, not the "saving…" state left by the previous one */}
      <InvoiceForm key={`${initialData.purchaseOrderId}:${initialData.subNumber}`} initialData={initialData} />
    </>
  );
}
