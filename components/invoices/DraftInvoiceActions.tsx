"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Action = "issue" | "cancel";

const ACTIONS: Record<
  Action,
  { path: string; confirm: string; success: string; failure: string; idle: string; busy: string; className: string }
> = {
  issue: {
    path: "issue",
    confirm: "ยืนยันการออก Invoice?\n\nหลังจากออก Invoice แล้ว สถานะจะเปลี่ยนจาก DRAFT เป็น ISSUED และยกเลิกไม่ได้",
    success: "ออก Invoice สำเร็จ",
    failure: "ไม่สามารถออก Invoice ได้",
    idle: "ออก Invoice",
    busy: "กำลังออก Invoice...",
    className: "bg-blue-600 text-white hover:bg-blue-700",
  },
  cancel: {
    path: "cancel",
    confirm:
      "ยืนยันการยกเลิก Invoice ฉบับร่างนี้?\n\nเลข Invoice นี้จะถูกยกเลิก และสามารถสร้าง Invoice ใหม่จาก Purchase Order เดิมได้",
    success: "ยกเลิก Invoice สำเร็จ",
    failure: "ไม่สามารถยกเลิก Invoice ได้",
    idle: "ยกเลิก Invoice",
    busy: "กำลังยกเลิก...",
    className: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  },
};

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

    alert(config.success);

    // Stay disabled: the page re-renders with the new status and these buttons disappear
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {(Object.keys(ACTIONS) as Action[]).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => run(action)}
            disabled={pending !== null}
            className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${ACTIONS[action].className}`}
          >
            {pending === action ? ACTIONS[action].busy : ACTIONS[action].idle}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
