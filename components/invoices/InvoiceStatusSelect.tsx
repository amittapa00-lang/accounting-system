"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/components/ui/cn";
import { Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import {
  documentTypeForStatus,
  INVOICE_STATUS_CHOICES,
  invoiceStatusChoiceLabel,
  type InvoiceStatusChoice,
} from "@/lib/invoices";
import { documentTypeLabel } from "@/lib/labels";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  /** received so far, in baht */
  paid: number;
  /** still owed, in baht */
  remaining: number;
  paymentCount: number;
  /** compact control for table rows */
  size?: "sm" | "md";
  className?: string;
};

/** Colour of the menu for each status (same tones as the status badges). */
const TONE: Record<string, string> = {
  DRAFT: "border-slate-300 bg-slate-50 text-slate-700",
  ISSUED: "border-sky-200 bg-sky-50 text-sky-800",
  PARTIAL: "border-amber-200 bg-amber-50 text-amber-800",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};

/**
 * Status menu of an invoice: ยังไม่วางบิล / วางบิลแล้ว / รับเงินแล้ว / ยกเลิก, from any status.
 * Shows what will happen to the money (payment added or removed) before changing.
 */
export default function InvoiceStatusSelect({
  invoiceId,
  invoiceNumber,
  status,
  paid,
  remaining,
  paymentCount,
  size = "md",
  className,
}: Props) {
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Blocks a second change before React has re-rendered the disabled menu
  const inFlight = useRef(false);

  function confirmMessage(target: InvoiceStatusChoice): string {
    const lines = [
      `เปลี่ยนสถานะ ${invoiceNumber} เป็น "${invoiceStatusChoiceLabel(target)}"?`,
      `ประเภทเอกสารจะเป็น "${documentTypeLabel(documentTypeForStatus(target))}"`,
    ];

    if (status === "CANCELLED") {
      lines.push("Invoice จะกลับมาใช้งาน และนับเป็นยอดที่เรียกเก็บจาก Purchase Order อีกครั้ง");
    }
    if (target === "CANCELLED") {
      lines.push("จำนวนที่ใบนี้เรียกเก็บจาก Purchase Order จะกลับไปเรียกเก็บในใบใหม่ได้");
    }
    if (target === "PAID" && remaining > 0) {
      lines.push(`ระบบจะบันทึกรับชำระ ${formatMoney(remaining)} บาท (ยอดคงเหลือ) ลงวันที่วันนี้`);
    }
    if (target !== "PAID" && paymentCount > 0) {
      lines.push(
        `รายการรับชำระ ${paymentCount} รายการ รวม ${formatMoney(paid)} บาท จะถูกลบ (รายละเอียดเก็บไว้ในประวัติการแก้ไข)`
      );
    }

    return lines.join("\n\n");
  }

  async function change(target: InvoiceStatusChoice) {
    if (inFlight.current || target === status || !window.confirm(confirmMessage(target))) return;

    inFlight.current = true;
    setPending(true);
    setError("");

    const done = (message?: string) => {
      if (message) setError(message);
      inFlight.current = false;
      setPending(false);
    };

    let response: Response;
    try {
      response = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
    } catch {
      done("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
      return;
    }

    const data: { error?: unknown; message?: unknown } = await response.json().catch(() => ({}));
    if (!response.ok) {
      done(typeof data.error === "string" ? data.error : "ไม่สามารถเปลี่ยนสถานะได้");
      return;
    }

    toast(typeof data.message === "string" ? data.message : "เปลี่ยนสถานะแล้ว");
    done();
    // The page re-renders with the new status, totals and history
    router.refresh();
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative">
        <Select
          // controlled by the saved status: a cancelled confirm leaves the menu as it was
          value={status}
          onChange={(event) => change(event.target.value as InvoiceStatusChoice)}
          disabled={pending}
          aria-label={`สถานะ ${invoiceNumber}`}
          className={cn(
            "font-medium",
            TONE[status],
            size === "sm" ? "h-8 w-36 pl-2.5 text-xs" : "w-44 text-sm",
            pending && "pr-9"
          )}
        >
          {/* PARTIAL comes from recording payments: shown as the current value, not offered */}
          {status === "PARTIAL" && (
            <option value="PARTIAL" disabled>
              {invoiceStatusChoiceLabel("PARTIAL")}
            </option>
          )}
          {INVOICE_STATUS_CHOICES.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </Select>
        {pending && (
          <LoaderCircle className="pointer-events-none absolute right-7 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-500" />
        )}
      </div>

      {error && (
        <p role="alert" className="mt-1 max-w-xs text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
