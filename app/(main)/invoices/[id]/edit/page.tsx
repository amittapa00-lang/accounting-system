import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { InvoiceStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageSession } from "@/lib/auth";
import { formatMoney, toDateInputValue } from "@/lib/format";
import { billingBalance, billingLines, withSavedQuantities } from "@/lib/invoice-billing";
import { vatRateOf } from "@/lib/invoices";
import { lineHasAmount, toLineType } from "@/lib/lines";
import { formatDiscountInput, sumMoney, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { poAmountInput } from "@/lib/purchase-orders";

import InvoiceForm from "@/components/invoices/InvoiceForm";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

/** Shown instead of the form when this invoice cannot be edited. */
function Notice({ invoiceId, title, message }: { invoiceId: string; title: string; message: string }) {
  const back = { href: `/invoices/${invoiceId}`, label: "กลับรายละเอียด Invoice" };
  return (
    <>
      <PageHeader title="แก้ไข Invoice" back={back} />

      <Card className="max-w-2xl">
        <CardBody className="space-y-4">
          <Alert tone="warning" title={title}>
            {message}
          </Alert>

          <div className="flex justify-end">
            <ButtonLink href={back.href} variant="primary">
              <ArrowLeft /> {back.label}
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

export default async function EditInvoicePage({ params }: Props) {
  await requirePageSession();

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { itemNo: "asc" } },
      payments: { select: { amount: true } },
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          status: true,
          deliveryPlace: true,
          paymentTerm: true,
          note: true,
          invoices: {
            select: { id: true, invoiceNumber: true, subNumber: true, saleOrderNumber: true, status: true, grandTotal: true },
            orderBy: [{ invoiceNumber: "asc" }, { subNumber: "asc" }],
          },
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  if (invoice.status === "CANCELLED") {
    return (
      <Notice
        invoiceId={invoice.id}
        title="Invoice นี้ถูกยกเลิกแล้ว"
        message={`Invoice ${invoice.invoiceNumber} ถูกยกเลิกแล้ว จึงแก้ไขไม่ได้`}
      />
    );
  }

  const paid = sumMoney(invoice.payments.map((payment) => payment.amount));

  const { purchaseOrder } = invoice;

  if (purchaseOrder.status === "CANCELLED") {
    return (
      <Notice
        invoiceId={invoice.id}
        title="Purchase Order นี้ถูกยกเลิกแล้ว"
        message={`ไม่สามารถแก้ไข Invoice ของ Purchase Order ${purchaseOrder.poNumber} ที่ถูกยกเลิกได้`}
      />
    );
  }

  // ทำรายการใหม่: every line was typed on the invoice (none is linked to a PO line)
  const custom = invoice.items.length > 0 && invoice.items.every((item) => !item.purchaseOrderItemId);

  // From the PO, lines are chosen again: a line whose PO line no longer exists could not be kept
  if (!custom && invoice.items.some((item) => !item.purchaseOrderItemId)) {
    return (
      <Notice
        invoiceId={invoice.id}
        title="แก้ไข Invoice นี้ไม่ได้"
        message="บางรายการใน Invoice นี้ไม่มีอยู่ใน Purchase Order แล้ว กรุณายกเลิก Invoice นี้แล้วสร้างใหม่จาก Purchase Order"
      />
    );
  }

  // This invoice's own quantities count as not billed, so they can be kept or changed
  const saved = new Map(
    invoice.items.flatMap((item) => (item.purchaseOrderItemId ? [[item.purchaseOrderItemId, toNumber(item.quantity)]] : []))
  ) as Map<string, number>;
  const [billing, balance] = await Promise.all([
    billingLines(prisma, purchaseOrder.id, invoice.id),
    // what the other invoices of the PO have billed (this one is being changed)
    billingBalance(prisma, purchaseOrder.id, invoice.id),
  ]);
  const lines = withSavedQuantities(billing, saved);

  const vatRate = vatRateOf(invoice.subtotal, invoice.vat);

  const others = purchaseOrder.invoices.filter((other) => other.id !== invoice.id);
  const sharesNumber = others.some((other) => other.invoiceNumber === invoice.invoiceNumber);

  const initialData = {
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,

    // the customer as saved on the invoice
    customerCode: invoice.customerCodeSnapshot ?? "",
    customerName: invoice.customerNameSnapshot,
    customerAddress: invoice.customerAddressSnapshot ?? "",
    customerTaxId: invoice.customerTaxIdSnapshot ?? "",

    deliveryPlace: purchaseOrder.deliveryPlace ?? "",
    paymentTerm: purchaseOrder.paymentTerm ?? "",
    note: purchaseOrder.note ?? "",

    invoiceNumber: invoice.invoiceNumber,
    /** sub-invoices share the number, so it changes only while no other invoice uses it */
    numberEditable: !sharesNumber,
    subNumber: invoice.subNumber,
    existingInvoices: others
      .filter((other) => other.invoiceNumber === invoice.invoiceNumber)
      .map((other) => ({
        id: other.id,
        label: other.saleOrderNumber || `${other.invoiceNumber} (${other.subNumber})`,
        status: other.status,
        grandTotal: toNumber(other.grandTotal),
      })),

    lines,
    balance,

    editing: {
      id: invoice.id,
      documentType: invoice.documentType,
      invoiceDate: toDateInputValue(invoice.invoiceDate),
      dueDate: toDateInputValue(invoice.dueDate),
      paymentTerm: invoice.paymentTerm ?? "",
      saleOrderNumber: invoice.saleOrderNumber ?? "",
      saleName: invoice.saleName ?? "",
      entryBy: invoice.entryBy ?? "",
      shipTo: invoice.shipToSnapshot ?? "",
      note: invoice.note ?? "",
      billDiscount: formatDiscountInput(invoice.billDiscount, invoice.billDiscountType),
      quantities: Object.fromEntries(saved),
      billingMode: custom ? ("CUSTOM" as const) : ("PO" as const),
      // the typed lines as the PO line table holds them (Amount before the discount, discount as typed)
      customItems: custom
        ? invoice.items.map((item) => ({
            id: item.id,
            lineType: toLineType(item.lineType),
            description: item.description,
            quantity: toNumber(item.quantity),
            unit: item.unit ?? "",
            unitPrice: toNumber(item.unitPrice),
            discount: lineHasAmount(item) ? formatDiscountInput(item.discount, item.discountType) : "",
            vat: vatRate,
            amount: poAmountInput(item),
          }))
        : [],
      // typed lines share one VAT rate (invoice lines have no VAT column)
      vatRate,
    },
  };

  return (
    <>
      <PageHeader
        title={`แก้ไข Invoice ${invoice.invoiceNumber}`}
        description={`${invoice.customerNameSnapshot} · จาก Purchase Order ${purchaseOrder.poNumber}`}
        back={{ href: `/invoices/${invoice.id}`, label: "กลับรายละเอียด Invoice" }}
        meta={<InvoiceStatusBadge status={invoice.status} />}
      />

      {paid > 0 && (
        <Alert tone="info" className="mb-6" title={`รับชำระแล้ว ${formatMoney(paid)} บาท`}>
          ยอดรวมใหม่ต้องไม่น้อยกว่ายอดที่รับชำระแล้ว สถานะการชำระจะปรับตามยอดใหม่ให้อัตโนมัติ
        </Alert>
      )}

      {/* key: a fresh form each time the page is opened for a newer version of the invoice */}
      <InvoiceForm key={`${invoice.id}:${invoice.updatedAt.toISOString()}`} initialData={initialData} />
    </>
  );
}
