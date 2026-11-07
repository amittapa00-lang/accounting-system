"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Download, FileText, Printer, RotateCcw, Settings2 } from "lucide-react";

import { Button, ButtonAnchor } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Field, Input } from "@/components/ui/form";

/**
 * Links to the M-T82-01 form PDF (see app/api/invoices/[id]/pdf):
 * preview on the form artwork, download, and data-only for the Epson LQ-630.
 * The print offset is a per-computer setting (each printer feeds paper a little differently),
 * so it is kept in localStorage.
 *
 * Rendered as its own card (title, the three PDF links and the collapsible offset settings).
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

  const hasOffset = offset.dx !== 0 || offset.dy !== 0;

  return (
    <Card>
      <CardHeader
        title="พิมพ์เอกสาร"
        description="ฟอร์ม M-T82-01"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
            aria-controls="form-print-settings"
            title="ตั้งค่าการพิมพ์ลงฟอร์ม"
          >
            <Settings2 /> ตั้งค่า
            <ChevronDown className={cn("transition-transform", showSettings && "rotate-180")} />
          </Button>
        }
      />

      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <ButtonAnchor href={base} target="_blank" rel="noopener" variant="outline" className="justify-start">
            <FileText /> ดู PDF บนฟอร์ม
          </ButtonAnchor>

          <ButtonAnchor href={`${base}?download=1`} variant="outline" className="justify-start">
            <Download /> ดาวน์โหลด PDF
          </ButtonAnchor>

          <ButtonAnchor
            href={`${base}?${printQuery}`}
            target="_blank"
            rel="noopener"
            variant="outline"
            className="justify-start"
            title="เฉพาะข้อมูล สำหรับพิมพ์ลงกระดาษฟอร์ม M-T82-01 (9 × 11 นิ้ว)"
          >
            <Printer /> พิมพ์ลงฟอร์ม (LQ-630)
          </ButtonAnchor>
        </div>

        {hasOffset && !showSettings && (
          <p className="text-xs text-slate-500">
            ใช้ตำแหน่งพิมพ์ที่ตั้งไว้: ซ้าย/ขวา {offset.dx} มม., ขึ้น/ลง {offset.dy} มม.
          </p>
        )}

        {showSettings && (
          <div
            id="form-print-settings"
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
          >
            <p className="font-semibold text-slate-900">ตั้งค่าการพิมพ์ลงฟอร์ม</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
              <li>กระดาษ 9 × 11 นิ้ว (ตั้งเป็น custom paper size ในไดรเวอร์ LQ-630)</li>
              <li>สั่งพิมพ์แบบ &quot;Actual size / 100%&quot; ห้ามย่อให้พอดีหน้า</li>
              <li>ถ้าข้อมูลไม่ตรงช่อง ให้เลื่อนตำแหน่งด้านล่าง แล้วเปิดไฟล์พิมพ์ใหม่</li>
            </ul>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="เลื่อนซ้าย/ขวา (มม., + = ขวา)" htmlFor="form-print-dx" className="min-w-0">
                <Input
                  id="form-print-dx"
                  type="number"
                  step="0.5"
                  min={-MAX_OFFSET}
                  max={MAX_OFFSET}
                  value={offset.dx}
                  onChange={(e) => update({ ...offset, dx: Number(e.target.value) })}
                  className="text-right tabular-nums"
                />
              </Field>

              <Field label="เลื่อนขึ้น/ลง (มม., + = ลง)" htmlFor="form-print-dy" className="min-w-0">
                <Input
                  id="form-print-dy"
                  type="number"
                  step="0.5"
                  min={-MAX_OFFSET}
                  max={MAX_OFFSET}
                  value={offset.dy}
                  onChange={(e) => update({ ...offset, dy: Number(e.target.value) })}
                  className="text-right tabular-nums"
                />
              </Field>
            </div>

            {hasOffset && (
              <Button variant="ghost" size="sm" onClick={() => update({ dx: 0, dy: 0 })} className="mt-3 -ml-2">
                <RotateCcw /> รีเซ็ตเป็น 0
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
