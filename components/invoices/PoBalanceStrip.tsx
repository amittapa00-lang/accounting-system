import { cn } from "@/components/ui/cn";
import { formatMoney } from "@/lib/format";

/**
 * Shown above the lines of the invoice form: the PO total, what the other invoices of the PO
 * billed, what is left, and this invoice (all before VAT). Every invoice is deducted from the PO.
 */
export default function PoBalanceStrip({
  total,
  billed,
  remaining,
  thisInvoice,
  error,
}: {
  total: number;
  billed: number;
  remaining: number;
  thisInvoice: number;
  error: string;
}) {
  const item = (label: string, value: number, className?: string) => (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("font-medium tabular-nums text-slate-900", className)}>{formatMoney(value)}</dd>
    </div>
  );

  return (
    <div
      className={cn(
        "border-b px-5 py-3 text-sm",
        error ? "border-red-100 bg-red-50/60" : "border-slate-100 bg-slate-50/60",
      )}
    >
      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        {item("ยอด PO (ก่อน VAT)", total)}
        {item("เรียกเก็บแล้ว", billed)}
        {item("คงเหลือ", remaining, remaining > 0 ? "text-emerald-700" : "text-slate-500")}
        {item("ใบนี้", thisInvoice, error ? "text-red-600" : undefined)}
      </dl>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
