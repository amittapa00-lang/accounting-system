"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send, XCircle, type LucideIcon } from "lucide-react";

import { Button, type ButtonVariant } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type Action = "issue" | "cancel";

const ACTIONS: Record<
  Action,
  {
    path: string;
    confirm: string;
    success: string;
    failure: string;
    idle: string;
    busy: string;
    variant: ButtonVariant;
    icon: LucideIcon;
  }
> = {
  issue: {
    path: "issue",
    confirm: "ยืนยันการออก Invoice?\n\nหลังจากออก Invoice แล้ว สถานะจะเปลี่ยนจาก DRAFT เป็น ISSUED และยกเลิกไม่ได้",
    success: "ออก Invoice สำเร็จ",
    failure: "ไม่สามารถออก Invoice ได้",
    idle: "ออก Invoice",
    busy: "กำลังออก Invoice...",
    variant: "primary",
    icon: Send,
  },
  cancel: {
    path: "cancel",
    confirm:
      "ยืนยันการยกเลิก Invoice ฉบับร่างนี้?\n\nเลข Invoice นี้จะถูกยกเลิก และสามารถสร้าง Invoice ใหม่จาก Purchase Order เดิมได้",
    success: "ยกเลิก Invoice สำเร็จ",
    failure: "ไม่สามารถยกเลิก Invoice ได้",
    idle: "ยกเลิก Invoice",
    busy: "กำลังยกเลิก...",
    variant: "dangerOutline",
    icon: XCircle,
  },
};

/** Display order: the main action ("ออก Invoice") last, so it sits right-most. */
const ORDER: Action[] = ["cancel", "issue"];

/** "ออก Invoice" and "ยกเลิก Invoice" buttons for a DRAFT invoice. */
export default function DraftInvoiceActions({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();

  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState("");

  // Blocks a second click before React has re-rendered the disabled buttons
  const inFlight = useRef(false);

  async function run(action: Action) {
    const config = ACTIONS[action];

    if (inFlight.current || !window.confirm(config.confirm)) {
      return;
    }

    inFlight.current = true;
    setPending(action);
    setError("");

    const fail = (message: string) => {
      setError(message);
      inFlight.current = false;
      setPending(null);
    };

    let response: Response;
    try {
      response = await fetch(`/api/invoices/${invoiceId}/${config.path}`, { method: "POST" });
    } catch {
      fail("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
      return;
    }

    const data: { error?: unknown } = await response.json().catch(() => ({}));

    if (!response.ok) {
      fail(typeof data.error === "string" ? data.error : config.failure);
      return;
    }

    toast(config.success);

    // Stay disabled: the page re-renders with the new status and these buttons disappear
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {ORDER.map((action) => {
          const { variant, icon: Icon, busy, idle } = ACTIONS[action];
          return (
            <Button key={action} variant={variant} onClick={() => run(action)} disabled={pending !== null}>
              {pending === action ? <LoaderCircle className="animate-spin" /> : <Icon />}
              {pending === action ? busy : idle}
            </Button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="max-w-sm text-sm text-red-600 sm:text-right">
          {error}
        </p>
      )}
    </div>
  );
}
