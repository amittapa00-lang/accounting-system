import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { Tone } from "@/lib/labels";

import { cn } from "./cn";

/** Label / value rows, e.g. invoice information. */
export function DetailList({
  items,
  className,
}: {
  items: { label: ReactNode; value: ReactNode; hidden?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-slate-100", className)}>
      {items
        .filter((item) => !item.hidden)
        .map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-sm text-slate-500">{item.label}</dt>
            <dd className="min-w-0 text-right text-sm font-medium text-slate-900">{item.value ?? "-"}</dd>
          </div>
        ))}
    </dl>
  );
}

/** Label above value, for addresses and other long text. */
export function DetailBlock({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-0.5 whitespace-pre-line text-sm text-slate-900">{children || "-"}</div>
    </div>
  );
}

const ICON_TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-blue-50 text-blue-600",
  warning: "bg-amber-50 text-amber-600",
  success: "bg-emerald-50 text-emerald-600",
  danger: "bg-red-50 text-red-600",
  brand: "bg-brand-50 text-brand-600",
};

/** Big number with an icon, e.g. on the dashboard. Becomes a link when `href` is set. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-lg", ICON_TONES[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );

  const className = "block rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

  return href ? (
    <Link href={href} className={cn(className, "transition hover:border-slate-300 hover:shadow-md")}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** Baht amount with the currency sign and tabular digits. */
export function Money({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{children}</span>;
}
