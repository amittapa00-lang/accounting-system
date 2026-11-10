"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CircleCheck,
  CircleEllipsis,
  Coins,
  CreditCard,
  Landmark,
  LoaderCircle,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { DetailList, Money } from "@/components/ui/data-display";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, labelClass } from "@/components/ui/form";
import { formatMoney, todayInputValue } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/labels";
import { compareMoney } from "@/lib/money";
import { exceedsRemainingMessage, parsePaymentAmount, parsePaymentDate } from "@/lib/payments";
import { toast } from "@/components/ui/toast";

type PaymentFormProps = {
  invoice: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    /** Invoice status, shown as a badge in the summary. */
    status: string;
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

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  TRANSFER: Landmark,
  CASH: Banknote,
  CHEQUE: ScrollText,
  CREDIT_CARD: CreditCard,
  OTHER: CircleEllipsis,
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

  // Display only: share of the invoice already paid, for the progress bar.
  const paidPercent =
    invoice.grandTotal > 0
      ? Math.min(100, Math.max(0, (invoice.totalPaid / invoice.grandTotal) * 100))
      : 0;

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

      toast("บันทึกการรับชำระเงินสำเร็จ");

      // Back to the payment list. Keep the button disabled (loading stays true) until it has loaded,
      // otherwise a second click during navigation would record the payment twice.
      router.push("/payments");

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
      className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3"
    >
      {/* ===================================== */}
      {/* Payment Information (left) */}
      {/* ===================================== */}

      <Card className="xl:col-span-2">
        <CardHeader title="ข้อมูลการรับชำระเงิน" />

        <CardBody className="space-y-6">
          {/* Invoice cannot receive payments */}
          {blockedReason && <Alert tone="warning">{blockedReason}</Alert>}

          {/* Amount */}
          <Field label="จำนวนเงิน" htmlFor="payment-amount" required>
            <div className="relative">
              <Input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                max={invoice.remainingAmount.toFixed(2)}
                step="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                required
                aria-describedby="payment-amount-hint"
                className="h-14 pr-14 text-right font-semibold tabular-nums text-2xl! [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-sm font-medium text-slate-400">
                บาท
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p id="payment-amount-hint" className="text-xs text-slate-500">
                ยอดคงเหลือสูงสุด{" "}
                <Money className="font-medium text-slate-700">{formatMoney(invoice.remainingAmount)}</Money>{" "}
                บาท
              </p>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmount(invoice.remainingAmount.toFixed(2))}
                disabled={loading || !canPay}
              >
                <Coins /> รับเต็มจำนวนคงเหลือ
              </Button>
            </div>
          </Field>

          {/* Payment Method */}
          <fieldset>
            <legend className={labelClass}>
              วิธีชำระเงิน
              <span className="ml-0.5 text-red-500">*</span>
            </legend>

            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = METHOD_ICONS[method.value];
                const checked = paymentMethod === method.value;

                return (
                  <label
                    key={method.value}
                    className={cn(
                      "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium shadow-sm transition-colors",
                      "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-slate-400",
                      checked
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-500"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={checked}
                      onChange={() => setPaymentMethod(method.value)}
                      required
                      className="sr-only"
                    />
                    <Icon className={cn("size-4", checked ? "text-emerald-600" : "text-slate-400")} />
                    {method.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Payment Date */}
            <Field label="วันที่รับชำระเงิน" htmlFor="payment-date" required>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                max={todayInputValue()}
                onChange={(event) =>
                  setPaymentDate(
                    event.target.value
                  )
                }
                required
              />
            </Field>

            {/* Reference Number */}
            <Field label="เลขที่อ้างอิง" htmlFor="payment-reference">
              <Input
                id="payment-reference"
                type="text"
                value={referenceNumber}
                onChange={(event) =>
                  setReferenceNumber(
                    event.target.value
                  )
                }
                placeholder="เช่น เลขที่สลิป / เลขที่เช็ค"
              />
            </Field>

            {/* Received By */}
            <Field label="ผู้รับเงิน" htmlFor="payment-received-by">
              <Input
                id="payment-received-by"
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
              />
            </Field>

            {/* Note */}
            <Field label="หมายเหตุ" htmlFor="payment-note">
              <Input
                id="payment-note"
                type="text"
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder="หมายเหตุเพิ่มเติม"
              />
            </Field>
          </div>

          {/* Error */}
          {error && <Alert tone="danger">{error}</Alert>}
        </CardBody>

        {/* Buttons */}
        <CardFooter className="flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              router.push(
                `/invoices/${invoice.id}`
              )
            }
            disabled={loading}
            className="w-full sm:w-auto"
          >
            ยกเลิก
          </Button>

          <Button
            type="submit"
            variant="success"
            size="lg"
            disabled={loading || !canPay}
            className="w-full sm:w-auto"
          >
            {loading ? <LoaderCircle className="animate-spin" /> : <CircleCheck />}
            {loading
              ? "กำลังบันทึก..."
              : "บันทึกการรับชำระเงิน"}
          </Button>
        </CardFooter>
      </Card>

      {/* ===================================== */}
      {/* Invoice Summary (right; on top on small screens) */}
      {/* ===================================== */}

      <aside className="order-first min-w-0 xl:sticky xl:top-8 xl:order-none">
        <Card>
          <CardHeader
            title="ข้อมูล Invoice"
            actions={<InvoiceStatusBadge status={invoice.status} />}
          />

          <CardBody className="space-y-5">
            <DetailList
              className="-mt-2.5"
              items={[
                {
                  label: "Invoice No.",
                  value: (
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="text-slate-900 underline-offset-4 hover:text-brand-700 hover:underline"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  ),
                },
                { label: "ลูกค้า", value: invoice.customerName },
                {
                  label: "ยอด Invoice",
                  value: <Money>{formatMoney(invoice.grandTotal)} บาท</Money>,
                },
                {
                  label: "ชำระแล้ว",
                  value: <Money className="text-emerald-700">{formatMoney(invoice.totalPaid)} บาท</Money>,
                },
              ]}
            />

            {/* Paid / total */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                <span>ความคืบหน้าการชำระ</span>
                <span className="font-medium tabular-nums text-slate-700">{Math.floor(paidPercent)}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="สัดส่วนที่ชำระแล้ว"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor(paidPercent)}
                className="h-2 overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width]"
                  style={{ width: `${paidPercent}%` }}
                />
              </div>
            </div>

            {/* Remaining */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-500">ยอดคงเหลือ</p>
              <p className="mt-0.5 break-words text-3xl font-semibold tabular-nums text-slate-900">
                {formatMoney(invoice.remainingAmount)}{" "}
                <span className="text-base font-normal text-slate-500">บาท</span>
              </p>
            </div>
          </CardBody>
        </Card>
      </aside>
    </form>
  );
}
