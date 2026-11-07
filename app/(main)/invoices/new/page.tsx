import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageSession } from "@/lib/auth";
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
    where: {
      id: purchaseOrderId,
    },
    include: {
      customer: true,
      items: {
        orderBy: {
          itemNo: "asc",
        },
      },
      // 1 PO = 1 Invoice: a cancelled invoice does not count
      invoices: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, invoiceNumber: true },
        take: 1,
      },
    },
  });

  if (!purchaseOrder) {
    notFound();
  }

  const poHref = `/purchase-orders/${purchaseOrder.id}`;
  const poBack = { href: poHref, label: `PO ${purchaseOrder.poNumber}` };
  const activeInvoice = purchaseOrder.invoices[0];

  if (activeInvoice) {
    return (
      <Notice
        title="Purchase Order นี้มี Invoice แล้ว"
        message={
          <>
            Purchase Order {purchaseOrder.poNumber} ออก Invoice {activeInvoice.invoiceNumber} ไปแล้ว (1 PO ออกได้ 1
            Invoice) หากต้องการออกใหม่ ให้ยกเลิก Invoice ฉบับร่างเดิมก่อน
          </>
        }
        href={`/invoices/${activeInvoice.id}`}
        linkLabel={`ดู Invoice ${activeInvoice.invoiceNumber}`}
        tone="info"
        back={poBack}
        forward
      />
    );
  }

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

  if (purchaseOrder.items.length === 0) {
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

  const initialData = {
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,

    customerCode: purchaseOrder.customer.code,
    customerName: purchaseOrder.customer.name,
    customerAddress: purchaseOrder.customer.address ?? "",
    customerTaxId: purchaseOrder.customer.taxId ?? "",

    deliveryPlace: purchaseOrder.deliveryPlace ?? "",
    paymentTerm: purchaseOrder.paymentTerm ?? "",

    items: purchaseOrder.items.map((item) => ({
      id: item.id,
      itemNo: item.itemNo,
      description: item.description,
      quantity: toNumber(item.quantity),
      unit: item.unit ?? "",
      unitPrice: toNumber(item.unitPrice),
      discount: toNumber(item.discount),
      discountType: item.discountType,
      vat: toNumber(item.vat),
    })),
  };

  return (
    <>
      <PageHeader
        title="สร้าง Invoice"
        description={`สร้าง Invoice จาก Purchase Order ${purchaseOrder.poNumber}`}
        back={poBack}
      />

      <InvoiceForm initialData={initialData} />
    </>
  );
}
