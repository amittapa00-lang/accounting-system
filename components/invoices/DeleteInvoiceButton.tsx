"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
  paid: number;
  paymentCount: number;
  /** where to go after deleting (the invoice page itself no longer exists); none = stay and refresh */
  redirectTo?: string;
  /** icon only, for table rows */
  compact?: boolean;
};

/** Deletes an invoice for good, after a confirmation that says what goes with it. */
export default function DeleteInvoiceButton({ invoiceId, invoiceNumber, paid, paymentCount, redirectTo, compact }: Props) {
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  async function remove() {
    const message = [
      `ลบ Invoice ${invoiceNumber} ถาวร?`,
      "ลบแล้วกู้คืนไม่ได้ รายการสินค้า" +
        (paymentCount > 0 ? ` รายการรับชำระ ${paymentCount} รายการ (${formatMoney(paid)} บาท)` : "") +
        " และประวัติการแก้ไขของใบนี้จะถูกลบไปด้วย",
      "จำนวนที่ใบนี้เรียกเก็บจาก Purchase Order จะกลับไปเรียกเก็บในใบใหม่ได้",
    ].join("\n\n");

    if (inFlight.current || !window.confirm(message)) return;

    inFlight.current = true;
    setPending(true);

    let response: Response;
    try {
      response = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
    } catch {
      toast("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ", "danger");
      inFlight.current = false;
      setPending(false);
      return;
    }

    const data: { error?: unknown } = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast(typeof data.error === "string" ? data.error : "ไม่สามารถลบ Invoice ได้", "danger");
      inFlight.current = false;
      setPending(false);
      return;
    }

    toast(`ลบ Invoice ${invoiceNumber} แล้ว`);
    if (redirectTo) {
      router.replace(redirectTo);
      router.refresh();
    } else {
      inFlight.current = false;
      setPending(false);
      router.refresh();
    }
  }

  return (
    <Button
      variant="dangerOutline"
      size={compact ? "sm" : "md"}
      onClick={remove}
      disabled={pending}
      title={`ลบ Invoice ${invoiceNumber}`}
      aria-label={`ลบ Invoice ${invoiceNumber}`}
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
      {!compact && (pending ? "กำลังลบ..." : "ลบ")}
    </Button>
  );
}
