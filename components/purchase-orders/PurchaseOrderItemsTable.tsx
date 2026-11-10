"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { IndentDecrease, IndentIncrease, Lock, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Input, Textarea } from "@/components/ui/form";
import { formatMoney } from "@/lib/format";
import { displayLineNumbers, lineHasAmount, type LineType } from "@/lib/lines";
import { previewPoLine } from "@/lib/purchase-orders";

/** A PO line while it is being edited in the form. */
export type POItem = {
  /** React key only (database id for existing lines, generated for new ones) */
  id: string;
  /** ITEM = numbered line, SUB = un-numbered line indented under the line above */
  lineType: LineType;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** "10%" = percent, "1,500" = baht, "" = none */
  discount: string;
  vat: number;
  /** amount to bill, typed by the user (e.g. this round's payment), before the discount */
  amount: string;
};

export type POItemField = keyof Omit<POItem, "id">;

let newItemCounter = 0;

export function newPOItem(lineType: LineType = "ITEM"): POItem {
  newItemCounter += 1;

  return {
    id: `new-${Date.now()}-${newItemCounter}`,
    lineType,
    description: "",
    quantity: 1,
    unit: "",
    unitPrice: 0,
    discount: "",
    vat: 7,
    amount: "",
  };
}

type Props = {
  items: POItem[];
  /** Lines cannot be changed (PO already invoiced or cancelled) */
  readOnly: boolean;
  onAdd: () => void;
  /** Adds an empty line of the same type right after `id`; returns the new line's id. */
  onInsertAfter: (id: string) => string;
  onRemove: (id: string) => void;
  onChange: (id: string, field: POItemField, value: string) => void;
  /** Leave out the card header (the parent shows its own, e.g. the invoice form) */
  hideHeader?: boolean;
  /** Leave out the VAT % column (the invoice form takes one VAT rate for all its typed lines) */
  hideVat?: boolean;
};

// Same look as <Th>/<Td>, but tighter padding: the cells hold inputs.
const th = "whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-xs font-semibold text-slate-500";
const td = "border-b border-slate-100 px-2 py-2 align-top";
const numberInput = "text-right tabular-nums";

/**
 * Editable PO lines. Render it inside a <Card> (it brings its own card header);
 * the table scrolls sideways inside the card on small screens.
 *
 * Keyboard, like a bulleted list in Word: Enter in a description adds the next line,
 * Tab on an empty line makes it a sub-line (no number), Shift+Tab makes it numbered again.
 */
