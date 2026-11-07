import Link from "next/link";

/** Logo mark + product name, shown in the sidebar, the mobile bar and the login page. */
export default function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm">
        TC
      </span>
      <span className="min-w-0 leading-tight">
        <span className={inverted ? "block font-semibold text-white" : "block font-semibold text-slate-900"}>
          Accounting
        </span>
        <span className={inverted ? "block truncate text-xs text-slate-300" : "block truncate text-xs text-slate-500"}>
          TC Engineering &amp; Trading
        </span>
      </span>
    </Link>
  );
}
