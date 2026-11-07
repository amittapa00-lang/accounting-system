"use client";

import { Lock, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/form";
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

// Same look as <Th>/<Td>, but tighter padding: the cells hold inputs.
const th = "whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-xs font-semibold text-slate-500";
const td = "border-b border-slate-100 px-2 py-2 align-top";
const numberInput = "text-right tabular-nums";

/**
 * Editable PO lines. Render it inside a <Card> (it brings its own card header);
 * the table scrolls sideways inside the card on small screens.
 */
export default function PurchaseOrderItemsTable({ items, readOnly, onAdd, onRemove, onChange }: Props) {
  return (
    <>
      <CardHeader
        title="รายการสินค้า / งาน"
        description={readOnly ? "รายการสินค้าถูกล็อก แก้ไขไม่ได้" : "เพิ่มรายการสินค้าได้หลายรายการ"}
        actions={
          readOnly ? (
            <Badge tone="warning">
              <Lock className="size-3" /> ล็อก
            </Badge>
          ) : (
            <Badge tone="neutral">{items.length} รายการ</Badge>
          )
        }
      />

      {/* relative: keeps the sr-only header text inside the scroll area on phones */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr>
              <th scope="col" className={cn(th, "w-10 pl-5 text-center")}>
                #
              </th>

              <th scope="col" className={cn(th, "min-w-[240px] text-left")}>
                Description
              </th>

              <th scope="col" className={cn(th, "w-24 text-right")}>
                Qty
              </th>

              <th scope="col" className={cn(th, "w-24 text-left")}>
                Unit
              </th>

              <th scope="col" className={cn(th, "w-32 text-right")}>
                Unit Price
              </th>

              <th scope="col" className={cn(th, "w-36 text-right")}>
                Discount
                <span className="block text-[11px] font-normal text-slate-400">% หรือจำนวนเงิน</span>
              </th>

              <th scope="col" className={cn(th, "w-20 text-right")}>
                VAT %
              </th>

              <th scope="col" className={cn(th, "w-36 text-right", readOnly && "pr-5")}>
                Amount
              </th>

              {!readOnly && (
                <th scope="col" className={cn(th, "w-12 pr-5 text-center")}>
                  <span className="sr-only">ลบ</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="transition-colors hover:bg-slate-50/70">
                <td className={cn(td, "pl-5 pt-4 text-center font-medium tabular-nums text-slate-400")}>
                  {index + 1}
                </td>

                <td className={td}>
                  <Input
                    type="text"
                    value={item.description}
                    onChange={(event) => onChange(item.id, "description", event.target.value)}
                    placeholder="รายละเอียดสินค้า / งาน"
                    aria-label={`รายละเอียด รายการที่ ${index + 1}`}
                    disabled={readOnly}
                  />
                </td>

                <td className={td}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) => onChange(item.id, "quantity", event.target.value)}
                    aria-label={`จำนวน รายการที่ ${index + 1}`}
                    disabled={readOnly}
                    className={numberInput}
                  />
                </td>

                <td className={td}>
                  <Input
                    type="text"
                    value={item.unit}
                    onChange={(event) => onChange(item.id, "unit", event.target.value)}
                    placeholder="ชิ้น"
                    aria-label={`หน่วย รายการที่ ${index + 1}`}
                    disabled={readOnly}
                  />
                </td>

                <td className={td}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) => onChange(item.id, "unitPrice", event.target.value)}
                    aria-label={`ราคาต่อหน่วย รายการที่ ${index + 1}`}
                    disabled={readOnly}
                    className={numberInput}
                  />
                </td>

                <td className={td}>
                  <Input
                    type="text"
                    value={item.discount}
                    onChange={(event) => onChange(item.id, "discount", event.target.value)}
                    placeholder="10% หรือ 1,500"
                    aria-label={`ส่วนลด รายการที่ ${index + 1}`}
                    disabled={readOnly}
                    className={numberInput}
                  />
                </td>

                <td className={td}>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.vat}
                    onChange={(event) => onChange(item.id, "vat", event.target.value)}
                    aria-label={`VAT % รายการที่ ${index + 1}`}
                    disabled={readOnly}
                    className={numberInput}
                  />
                </td>

                <td
                  className={cn(
                    td,
                    "whitespace-nowrap pt-4 text-right font-semibold tabular-nums text-slate-900",
                    readOnly && "pr-5"
                  )}
                >
                  {formatMoney(previewPoLine(item))}
                </td>

                {!readOnly && (
                  <td className={cn(td, "pr-5 text-center")}>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      disabled={items.length === 1}
                      aria-label={`ลบรายการที่ ${index + 1}`}
                      title="ลบรายการ"
                      className="inline-flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="px-5 py-3">
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus /> เพิ่มรายการ
          </Button>
        </div>
      )}
    </>
  );
}