export default function PurchaseOrderItemsTable({
  items,
  readOnly,
  onAdd,
  onInsertAfter,
  onRemove,
  onChange,
  hideHeader = false,
  hideVat = false,
}: Props) {
  const numbers = displayLineNumbers(items);

  // Focus the line added with Enter once it has been rendered. (Refs, not DOM ids: the ids of
  // new lines are generated and differ between the server render and the browser.)
  const descriptionInputs = useRef(new Map<string, HTMLTextAreaElement>());
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const input = descriptionInputs.current.get(pendingFocus.current);
    if (input) {
      input.focus();
      pendingFocus.current = null;
    }
  }, [items]);

  function setLevel(item: POItem, lineType: LineType) {
    if (item.lineType !== lineType) onChange(item.id, "lineType", lineType);
  }

  function handleDescriptionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, item: POItem) {
    if (event.nativeEvent.isComposing) return;

    // Shift+Enter: a new line inside the description (the textarea's default)
    if (event.key === "Enter" && !event.shiftKey) {
      // Enter alone adds the next row
      event.preventDefault();
      pendingFocus.current = onInsertAfter(item.id);
      return;
    }

    // Tab / Shift+Tab only change the level of a line that is still empty, so moving
    // between fields with Tab keeps working everywhere else
    if (event.key === "Tab" && event.currentTarget.value === "") {
      if (!event.shiftKey && item.lineType === "ITEM") {
        event.preventDefault();
        setLevel(item, "SUB");
      } else if (event.shiftKey && item.lineType === "SUB") {
        event.preventDefault();
        setLevel(item, "ITEM");
      }
    }
  }

  return (
    <>
      {!hideHeader && (
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
      )}

      {/* relative: keeps the sr-only header text inside the scroll area on phones */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr>
              <th scope="col" className={cn(th, "w-20 pl-5 text-left")}>
                #
              </th>

              <th scope="col" className={cn(th, "min-w-[260px] text-left")}>
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

              {!hideVat && (
                <th scope="col" className={cn(th, "w-20 text-right")}>
                  VAT %
                </th>
              )}

              <th scope="col" className={cn(th, "w-40 text-right", readOnly && "pr-5")}>
                Amount
                <span className="block text-[11px] font-normal text-slate-400">ยอดที่เรียกเก็บ</span>
              </th>

              {!readOnly && (
                <th scope="col" className={cn(th, "w-12 pr-5 text-center")}>
                  <span className="sr-only">ลบ</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const row = index + 1;
              const isSub = item.lineType === "SUB";

              return (
                <tr key={item.id} className="transition-colors hover:bg-slate-50/70">
                  {/* Number, and the button that indents the line into a sub-line (no number) */}
                  <td className={cn(td, "pl-5")}>
                    <div className="flex h-10 items-center gap-1">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => setLevel(item, isSub ? "ITEM" : "SUB")}
                          aria-label={isSub ? `แถวที่ ${row}: เลิกเป็นรายการย่อย` : `แถวที่ ${row}: ทำเป็นรายการย่อย`}
                          aria-pressed={isSub}
                          title={
                            isSub
                              ? "เลิกเป็นรายการย่อย (กลับมามีเลขลำดับ) · Shift+Tab ในแถวว่าง"
                              : "ทำเป็นรายการย่อย (ไม่มีเลขลำดับ) · Tab ในแถวว่าง"
                          }
                          className={cn(
                            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200",
                            isSub
                              ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                              : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          )}
                        >
                          {isSub ? <IndentDecrease className="size-4" /> : <IndentIncrease className="size-4" />}
                        </button>
                      )}

                      <span className="min-w-5 text-center font-medium tabular-nums text-slate-400">
                        {numbers[index] ?? ""}
                      </span>
                    </div>
                  </td>

                  <td className={td}>
                    <div className={cn(isSub && "flex items-start gap-2 pl-5")}>
                      {isSub && (
                        <span aria-hidden="true" className="pt-2 text-slate-400">
                          -
                        </span>
                      )}

                      {/* Several lines: grows with its text (Shift+Enter = new line, Enter = next row) */}
                      <Textarea
                        ref={(input) => {
                          if (input) descriptionInputs.current.set(item.id, input);
                          else descriptionInputs.current.delete(item.id);
                        }}
                        rows={1}
                        value={item.description}
                        onChange={(event) => onChange(item.id, "description", event.target.value)}
                        onKeyDown={(event) => handleDescriptionKeyDown(event, item)}
                        placeholder={isSub ? "รายการย่อย (ไม่มีเลขลำดับ)" : "รายละเอียดสินค้า / งาน"}
                        aria-label={`รายละเอียด แถวที่ ${row}`}
                        title="Shift+Enter = ขึ้นบรรทัดใหม่ · Enter = เพิ่มแถวถัดไป"
                        disabled={readOnly}
                        className="field-sizing-content min-h-10 max-h-64 resize-y leading-6"
                      />
                    </div>
                  </td>

                  <td className={td}>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) => onChange(item.id, "quantity", event.target.value)}
                      aria-label={`จำนวน แถวที่ ${row}`}
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
                      aria-label={`หน่วย แถวที่ ${row}`}
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
                      aria-label={`ราคาต่อหน่วย แถวที่ ${row}`}
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
                      aria-label={`ส่วนลด แถวที่ ${row}`}
                      disabled={readOnly}
                      className={numberInput}
                    />
                  </td>

                  {!hideVat && (
                    <td className={td}>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.vat}
                        onChange={(event) => onChange(item.id, "vat", event.target.value)}
                        aria-label={`VAT % แถวที่ ${row}`}
                        disabled={readOnly}
                        className={numberInput}
                      />
                    </td>
                  )}

                  <td className={cn(td, readOnly && "pr-5")}>
                    {readOnly ? (
                      lineHasAmount(item) ? (
                        <span className="block pt-2 text-right font-semibold tabular-nums text-slate-900">
                          {formatMoney(previewPoLine(item))}
                        </span>
                      ) : (
                        // no price and no amount = text line: nothing is printed in the money columns
                        <span className="block pt-2 text-right text-xs text-slate-400">ไม่มีราคา</span>
                      )
                    ) : (
                      <>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={item.amount}
                          onChange={(event) => onChange(item.id, "amount", event.target.value)}
                          // blank is fine for a text line; a line with a Unit Price needs an amount
                          placeholder={item.unitPrice > 0 ? "กรอกยอด" : "ไม่มีราคา"}
                          title="ยอดที่เรียกเก็บของรายการนี้ (ไม่คำนวณจาก Unit Price) · เว้นว่างได้ถ้าเป็นบรรทัดข้อความ"
                          aria-label={`Amount แถวที่ ${row}`}
                          aria-invalid={(item.unitPrice > 0 && item.amount.trim() === "") || undefined}
                          className={cn(numberInput, "font-semibold placeholder:font-normal")}
                        />
                        {/* what counts in the totals when a discount is taken off */}
                        {item.discount.trim() !== "" && item.amount.trim() !== "" && (
                          <span className="mt-1 block text-right text-[11px] tabular-nums text-slate-500">
                            หลังส่วนลด {formatMoney(previewPoLine(item))}
                          </span>
                        )}
                      </>
                    )}
                  </td>

                  {!readOnly && (
                    <td className={cn(td, "pr-5 text-center")}>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        disabled={items.length === 1}
                        aria-label={`ลบแถวที่ ${row}`}
                        title="ลบรายการ"
                        className="inline-flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:pointer-events-none disabled:opacity-30"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-col items-start gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus /> เพิ่มรายการ
          </Button>

          <p className="min-w-0 text-xs leading-5 text-slate-500">
            <kbd className="rounded border border-slate-300 bg-white px-1 font-sans text-[11px] text-slate-700">Enter</kbd>{" "}
            ในช่องรายละเอียด = เพิ่มแถวถัดไป ·{" "}
            <kbd className="rounded border border-slate-300 bg-white px-1 font-sans text-[11px] text-slate-700">Shift+Enter</kbd>{" "}
            = ขึ้นบรรทัดใหม่ในช่องเดิม ·{" "}
            <kbd className="rounded border border-slate-300 bg-white px-1 font-sans text-[11px] text-slate-700">Tab</kbd>{" "}
            ในแถวว่าง หรือปุ่ม <IndentIncrease className="inline size-3.5 align-[-2px]" /> = ทำเป็นรายการย่อย (ไม่มีเลขลำดับ) ·
            ไม่ใส่ทั้ง Unit Price และ Amount = บรรทัดข้อความ ไม่พิมพ์จำนวน/ราคา · ยอดรวมคิดจาก Amount - Discount แล้วคิด VAT (Unit Price ไม่นำมาคำนวณ)
          </p>
        </div>
      )}
    </>
  );
}
