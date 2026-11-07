import { AlertTriangle, CheckCircle2, Info, Inbox, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "./cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT: Record<AlertTone, { className: string; icon: LucideIcon }> = {
  info: { className: "border-blue-200 bg-blue-50 text-blue-800", icon: Info },
  success: { className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  warning: { className: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle },
  danger: { className: "border-red-200 bg-red-50 text-red-800", icon: XCircle },
};

/** Inline message box. Use tone="danger" for errors returned by the API. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { className: toneClass, icon: Icon } = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", toneClass, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

/** Shown in place of an empty list/table. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="size-6" />
      </div>
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
