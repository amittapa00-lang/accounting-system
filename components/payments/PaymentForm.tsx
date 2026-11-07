"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatMoney, todayInputValue } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/labels";
import { compareMoney } from "@/lib/money";
import { exceedsRemainingMessage, parsePaymentAmount, parsePaymentDate } from "@/lib/payments";

type PaymentFormProps = {
  invoice: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    grandTotal: number;
    totalPaid: number;
    /** Exact outstanding amount (2 decimals), from paymentSummary. */
    remainingAmount: number;
  };
  /** Why this invoice cannot receive a payment (draft, cancelled, paid), or null. */
  blockedReason: string | null;
  /** Used as "ผู้รับเงิน" when the field is left blank. */
  currentUserName: string;
};

/** Reads `{ error }` from a response; returns null when the body is not JSON (e.g. an HTML error page). */
async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // not JSON
  }
  return null;
}

export default function PaymentForm({
  invoice,
  blockedReason,
  currentUserName,
}: PaymentFormProps) {
  const router = useRouter();

  const [paymentDate, setPaymentDate] = useState(todayInputValue);

  // Exact remaining amount, so submitting the prefilled value always settles the invoice.
  const [amount, setAmount] = useState(
    invoice.remainingAmount.toFixed(2)
  );

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("TRANSFER");

  const [referenceNumber, setReferenceNumber] =
    useState("");

  const [note, setNote] = useState("");

  const [receivedBy, setReceivedBy] =
    useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // Guards against a second submit before React re-renders the disabled button.
  const submittingRef = useRef(false);

  const canPay = !blockedReason && invoice.remainingAmount > 0;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submittingRef.current || !canPay) {
      return;
    }

    setError("");

    const parsedAmount = parsePaymentAmount(amount);

    if ("error" in parsedAmount) {
      setError(parsedAmount.error);
      return;
    }

    if (compareMoney(parsedAmount.amount, invoice.remainingAmount) > 0) {
      setError(exceedsRemainingMessage(invoice.remainingAmount));
      return;
    }

    const parsedDate = parsePaymentDate(paymentDate);

    if ("error" in parsedDate) {
      setError(parsedDate.error);
      return;
    }

    submittingRef.current = true;
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
            amount: parsedAmount.amount,
            paymentMethod,
            referenceNumber,
            note,
            receivedBy,
          }),
        }
      );

      if (!response.ok) {
        const message = await readErrorMessage(response);

        setError(
          message ||
            `ไม่สามารถบันทึกการรับชำระเงินได้ (รหัส ${response.status})`
        );

        submittingRef.current = false;
        setLoading(false);
        return;
      }

      alert("บันทึกการรับชำระเงินสำเร็จ");

      // Keep the button disabled (loading stays true) until the invoice page has loaded,
      // otherwise a second click during navigation would record the payment twice.
      router.push(
        `/invoices/${invoice.id}`
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setError(
        "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ"
      );

      submittingRef.current = false;
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
              {formatMoney(invoice.grandTotal)} บาท
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              ชำระแล้ว
            </p>

            <p className="font-semibold text-emerald-600">
              {formatMoney(invoice.totalPaid)} บาท
            </p>
          </div>

          <div className="md:col-span-2">
            <p className="text-sm text-slate-500">
              ยอดคงเหลือ
            </p>

            <p className="text-2xl font-bold text-red-600">
              {formatMoney(invoice.remainingAmount)} บาท
            </p>
          </div>
        </div>
      </div>

      {/* ===================================== */}
      {/* Invoice cannot receive payments */}
      {/* ===================================== */}

      {blockedReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {blockedReason}
        </div>
      )}

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
              max={todayInputValue()}
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
              max={invoice.remainingAmount.toFixed(2)}
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
              {formatMoney(invoice.remainingAmount)}{" "}
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
                  event.target.value as PaymentMethod
                )
              }
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
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
              placeholder={
                currentUserName
                  ? `เว้นว่างไว้ = ${currentUserName}`
                  : "ชื่อผู้รับเงิน"
              }
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
          disabled={loading || !canPay}
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
