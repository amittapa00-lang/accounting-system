"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DetailBlock } from "@/components/ui/data-display";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatMoney, todayInputValue } from "@/lib/format";
import { formatLineDiscount, formatQuantity, invoiceLinesFromPo } from "@/lib/invoices";
import { DOCUMENT_TYPES } from "@/lib/labels";

type InvoiceItem = {
  id: string;
  itemNo: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  discountType: string;
  /** VAT rate in percent */
  vat: number;
};

type InvoiceInitialData = {
  purchaseOrderId: string;
  poNumber: string;

  customerCode: string;
  customerName: string;
  customerAddress: string;
  customerTaxId: string;

  deliveryPlace: string;
  paymentTerm: string;

  items: InvoiceItem[];
};

type InvoiceFormProps = {
  initialData: InvoiceInitialData;
};

export default function InvoiceForm({ initialData }: InvoiceFormProps) {
  const router = useRouter();

  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0].value);

  // Today in Thai time (toISOString would give yesterday before 07:00)
  const [invoiceDate, setInvoiceDate] = useState(todayInputValue);

  const [dueDate, setDueDate] = useState("");

  const [paymentTerm, setPaymentTerm] = useState(initialData.paymentTerm);

  const [saleOrderNumber, setSaleOrderNumber] = useState(initialData.poNumber);

  const [saleName, setSaleName] = useState("");

  const [entryBy, setEntryBy] = useState("");

  const [shipTo, setShipTo] = useState(initialData.deliveryPlace);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  // Blocks a second submit before React has re-rendered the disabled button
  const inFlight = useRef(false);

  // Same calculation as POST /api/invoices, so the preview matches the saved invoice
  const { lines, totals } = invoiceLinesFromPo(initialData.items);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError("");
    setSuccess("");

    const fail = (message: string) => {
      setError(message);
      inFlight.current = false;
      setSubmitting(false);
    };

    let response: Response;
    try {
      response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          purchaseOrderId: initialData.purchaseOrderId,
          documentType,
          invoiceDate,
          dueDate: dueDate || null,
          paymentTerm,
          saleOrderNumber,
          saleName,
          entryBy,
          shipToSnapshot: shipTo,
        }),
      });
    } catch {
      fail("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
      return;
    }

    const data: { error?: unknown; invoice?: { id?: string } } = await response.json().catch(() => ({}));

    if (!response.ok || !data.invoice?.id) {
      fail(typeof data.error === "string" ? data.error : "ไม่สามารถสร้าง Invoice ได้");
      return;
    }

    // Keep the button disabled until the new page has loaded: a second click would be rejected
    // anyway (1 PO = 1 Invoice), but should not even be possible.
    setSuccess("สร้าง Invoice สำเร็จ");
    router.push(`/invoices/${data.invoice.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Document type and dates */}
      <Card>
        <CardHeader title="ข้อมูลเอกสาร" description="ประเภทเอกสาร วันที่ และเงื่อนไขการชำระเงิน" />

        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="ประเภทเอกสาร" htmlFor="invoice-document-type" className="min-w-0 sm:col-span-2">
            <Select
              id="invoice-document-type"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              {DOCUMENT_TYPES.map((type, index) => (
                <option key={type.value} value={type.value}>
                  {index + 1}. {type.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="วันที่ Invoice" htmlFor="invoice-date" required className="min-w-0">
            <Input
              id="invoice-date"
              type="date"
              value={invoiceDate}
              onChange={(event) => setInvoiceDate(event.target.value)}
              required
            />
          </Field>

          <Field label="วันครบกำหนดชำระ" htmlFor="invoice-due-date" className="min-w-0">
            <Input
              id="invoice-due-date"
              type="date"
              value={dueDate}
              min={invoiceDate || undefined}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>

          <Field label="Payment Term" htmlFor="invoice-payment-term" className="min-w-0">
            <Input
              id="invoice-payment-term"
              type="text"
              value={paymentTerm}
              onChange={(event) => setPaymentTerm(event.target.value)}
              placeholder="เช่น เครดิต 30 วัน"
            />
          </Field>

          <Field label="Sale Order No." htmlFor="invoice-sale-order" className="min-w-0">
            <Input
              id="invoice-sale-order"
              type="text"
              value={saleOrderNumber}
              onChange={(event) => setSaleOrderNumber(event.target.value)}
            />
          </Field>

          <Field label="Sale Name" htmlFor="invoice-sale-name" className="min-w-0">
            <Input
              id="invoice-sale-name"
              type="text"
              value={saleName}
              onChange={(event) => setSaleName(event.target.value)}
              placeholder="ชื่อ Sales"
            />
          </Field>

          <Field label="Entry By" htmlFor="invoice-entry-by" className="min-w-0">
            <Input
              id="invoice-entry-by"
              type="text"
              value={entryBy}
              onChange={(event) => setEntryBy(event.target.value)}
              placeholder="ผู้บันทึก"
            />
          </Field>
        </CardBody>
      </Card>

      {/* Customer (read-only, from the PO) and ship-to */}
      <Card>
        <CardHeader
          title="ลูกค้าและสถานที่ส่ง"
          description={`ข้อมูลลูกค้าดึงมาจาก Purchase Order ${initialData.poNumber}`}
        />

        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <DetailBlock label="รหัสลูกค้า">{initialData.customerCode}</DetailBlock>
          </div>

          <div className="min-w-0 sm:col-span-2">
            <DetailBlock label="ชื่อลูกค้า">
              <span className="font-medium">{initialData.customerName}</span>
            </DetailBlock>
          </div>

          <div className="min-w-0">
            <DetailBlock label="Tax ID">{initialData.customerTaxId}</DetailBlock>
          </div>

          <div className="min-w-0 sm:col-span-2 lg:col-span-3">
            <DetailBlock label="ที่อยู่">{initialData.customerAddress}</DetailBlock>
          </div>

          <div className="min-w-0">
            <DetailBlock label="Purchase Order">{initialData.poNumber}</DetailBlock>
          </div>

          <Field
            label="Ship To / สถานที่ส่ง"
            htmlFor="invoice-ship-to"
            hint="ค่าเริ่มต้นจากสถานที่ส่งใน Purchase Order แก้ไขได้"
            className="min-w-0 border-t border-slate-100 pt-5 sm:col-span-2 lg:col-span-4"
          >
            <Input
              id="invoice-ship-to"
              type="text"
              value={shipTo}
              onChange={(event) => setShipTo(event.target.value)}
            />
          </Field>
        </CardBody>
      </Card>

      {/* Items and totals (preview) */}
      <Card>
        <CardHeader title="รายการสินค้า" description="รายการถูกดึงมาจาก Purchase Order อัตโนมัติ" />

        <Table>
          <thead>
            <tr>
              <Th align="center">#</Th>
              <Th>รายละเอียด</Th>
              <Th align="right">Qty</Th>
              <Th>Unit</Th>
              <Th align="right">Unit Price</Th>
              <Th align="right">Discount</Th>
              <Th align="right">Amount</Th>
              <Th align="right">VAT</Th>
            </tr>
          </thead>

          <tbody>
            {lines.map(({ item, amount }) => (
              <Tr key={item.id}>
                <Td align="center" className="text-slate-500">
                  {item.itemNo}
                </Td>

                <Td className="min-w-56 whitespace-pre-line text-slate-900">{item.description}</Td>

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
                  {formatMoney(amount)}
                </Td>

                <Td align="right" className="tabular-nums">
                  {item.vat}%
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>

        <div className="flex justify-end px-5 py-4">
          <dl className="w-full max-w-sm space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums text-slate-900">{formatMoney(totals.subtotal)}</dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">VAT</dt>
              <dd className="tabular-nums text-slate-900">{formatMoney(totals.vat)}</dd>
            </div>

            <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-3">
              <dt className="font-semibold text-slate-900">Grand Total</dt>
              <dd className="text-xl font-semibold tabular-nums text-slate-900">{formatMoney(totals.grandTotal)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Messages */}
      {error && <Alert tone="danger">{error}</Alert>}

      {success && <Alert tone="success">{success}</Alert>}

      {/* Buttons */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => router.push(`/purchase-orders/${initialData.purchaseOrderId}`)}
          disabled={submitting}
        >
          ยกเลิก
        </Button>

        <Button type="submit" variant="brand" disabled={submitting} className="sm:min-w-40">
          {submitting ? <LoaderCircle className="animate-spin" /> : <Save />}
          {submitting ? "กำลังสร้าง Invoice..." : "สร้าง Invoice"}
        </Button>
      </div>
    </form>
  );
}
