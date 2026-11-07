import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "./cn";

export type ButtonVariant =
  | "primary" // main action of the page (dark)
  | "brand" // the single most important call to action, e.g. "create"
  | "outline" // secondary actions
  | "ghost" // low-emphasis actions inside cards/tables
  | "success" // money received, confirm
  | "danger" // destructive, confirmed elsewhere
  | "dangerOutline"; // destructive but not primary (cancel invoice)

export type ButtonSize = "sm" | "md" | "lg" | "icon";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-slate-900 text-white shadow-sm hover:bg-slate-700",
  brand: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
  outline: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  dangerOutline: "border border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "size-9",
};

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

/** Button classes, for elements that are not <button>/<Link>/<a> (e.g. a <label>). */
export function buttonClasses({ variant = "primary", size = "md", className }: StyleProps = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & StyleProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

/** Internal navigation styled as a button. */
export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

/** Plain <a> styled as a button: downloads, API links, new tabs. */
export function ButtonAnchor({ variant, size, className, ...props }: ComponentProps<"a"> & StyleProps) {
  return <a className={buttonClasses({ variant, size, className })} {...props} />;
}
