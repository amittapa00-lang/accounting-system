import { formatMoney } from "@/lib/format";
import type { Totals } from "@/lib/money";

/** Sub Total / VAT / Grand Total box under the PO lines. */
export default function PurchaseOrderTotals({ subtotal, vat, grandTotal }: Totals) {
  return (
    <div className="mt-6 flex justify-end">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 p-5">
        <div className="flex justify-between py-2 text-sm">
          <span className="text-gray-600">Sub Total</span>

          <span className="font-semibold text-gray-900">฿{formatMoney(subtotal)}</span>
        </div>

        <div className="flex justify-between border-t py-3 text-sm">
          <span className="text-gray-600">V.A.T.</span>

          <span className="font-semibold text-gray-900">฿{formatMoney(vat)}</span>
        </div>

        <div className="flex justify-between border-t pt-3">
          <span className="font-bold text-gray-900">Grand Total</span>

          <span className="text-xl font-bold text-blue-600">฿{formatMoney(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
