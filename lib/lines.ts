/**
 * Line types of PO and invoice lines (client-safe).
 *
 *   ITEM   numbered line with quantity, price and amount            "1  ตลับลูกปืน ...   2  100.00  200.00"
 *   HEADER numbered heading, description only, no amount             "1  ค่าบริการติดตั้ง (2 รอบ)"
 *   SUB    un-numbered line under a heading, with its own amount     "   - ค่าแรงช่าง   6 วัน  9,500.00  57,000.00"
 *
 * The stored itemNo is only the row order; the number printed on documents comes
 * from displayLineNumbers (ITEM and HEADER lines are counted, SUB lines are not).
 */

export const LINE_TYPES = [
  { value: "ITEM", label: "รายการ", hint: "มีลำดับและราคา" },
  { value: "HEADER", label: "หัวข้อ", hint: "มีลำดับ ไม่มีราคา" },
  { value: "SUB", label: "ย่อย", hint: "ไม่มีลำดับ มีราคา" },
] as const;

export type LineType = (typeof LINE_TYPES)[number]["value"];

export function isLineType(value: unknown): value is LineType {
  return typeof value === "string" && LINE_TYPES.some((t) => t.value === value);
}

/** Unknown or missing values (older rows) are treated as normal items. */
export function toLineType(value: unknown): LineType {
  return isLineType(value) ? value : "ITEM";
}

/** HEADER lines have no quantity, price or amount. */
export function lineHasAmount(type: unknown): boolean {
  return toLineType(type) !== "HEADER";
}

/** Number shown for each line: 1, 2, ... for ITEM/HEADER, null for SUB. */
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
