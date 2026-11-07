"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
      {/* Document information */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold text-slate-800">ข้อมูลเอกสาร</h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">ประเภทเอกสาร</label>

            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              {DOCUMENT_TYPES.map((type, index) => (
                <option key={type.value} value={type.value}>
                  {index + 1}. {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">วันที่ Invoice</label>

            <input
              type="date"
              value={invoiceDate}
              onChange={(event) => setInvoiceDate(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">วันครบกำหนดชำระ</label>

            <input
              type="date"
              value={dueDate}
              min={invoiceDate || undefined}
              onChange={(event) => setDueDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Payment Term</label>

            <input
              type="text"
              value={paymentTerm}
              onChange={(event) => setPaymentTerm(event.target.value)}
              placeholder="เช่น เครดิต 30 วัน"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Sale Order No.</label>

            <input
              type="text"
              value={saleOrderNumber}
              onChange={(event) => setSaleOrderNumber(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Sale Name</label>

            <input
              type="text"
              value={saleName}
              onChange={(event) => setSaleName(event.target.value)}
              placeholder="ชื่อ Sales"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Entry By</label>

            <input
              type="text"
              value={entryBy}
              onChange={(event) => setEntryBy(event.target.value)}
              placeholder="ผู้บันทึก"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Ship To / สถานที่ส่ง</label>

            <input
              type="text"
              value={shipTo}
              onChange={(event) => setShipTo(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Customer */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold text-slate-800">ข้อมูลลูกค้า</h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-500">รหัสลูกค้า</label>

            <input
              type="text"
              value={initialData.customerCode}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-500">ชื่อลูกค้า</label>

            <input
              type="text"
              value={initialData.customerName}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-500">ที่อยู่</label>

            <textarea
              value={initialData.customerAddress}
              readOnly
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-500">Tax ID</label>

            <input
              type="text"
              value={initialData.customerTaxId}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-500">Purchase Order</label>

            <input
              type="text"
              value={initialData.poNumber}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">รายการสินค้า</h2>

            <p className="mt-1 text-sm text-slate-500">รายการถูกดึงมาจาก Purchase Order อัตโนมัติ</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3 text-center text-sm">#</th>
                <th className="px-4 py-3 text-left text-sm">รายละเอียด</th>
                <th className="px-4 py-3 text-right text-sm">Qty</th>
                <th className="px-4 py-3 text-left text-sm">Unit</th>
                <th className="px-4 py-3 text-right text-sm">Unit Price</th>
                <th className="px-4 py-3 text-right text-sm">Discount</th>
                <th className="px-4 py-3 text-right text-sm">Amount</th>
                <th className="px-4 py-3 text-right text-sm">VAT</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {lines.map(({ item, amount }) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 text-center text-sm text-slate-600">{item.itemNo}</td>

                  <td className="whitespace-pre-line px-4 py-4 text-sm text-slate-800">{item.description}</td>

                  <td className="px-4 py-4 text-right text-sm text-slate-700">{formatQuantity(item.quantity)}</td>

                  <td className="px-4 py-4 text-sm text-slate-600">{item.unit || "-"}</td>

                  <td className="px-4 py-4 text-right text-sm text-slate-700">{formatMoney(item.unitPrice)}</td>

                  <td className="px-4 py-4 text-right text-sm text-slate-600">
                    {formatLineDiscount(item.discount, item.discountType) || "-"}
                  </td>

                  <td className="px-4 py-4 text-right text-sm font-medium text-slate-800">{formatMoney(amount)}</td>

                  <td className="px-4 py-4 text-right text-sm text-slate-600">{item.vat}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Summary */}
      <section className="flex justify-end">
        <div className="w-full rounded-xl bg-white p-6 shadow-sm md:w-[420px]">
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>

            <div className="flex justify-between text-sm text-slate-600">
              <span>VAT</span>
              <span>{formatMoney(totals.vat)}</span>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between">
                <span className="font-bold text-slate-800">Grand Total</span>
                <span className="text-xl font-bold text-blue-600">{formatMoney(totals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(`/purchase-orders/${initialData.purchaseOrderId}`)}
          disabled={submitting}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ยกเลิก
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "กำลังสร้าง Invoice..." : "สร้าง Invoice"}
        </button>
      </div>
    </form>
  );
}
