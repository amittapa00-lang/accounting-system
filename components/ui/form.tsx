import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";

/** Shared look for text inputs, selects and textareas. Use the components below, or these classes directly. */
export const controlClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm " +
  "placeholder:text-slate-400 transition-colors " +
  "focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 " +
  "read-only:bg-slate-50 aria-invalid:border-red-400 aria-invalid:ring-red-100";

export const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

// Inputs and selects share one fixed height so they line up in the same row
// (a native <select> is otherwise a few pixels taller). Override with e.g. className="h-14".
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-10 py-0", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClass, "h-10 py-0 pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-20", className)} {...props} />;
}

/** Label + control + hint/error. Pass the control as children and the same id as `htmlFor`. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
