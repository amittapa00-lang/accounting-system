"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Download,
  FileText,
  Printer,
  RotateCcw,
  Settings2,
  type LucideIcon,
} from "lucide-react";

import { Button, ButtonAnchor } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/form";

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

const STEP = 0.5;

/** "ขวา 2 มม., ขึ้น 1.5 มม." */
function describeOffset({ dx, dy }: Offset) {
  const parts: string[] = [];
  if (dx) parts.push(`${dx > 0 ? "ขวา" : "ซ้าย"} ${Math.abs(dx)} มม.`);
  if (dy) parts.push(`${dy > 0 ? "ลง" : "ขึ้น"} ${Math.abs(dy)} มม.`);
  return parts.join(", ");
}

/** "-", "-4", "4.", "4.5" are fine while typing; only complete numbers are applied. */
const PARTIAL_NUMBER = /^-?\d*(\.\d*)?$/;

/**
 * One axis of the print offset: [← less] [number] [more →].
 * A plain controlled <input type="number"> cannot accept a typed "-" (the half-typed value
 * reads as empty and snaps back to 0), so the text being typed is kept separately.
 */
function OffsetControl({
  id,
  label,
  lessLabel,
  moreLabel,
  LessIcon,
  MoreIcon,
  value,
  onChange,
}: {
  id: string;
  label: string;
  lessLabel: string;
  moreLabel: string;
  LessIcon: LucideIcon;
  MoreIcon: LucideIcon;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function step(direction: -1 | 1) {
    setDraft(null);
    onChange(clamp(value + direction * STEP));
  }

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} <span className="font-normal text-slate-500">(มม.)</span>
      </label>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label={`เลื่อน${lessLabel} ${STEP} มม.`}>
          <LessIcon /> {lessLabel}
        </Button>
        <Input
          id={id}
          inputMode="decimal"
          value={draft ?? String(value)}
          onChange={(e) => {
            const text = e.target.value.trim();
            if (!PARTIAL_NUMBER.test(text)) return;
            setDraft(text);
            const n = Number(text);
            if (text !== "" && text !== "-" && Number.isFinite(n)) onChange(clamp(n));
          }}
          onBlur={() => setDraft(null)}
          className="h-8 min-w-0 flex-1 text-center tabular-nums"
        />
        <Button variant="outline" size="sm" onClick={() => step(1)} aria-label={`เลื่อน${moreLabel} ${STEP} มม.`}>
          {moreLabel} <MoreIcon />
        </Button>
      </div>
    </div>
  );
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
          <p className="text-xs text-slate-500">ใช้ตำแหน่งพิมพ์ที่ตั้งไว้: {describeOffset(offset)}</p>
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

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <OffsetControl
                id="form-print-dx"
                label="ซ้าย / ขวา"
                lessLabel="ซ้าย"
                moreLabel="ขวา"
                LessIcon={ArrowLeft}
                MoreIcon={ArrowRight}
                value={offset.dx}
                onChange={(dx) => update({ ...offset, dx })}
              />
              <OffsetControl
                id="form-print-dy"
                label="ขึ้น / ลง"
                lessLabel="ขึ้น"
                moreLabel="ลง"
                LessIcon={ArrowUp}
                MoreIcon={ArrowDown}
                value={offset.dy}
                onChange={(dy) => update({ ...offset, dy })}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">กดลูกศรครั้งละ {STEP} มม. หรือพิมพ์ตัวเลขเอง (ติดลบได้)</p>

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
