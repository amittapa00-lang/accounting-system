"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "./cn";

/**
 * Small notifications in the corner, replacing window.alert().
 * <Toaster /> is mounted once in app/(main)/layout.tsx and survives client navigation,
 * so `toast(...)` right before `router.push(...)` shows the message on the next page.
 */
type ToastTone = "success" | "danger" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

const DURATION_MS = 4000;
const EMPTY: ToastItem[] = [];

let items: ToastItem[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function dismissToast(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

export function toast(message: string, tone: ToastTone = "success") {
  const id = nextId++;
  items = [...items, { id, message, tone }];
  emit();
  setTimeout(() => dismissToast(id), DURATION_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const TONES: Record<ToastTone, { className: string; icon: typeof Info }> = {
  success: { className: "border-emerald-200 text-emerald-800", icon: CheckCircle2 },
  danger: { className: "border-red-200 text-red-800", icon: XCircle },
  info: { className: "border-slate-200 text-slate-800", icon: Info },
};

export function Toaster() {
  const current = useSyncExternalStore(subscribe, () => items, () => EMPTY);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end print:hidden"
    >
      {current.map((item) => {
        const { className, icon: Icon } = TONES[item.tone];
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg",
              className
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1 font-medium">{item.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              aria-label="ปิด"
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
