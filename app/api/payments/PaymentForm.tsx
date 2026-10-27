"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentFormProps = {
  invoice: {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    grandTotal: number;
    totalPaid: number;
    remainingAmount: number;
    customerName: string;
  };
};

export default function PaymentForm({
  invoice,
}: PaymentFormProps) {
  const router = useRouter();

  const [paymentDate, setPaymentDate] = useState(() => {
    const today = new Date();

    return today.toISOString().split("T")[0];
  });

  const [amount, setAmount] = useState(
    invoice.remainingAmount.toFixed(2)
  );

  const [paymentMethod, setPaymentMethod] =
    useState("TRANSFER");

  const [referenceNumber, setReferenceNumber] =
    useState("");

  const [note, setNote] = useState("");

  const [receivedBy, setReceivedBy] =
    useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/payments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoiceId: invoice.id,
            paymentDate,
            amount: Number(amount),
            paymentMethod,
            referenceNumber,
            note,
            receivedBy,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "ไม่สามารถบันทึกการรับชำระเงินได้"
        );

        return;
      }

      alert("บันทึกการรับชำระเงินสำเร็จ");

      router.push(
        `/invoices/${invoice.id}`
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setError(
        "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* ===================================== */}
      {/* Invoice Summary */}
      {/* ===================================== */}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-800">
          ข้อมูล Invoice
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">
              Invoice No.
            </p>

            <p className="font-semibold text-slate-800">
              {invoice.invoiceNumber}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              ลูกค้า
            </p>

            <p className="font-semibold text-slate-800">
              {invoice.customerName}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              ยอด Invoice
            </p>

            <p className="font-semibold text-slate-800">
              {invoice.grandTotal.toLocaleString(
                "th-TH",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}{" "}
              บาท
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              ชำระแล้ว
            </p>

            <p className="font-semibold text-emerald-600">
              {invoice.totalPaid.toLocaleString(
                "th-TH",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}{" "}
              บาท
            </p>
          </div>

          <div className="md:col-span-2">
            <p className="text-sm text-slate-500">
              ยอดคงเหลือ
            </p>

            <p className="text-2xl font-bold text-red-600">
              {invoice.remainingAmount.toLocaleString(
                "th-TH",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}{" "}
              บาท
            </p>
          </div>
        </div>
      </div>

      {/* ===================================== */}
      {/* Payment Information */}
      {/* ===================================== */}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-5 text-lg font-bold text-slate-800">
          ข้อมูลการรับชำระเงิน
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Payment Date */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              วันที่รับชำระเงิน
            </label>

            <input
              type="date"
              value={paymentDate}
              onChange={(event) =>
                setPaymentDate(
                  event.target.value
                )
              }
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          {/* Amount */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              จำนวนเงิน
            </label>

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />

            <p className="mt-1 text-xs text-slate-500">
              ยอดคงเหลือสูงสุด{" "}
              {invoice.remainingAmount.toLocaleString(
                "th-TH",
                {
                  minimumFractionDigits: 2,
                }
              )}{" "}
              บาท
            </p>
          </div>

          {/* Payment Method */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              วิธีชำระเงิน
            </label>

            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(
                  event.target.value
                )
              }
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="TRANSFER">
                โอนเงิน
              </option>

              <option value="CASH">
                เงินสด
              </option>

              <option value="CHEQUE">
                เช็ค
              </option>

              <option value="CREDIT_CARD">
                บัตรเครดิต
              </option>

              <option value="OTHER">
                อื่น ๆ
              </option>
            </select>
          </div>

          {/* Reference Number */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              เลขที่อ้างอิง
            </label>

            <input
              type="text"
              value={referenceNumber}
              onChange={(event) =>
                setReferenceNumber(
                  event.target.value
                )
              }
              placeholder="เช่น เลขที่สลิป / เลขที่เช็ค"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          {/* Received By */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              ผู้รับเงิน
            </label>

            <input
              type="text"
              value={receivedBy}
              onChange={(event) =>
                setReceivedBy(
                  event.target.value
                )
              }
              placeholder="ชื่อผู้รับเงิน"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          {/* Note */}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              หมายเหตุ
            </label>

            <input
              type="text"
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              placeholder="หมายเหตุเพิ่มเติม"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ===================================== */}
      {/* Error */}
      {/* ===================================== */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ===================================== */}
      {/* Buttons */}
      {/* ===================================== */}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() =>
            router.push(
              `/invoices/${invoice.id}`
            )
          }
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          ยกเลิก
        </button>

        <button
          type="submit"
          disabled={
            loading ||
            invoice.remainingAmount <= 0
          }
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "กำลังบันทึก..."
            : "บันทึกการรับชำระเงิน"}
        </button>
      </div>
    </form>
  );
}