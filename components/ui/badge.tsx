import type { ReactNode } from "react";

import {
  invoiceStatusLabel,
  invoiceStatusTone,
  poStatusLabel,
  poStatusTone,
  type Tone,
} from "@/lib/labels";

import { cn } from "./cn";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-slate-400",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-red-500",
  brand: "bg-brand-500",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={invoiceStatusTone(status)} dot>
      {invoiceStatusLabel(status)}
    </Badge>
  );
}

export function PoStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={poStatusTone(status)} dot>
      {poStatusLabel(status)}
    </Badge>
  );
}
