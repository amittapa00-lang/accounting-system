"use client";

import { formatMoney } from "@/lib/format";
import { previewPoLine } from "@/lib/purchase-orders";

/** A PO line while it is being edited in the form. */
export type POItem = {
  /** React key only (database id for existing lines, generated for new ones) */
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** "10%" = percent, "1,500" = baht, "" = none */
  discount: string;
  vat: number;
};

export type POItemField = keyof Omit<POItem, "id">;

let newItemCounter = 0;

export function newPOItem(): POItem {
  newItemCounter += 1;

  return {
    id: `new-${Date.now()}-${newItemCounter}`,
    description: "",
    quantity: 1,
    unit: "",
    unitPrice: 0,
    discount: "",
    vat: 7,
  };
}

type Props = {
  items: POItem[];
  /** Lines cannot be changed (PO already invoiced or cancelled) */
  readOnly: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, field: POItemField, value: string) => void;
};

const cellInputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-600";

export default function PurchaseOrderItemsTable({ items, readOnly, onAdd, onRemove, onChange }: Props) {
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">รายการสินค้า / งาน</h3>

          <p className="mt-1 text-sm text-gray-500">
            {readOnly ? "รายการสินค้าถูกล็อก แก้ไขไม่ได้" : "เพิ่มรายการสินค้าได้หลายรายการ"}
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            + เพิ่มรายการ
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="w-12 px-3 py-3 text-center text-xs font-semibold text-gray-700">#</th>

              <th className="min-w-[260px] px-3 py-3 text-xs font-semibold text-gray-700">Description</th>

              <th className="w-24 px-3 py-3 text-right text-xs font-semibold text-gray-700">Qty</th>

              <th className="w-28 px-3 py-3 text-xs font-semibold text-gray-700">Unit</th>

              <th className="w-36 px-3 py-3 text-right text-xs font-semibold text-gray-700">Unit Price</th>

              <th className="w-36 px-3 py-3 text-right text-xs font-semibold text-gray-700">Discount</th>

              <th className="w-24 px-3 py-3 text-right text-xs font-semibold text-gray-700">VAT %</th>

              <th className="w-40 px-3 py-3 text-right text-xs font-semibold text-gray-700">Amount</th>

              {!readOnly && <th className="w-20 px-3 py-3 text-center text-xs font-semibold text-gray-700">ลบ</th>}
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-3 text-center text-sm font-semibold text-gray-700">{index + 1}</td>

                <td className="px-3 py-3">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(event) => onChange(item.id, "description", event.target.value)}
                    placeholder="รายละเอียดสินค้า / งาน"
                    disabled={readOnly}
                    className={cellInputClass}
                  />
                </td>

                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) => onChange(item.id, "quantity", event.target.value)}
                    disabled={readOnly}
                    className={`${cellInputClass} text-right`}
                  />
                </td>

                <td className="px-3 py-3">
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(event) => onChange(item.id, "unit", event.target.value)}
                    placeholder="ชิ้น"
                    disabled={readOnly}
                    className={cellInputClass}
                  />
                </td>

                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) => onChange(item.id, "unitPrice", event.target.value)}
                    disabled={readOnly}
                    className={`${cellInputClass} text-right`}
                  />
                </td>

                <td className="px-3 py-3">
                  <input
                    type="text"
                    value={item.discount}
                    onChange={(event) => onChange(item.id, "discount", event.target.value)}
                    placeholder="10% หรือ 1,500"
                    disabled={readOnly}
                    className={`${cellInputClass} text-right`}
                  />

                  <p className="mt-1 text-right text-[10px] text-gray-400">% หรือจำนวนเงิน</p>
                </td>

                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.vat}
                    onChange={(event) => onChange(item.id, "vat", event.target.value)}
                    disabled={readOnly}
                    className={`${cellInputClass} text-right`}
                  />
                </td>

                <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900">
                  {formatMoney(previewPoLine(item))}
                </td>

                {!readOnly && (
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      disabled={items.length === 1}
                      className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ลบ
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
