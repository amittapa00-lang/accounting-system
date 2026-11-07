import { formatMoney } from "@/lib/format";
import type { Totals } from "@/lib/money";

/** Sub Total / VAT / Grand Total box under the PO lines (sits at the bottom of the items card). */
export default function PurchaseOrderTotals({ subtotal, vat, grandTotal }: Totals) {
  return (
    <div className="flex justify-end rounded-b-xl border-t border-slate-100 bg-slate-50/60 px-5 py-4">
      <dl className="w-full max-w-sm space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-500">Sub Total</dt>
          <dd className="font-medium tabular-nums text-slate-900">฿{formatMoney(subtotal)}</dd>
        </div>

        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-500">V.A.T.</dt>
          <dd className="font-medium tabular-nums text-slate-900">฿{formatMoney(vat)}</dd>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
          <dt className="font-semibold text-slate-900">Grand Total</dt>
          <dd className="text-xl font-semibold tabular-nums text-slate-900">฿{formatMoney(grandTotal)}</dd>
        </div>
      </dl>
    </div>
  );
}
