/**
 * Line types of PO and invoice lines (client-safe).
 *
 * Every line has the same fields (description, quantity, unit, price, discount, VAT).
 * The type only decides the number in front of it:
 *
 *   ITEM  numbered line                                  "1  ค่าบริการติดตั้ง (2 รอบ)"
 *   SUB   un-numbered line, indented under the line above "   - ค่าแรงช่าง   6 วัน  9,500.00  57,000.00"
 *
 * A line without a unit price is text only (a heading or a note line): documents print its
 * description but no quantity, price or amount, and it is not billed by quantity.
 *
 * The stored itemNo is only the row order; the number printed on documents comes from
 * displayLineNumbers (ITEM lines are counted, SUB lines are not). Older data may still hold
 * "HEADER" (a heading without price): it is read as ITEM, and has no price, so it stays text only.
 */
import { toNumber, type Numeric } from "@/lib/money";

export const LINE_TYPES = [
  { value: "ITEM", label: "รายการ", hint: "มีเลขลำดับ" },
  { value: "SUB", label: "ย่อย", hint: "ไม่มีเลขลำดับ ย่อหน้าใต้รายการด้านบน" },
] as const;

export type LineType = (typeof LINE_TYPES)[number]["value"];

/** SUB stays SUB; anything else (ITEM, older HEADER, missing) is a numbered line. */
export function toLineType(value: unknown): LineType {
  return value === "SUB" ? "SUB" : "ITEM";
}

/** True when the line has a unit price: it prints quantity, price and amount and is billed by quantity. */
export function lineHasAmount(line: { unitPrice: Numeric }): boolean {
  return toNumber(line.unitPrice) > 0;
}

/** Number shown for each line: 1, 2, ... for ITEM, null for SUB. */
export function displayLineNumbers(lines: { lineType?: string | null }[]): (number | null)[] {
  let counter = 0;
  return lines.map((line) => {
    if (toLineType(line.lineType) === "SUB") return null;
    counter += 1;
    return counter;
  });
}

/** Description as printed: SUB lines start with "- " (unless the text already starts with a dash). */
export function displayLineDescription(description: string, type: unknown): string {
  const text = description.trim();
  if (toLineType(type) !== "SUB") return text;
  return /^[-–•]/.test(text) ? text : `- ${text}`;
}

/**
 * Lines ticked by default on a new (sub-)invoice. A group is a numbered line with the SUB lines
 * under it. Priced lines are ticked while they still have something to bill; text lines are
 * ticked when their group bills something now, or when the group has no priced line at all.
 */
export function defaultSelectedLines(
  lines: { lineType?: string | null; unitPrice: Numeric; remaining: number }[]
): boolean[] {
  const groupOf: number[] = [];
  let group = -1;
  lines.forEach((line, index) => {
    if (toLineType(line.lineType) !== "SUB" || group < 0) group = index;
    groupOf.push(group);
  });

  const billsNow = new Set<number>();
  const hasPriced = new Set<number>();
  lines.forEach((line, index) => {
    if (!lineHasAmount(line)) return;
    hasPriced.add(groupOf[index]);
    if (line.remaining > 0) billsNow.add(groupOf[index]);
  });

  return lines.map((line, index) =>
    lineHasAmount(line) ? line.remaining > 0 : billsNow.has(groupOf[index]) || !hasPriced.has(groupOf[index])
  );
}
