"use client";

import { useEffect, useState } from "react";

/**
 * Links to the M-T82-01 form PDF (see app/api/invoices/[id]/pdf):
 * preview on the form artwork, download, and data-only for the Epson LQ-630.
 * The print offset is a per-computer setting (each printer feeds paper a little differently),
 * so it is kept in localStorage.
 */
const STORAGE_KEY = "invoice-form-print-offset";
const MAX_OFFSET = 20;

type Offset = { dx: number; dy: number };

function readOffset(): Offset {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && Number.isFinite(saved.dx) && Number.isFinite(saved.dy)) return saved;
  } catch {
    // storage unavailable or corrupted: fall back to no offset
  }
  return { dx: 0, dy: 0 };
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, Math.round(value * 10) / 10));
}

export default function FormPdfActions({ invoiceId }: { invoiceId: string }) {
  const [offset, setOffset] = useState<Offset>({ dx: 0, dy: 0 });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // localStorage only exists in the browser, so the saved offset is loaded after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffset(readOffset());
  }, []);

  function update(next: Offset) {
    const value = { dx: clamp(next.dx), dy: clamp(next.dy) };
    setOffset(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // ignore: the offset still applies for this visit
    }
  }

  const base = `/api/invoices/${invoiceId}/pdf`;
  const printQuery = new URLSearchParams({ mode: "print" });
  if (offset.dx) printQuery.set("dx", String(offset.dx));
  if (offset.dy) printQuery.set("dy", String(offset.dy));

  const button = "rounded-lg px-4 py-2 text-sm font-semibold";

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <a href={base} target="_blank" rel="noopener" className={`${button} bg-slate-700 text-white hover:bg-slate-800`}>
          📄 ดู PDF บนฟอร์ม
        </a>
        <a href={`${base}?download=1`} className={`${button} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
          ↓ ดาวน์โหลด PDF
        </a>
        <a
          href={`${base}?${printQuery}`}
          target="_blank"
          rel="noopener"
          className={`${button} bg-indigo-600 text-white hover:bg-indigo-700`}
          title="เฉพาะข้อมูล สำหรับพิมพ์ลงกระดาษฟอร์ม M-T82-01 (9 × 11 นิ้ว)"
        >
          🖨️ พิมพ์ลงฟอร์ม (LQ-630)
        </a>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          className={`${button} border border-slate-300 bg-white text-slate-600 hover:bg-slate-50`}
          aria-expanded={showSettings}
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <p className="font-semibold text-slate-900">ตั้งค่าการพิมพ์ลงฟอร์ม</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
            <li>กระดาษ 9 × 11 นิ้ว (ตั้งเป็น custom paper size ในไดรเวอร์ LQ-630)</li>
            <li>สั่งพิมพ์แบบ &quot;Actual size / 100%&quot; ห้ามย่อให้พอดีหน้า</li>
            <li>ถ้าข้อมูลไม่ตรงช่อง ให้เลื่อนตำแหน่งด้านล่าง แล้วเปิดไฟล์พิมพ์ใหม่</li>
          </ul>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-500">เลื่อนซ้าย/ขวา (มม., + = ขวา)</span>
              <input
                type="number"
                step="0.5"
                min={-MAX_OFFSET}
                max={MAX_OFFSET}
                value={offset.dx}
                onChange={(e) => update({ ...offset, dx: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">เลื่อนขึ้น/ลง (มม., + = ลง)</span>
              <input
                type="number"
                step="0.5"
                min={-MAX_OFFSET}
                max={MAX_OFFSET}
                value={offset.dy}
                onChange={(e) => update({ ...offset, dy: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          {(offset.dx !== 0 || offset.dy !== 0) && (
            <button
              type="button"
              onClick={() => update({ dx: 0, dy: 0 })}
              className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              รีเซ็ตเป็น 0
            </button>
          )}
        </div>
      )}
    </div>
  );
}
