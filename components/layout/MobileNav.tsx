"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Menu, Plus, X } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";

import AppNav, { NavLinks } from "./AppNav";

/** Top bar with a slide-out menu, for screens narrower than the sidebar breakpoint (lg). */
export default function MobileNav({ brand, user }: { brand: ReactNode; user: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนู">
          <div className="absolute inset-0 bg-slate-900/40" onClick={close} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              {brand}
              <button
                type="button"
                onClick={close}
                aria-label="ปิดเมนู"
                className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="px-3 pt-4">
              <ButtonLink href="/purchase-orders/new" variant="brand" className="w-full" onClick={close}>
                <Plus /> สร้าง PO ใหม่
              </ButtonLink>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <Suspense fallback={<NavLinks pathname={null} onNavigate={close} />}>
                <AppNav onNavigate={close} />
              </Suspense>
            </div>

            <div className="border-t border-slate-200 p-3">{user}</div>
          </div>
        </div>
      )}
    </>
  );
}
