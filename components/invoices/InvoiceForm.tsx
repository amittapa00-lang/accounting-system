"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type InvoiceItem = {
  id: string;
  itemNo: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  discountType: string;
  vat: number;
  amount: number;
};

type InvoiceInitialData = {
  purchaseOrderId: string;
  poNumber: string;
  poDate: string;

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

export default function InvoiceForm({
  initialData,
}: InvoiceFormProps) {
  const router = useRouter();

  const [documentType, setDocumentType] = useState(
    "TAX_INVOICE_DELIVERY"
  );

  const [invoiceDate, setInvoiceDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [dueDate, setDueDate] = useState("");

  const [paymentTerm, setPaymentTerm] = useState(
    initialData.paymentTerm
  );

  const [saleOrderNumber, setSaleOrderNumber] =
    useState(initialData.poNumber);

  const [saleName, setSaleName] = useState("");

  const [entryBy, setEntryBy] = useState("");

  const [shipTo, setShipTo] = useState(
    initialData.deliveryPlace
  );

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const formatMoney = (amount: number) => {
    return amount.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const subtotal = initialData.items.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const vatTotal = initialData.items.reduce(
    (sum, item) => {
      return (
        sum +
        item.amount * (item.vat / 100)
      );
    },
    0
  );

  const grandTotal = subtotal + vatTotal;

  const getDiscountText = (item: InvoiceItem) => {
    if (!item.discount || item.discount === 0) {
      return "-";
    }

    if (item.discountType === "PERCENT") {
      return `${formatMoney(item.discount)}%`;
    }

    return formatMoney(item.discount);
  };

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          purchaseOrderId:
            initialData.purchaseOrderId,

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "ไม่สามารถสร้าง Invoice ได้"
        );
      }

      setSuccess("สร้าง Invoice สำเร็จ");

      setTimeout(() => {
        router.push(`/invoices/${data.invoice.id}`);
        router.refresh();
      }, 500);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาด"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Document information */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold text-slate-800">
          ข้อมูลเอกสาร
        </h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              ประเภทเอกสาร
            </label>

            <select
              value={documentType}
              onChange={(event) =>
                setDocumentType(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="TAX_INVOICE_DELIVERY">
                1. ใบกำกับภาษี / ใบส่งของ / ใบแจ้งหนี้
              </option>

              <option value="BILLING_INVOICE">
                2. ใบวางบิล / ใบแจ้งหนี้
              </option>

              <option value="RECEIPT">
                3. ใบเสร็จรับเงิน
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              วันที่ Invoice
            </label>

            <input
              type="date"
              value={invoiceDate}
              onChange={(event) =>
                setInvoiceDate(event.target.value)
              }
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              วันครบกำหนดชำระ
            </label>

            <input
              type="date"
              value={dueDate}
              onChange={(event) =>
                setDueDate(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Payment Term
            </label>

            <input
              type="text"
              value={paymentTerm}
              onChange={(event) =>
                setPaymentTerm(event.target.value)
              }
              placeholder="เช่น เครดิต 30 วัน"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Sale Order No.
            </label>

            <input
              type="text"
              value={saleOrderNumber}
              onChange={(event) =>
                setSaleOrderNumber(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Sale Name
            </label>

            <input
              type="text"
              value={saleName}
              onChange={(event) =>
                setSaleName(event.target.value)
              }
              placeholder="ชื่อ Sales"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Entry By
            </label>

            <input
              type="text"
              value={entryBy}
              onChange={(event) =>
                setEntryBy(event.target.value)
              }
              placeholder="ผู้บันทึก"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Ship To / สถานที่ส่ง
            </label>

            <input
              type="text"
              value={shipTo}
              onChange={(event) =>
                setShipTo(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Customer */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold text-slate-800">
          ข้อมูลลูกค้า
        </h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-500">
              รหัสลูกค้า
            </label>

            <input
              type="text"
              value={initialData.customerCode}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-500">
              ชื่อลูกค้า
            </label>

            <input
              type="text"
              value={initialData.customerName}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-500">
              ที่อยู่
            </label>

            <textarea
              value={initialData.customerAddress}
              readOnly
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-500">
              Tax ID
            </label>

            <input
              type="text"
              value={initialData.customerTaxId}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-500">
              Purchase Order
            </label>

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
            <h2 className="text-lg font-bold text-slate-800">
              รายการสินค้า
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              รายการถูกดึงมาจาก Purchase Order อัตโนมัติ
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-1000px w-full">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3 text-center text-sm">
                  #
                </th>

                <th className="px-4 py-3 text-left text-sm">
                  รายละเอียด
                </th>

                <th className="px-4 py-3 text-right text-sm">
                  Qty
                </th>

                <th className="px-4 py-3 text-left text-sm">
                  Unit
                </th>

                <th className="px-4 py-3 text-right text-sm">
                  Unit Price
                </th>

                <th className="px-4 py-3 text-right text-sm">
                  Discount
                </th>

                <th className="px-4 py-3 text-right text-sm">
                  Amount
                </th>

                <th className="px-4 py-3 text-right text-sm">
                  VAT
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {initialData.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 text-center text-sm text-slate-600">
                    {item.itemNo}
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-800">
                    {item.description}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-700">
                    {item.quantity.toLocaleString(
                      "th-TH"
                    )}
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-600">
                    {item.unit || "-"}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-700">
                    {formatMoney(item.unitPrice)}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-600">
                    {getDiscountText(item)}
                  </td>

                  <td className="px-4 py-4 text-right text-sm font-medium text-slate-800">
                    {formatMoney(item.amount)}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-600">
                    {item.vat}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Summary */}
      <section className="flex justify-end">
        <div className="w-full rounded-xl bg-white p-6 shadow-sm md:w-420px">
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>

              <span>
                {formatMoney(subtotal)}
              </span>
            </div>

            <div className="flex justify-between text-sm text-slate-600">
              <span>VAT</span>

              <span>
                {formatMoney(vatTotal)}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between">
                <span className="font-bold text-slate-800">
                  Grand Total
                </span>

                <span className="text-xl font-bold text-blue-600">
                  {formatMoney(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
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
          onClick={() =>
            router.push(
              `/purchase-orders/${initialData.purchaseOrderId}`
            )
          }
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ยกเลิก
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "กำลังสร้าง Invoice..."
            : "สร้าง Invoice"}
        </button>
      </div>
    </form>
  );
}