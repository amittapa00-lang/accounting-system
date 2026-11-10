"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";

import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/form";

type Props = {
  /** current search (?q=) */
  value: string;
  /** other filters of the list (year, status) kept when the search changes */
  keep: Record<string, string>;
  className?: string;
};

const DEBOUNCE_MS = 300;

/**
 * Search box of the invoice list. Updates ?q= while typing (debounced); the page filters on the
 * server, so the result can be bookmarked and the status summary follows the search.
 */
export default function InvoiceSearch({ value, keep, className }: Props) {
  const router = useRouter();
  const [text, setText] = useState(value);
  const [pending, startTransition] = useTransition();
  const lastSent = useRef(value);

  // Back / forward or a link changed ?q=: show it
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setText(value);
    }
  }, [value]);

  function go(next: string) {
    const q = next.trim();
    if (q === lastSent.current) return;
    lastSent.current = q;
    const params = new URLSearchParams(keep);
    if (q) params.set("q", q);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/invoices?${query}` : "/invoices", { scroll: false });
    });
  }

  // Search as the user types
  useEffect(() => {
    const timer = setTimeout(() => go(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` only reads props and refs
  }, [text]);

  return (
    <form
      role="search"
      className={cn("relative w-full sm:w-80", className)}
      onSubmit={(event) => {
        event.preventDefault();
        go(text);
      }}
    >
      {pending ? (
        <LoaderCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />
      ) : (
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      )}
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="ค้นหา Invoice No., Sale Order, ลูกค้า, PO..."
        aria-label="ค้นหา Invoice"
        className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            go("");
          }}
          aria-label="ล้างคำค้นหา"
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  );
}
