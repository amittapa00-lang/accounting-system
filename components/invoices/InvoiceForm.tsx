"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";

import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { DetailBlock } from "@/components/ui/data-display";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { formatMoney, todayInputValue } from "@/lib/format";
import { buildInvoiceLines, defaultSaleOrderNumber, formatLineDiscount, formatQuantity } from "@/lib/invoices";
import { DOCUMENT_TYPES } from "@/lib/labels";
import { defaultSelectedLines, displayLineDescription, displayLineNumbers, lineHasAmount, type LineType } from "@/lib/lines";
import { parseDiscount, parseNumber, type ParsedDiscount } from "@/lib/money";

type BillingLine = {
  id: string;
  itemNo: number;
  lineType: LineType;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discount: number;
  discountType: string;
  vat: number;
  billed: number;
  remaining: number;
};

type InvoiceInitialData = {
  purchaseOrderId: string;
  poNumber: string;

  customerCode: string;
  customerName: string;
  customerAddress: string;
  customerTaxId: string;

  deliveryPlace: string;
  paymentTerm: string;
  note: string;

  /** suggested next number (first invoice) or the PO's existing number (sub-invoices) */
  invoiceNumber: string;
  numberEditable: boolean;
  subNumber: number;
  existingInvoices: { id: string; label: string; status: string; grandTotal: number }[];

  lines: BillingLine[];
};

type LineState = { selected: boolean; quantity: string };

function initialLineState(lines: BillingLine[]): Record<string, LineState> {
  // everything still unbilled is selected by default; text lines follow the lines of their group
  const selected = defaultSelectedLines(lines);
  return Object.fromEntries(
    lines.map((line, index) => [
      line.id,
      {
        selected: selected[index],
        quantity: lineHasAmount(line) ? String(line.remaining) : "",
      },
    ])
  );
}

type SaleOrderMatch = { id: string; invoiceNumber: string; subNumber: number; saleOrderNumber: string };

/** Other invoices that already use this Sale Order No. (duplicates are allowed, only warned about). */
function useSaleOrderDuplicates(value: string): SaleOrderMatch[] {
  const [result, setResult] = useState<{ value: string; matches: SaleOrderMatch[] }>({ value: "", matches: [] });
  const query = value.trim();

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/invoices/sale-orders?number=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data: { matches?: SaleOrderMatch[] } = await response.json();
        setResult({ value: query, matches: response.ok && Array.isArray(data.matches) ? data.matches : [] });
      } catch {
        // offline or aborted: no warning (saving is allowed either way)
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // results of an older value never show for the current one
  return query && result.value === query ? result.matches : [];
}

export default function InvoiceForm({ initialData }: { initialData: InvoiceInitialData }) {
  const router = useRouter();
  const { lines } = initialData;

  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0].value);
  // Today in Thai time (toISOString would give yesterday before 07:00)
  const [invoiceDate, setInvoiceDate] = useState(todayInputValue);
  const [dueDate, setDueDate] = useState("");
  const [paymentTerm, setPaymentTerm] = useState(initialData.paymentTerm);
  const [saleName, setSaleName] = useState("");
  const [entryBy, setEntryBy] = useState("");
  const [shipTo, setShipTo] = useState(initialData.deliveryPlace);
  const [note, setNote] = useState(initialData.note);
  const [billDiscount, setBillDiscount] = useState("");

  // Invoice number: untouched = let the server assign the next number for the invoice date's year
  const [invoiceNumber, setInvoiceNumber] = useState(initialData.invoiceNumber);
  const [numberTouched, setNumberTouched] = useState(false);
  const [saleOrderNumber, setSaleOrderNumber] = useState<string | null>(null); // null = default

  const [lineState, setLineState] = useState(() => initialLineState(lines));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Blocks a second submit before React has re-rendered the disabled button
  const inFlight = useRef(false);

  const numbers = useMemo(() => displayLineNumbers(lines), [lines]);
  const defaultSaleOrder = defaultSaleOrderNumber(invoiceNumber, initialData.subNumber);
  const saleOrderValue = saleOrderNumber ?? defaultSaleOrder;
  const saleOrderDuplicates = useSaleOrderDuplicates(saleOrderValue);

  // ---------------------------------------------------------------- selection and preview

  const lineErrors: Record<string, string> = {};
  const selection: { line: BillingLine; quantity: number; billedBefore: number }[] = [];

  for (const line of lines) {
    const state = lineState[line.id];
    if (!state?.selected) continue;

    if (!lineHasAmount(line)) {
      selection.push({ line, quantity: 0, billedBefore: 0 });
      continue;
    }

    const quantity = parseNumber(state.quantity);
    if (quantity === null || quantity <= 0) {
      lineErrors[line.id] = "ต้องมากกว่า 0";
    } else if (quantity > line.remaining + 1e-9) {
      lineErrors[line.id] = `ไม่เกิน ${formatQuantity(line.remaining)}`;
    } else {
      selection.push({ line, quantity, billedBefore: line.billed });
    }
  }

  let discount: ParsedDiscount | null = null;
  let discountError = "";
  const plain = buildInvoiceLines(selection);
  try {
    discount = parseDiscount(billDiscount, plain.totals.itemsTotal);
  } catch (err) {
    discountError = err instanceof Error ? err.message : "ส่วนลดไม่ถูกต้อง";
  }

  const { lines: previewLines, totals } = buildInvoiceLines(
    selection,
    discount ? { value: discount.value, type: discount.type } : null
  );
  const amountById = new Map(previewLines.map((p) => [p.line.id, p.amount]));

  const hasPricedSelection = selection.some(({ line }) => lineHasAmount(line));
  const canSubmit =
    hasPricedSelection && Object.keys(lineErrors).length === 0 && !discountError && !submitting;

  function updateLine(id: string, patch: Partial<LineState>) {
    setLineState((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  // ---------------------------------------------------------------- submit

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !canSubmit) return;

    inFlight.current = true;
    setSubmitting(true);
    setError("");

    const fail = (message: string) => {
      setError(message);
      inFlight.current = false;
      setSubmitting(false);
    };

    let response: Response;
    try {
      response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: initialData.purchaseOrderId,
          documentType,
          invoiceDate,
          dueDate: dueDate || null,
          paymentTerm,
          ...(initialData.numberEditable && numberTouched ? { invoiceNumber } : {}),
          ...(saleOrderNumber !== null ? { saleOrderNumber } : {}),
          saleName,
          entryBy,
          shipToSnapshot: shipTo,
          note,
          billDiscount,
          items: selection.map(({ line, quantity }) => ({ purchaseOrderItemId: line.id, quantity })),
        }),
      });
    } catch {
      fail("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
      return;
    }

    const data: { error?: unknown; invoice?: { id?: string } } = await response.json().catch(() => ({}));

    if (!response.ok || !data.invoice?.id) {
      fail(typeof data.error === "string" ? data.error : "ไม่สามารถสร้าง Invoice ได้");
      return;
    }

    // Keep the button disabled until the new page has loaded
    router.push(`/invoices/${data.invoice.id}`);
  }

  // ---------------------------------------------------------------- render

  const th = "whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-500";
  const td = "border-b border-slate-100 px-3 py-2 align-top";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Number and dates */}
      <Card>
        <CardHeader title="ข้อมูลเอกสาร" description="เลขที่ ประเภทเอกสาร วันที่ และเงื่อนไขการชำระเงิน" />

        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="เลขที่ Invoice"
            htmlFor="invoice-number"
            required
            hint={
              initialData.numberEditable
                ? numberTouched
                  ? "ใช้เลขที่พิมพ์เอง (ห้ามซ้ำกับ Invoice อื่น)"
                  : "เลขถัดไปของปี ถ้าไม่แก้ ระบบจะใช้เลขถัดไปตามปีของวันที่ Invoice"
                : `ใช้เลขเดียวกับใบก่อนหน้าของ PO นี้ (ใบย่อยที่ ${initialData.subNumber})`
            }
            className="min-w-0"
          >
            <Input
              id="invoice-number"
              type="text"
              value={invoiceNumber}
              onChange={(event) => {
                setInvoiceNumber(event.target.value);
                setNumberTouched(true);
              }}
              readOnly={!initialData.numberEditable}
              required
              className="font-medium"
            />
          </Field>

          <Field
            label="Sale Order No."
            htmlFor="invoice-sale-order"
            hint={saleOrderDuplicates.length > 0 ? undefined : "ค่าเริ่มต้น TC ปี/เลข-ลำดับใบย่อย แก้ไขได้"}
            className="min-w-0"
          >
            <Input
              id="invoice-sale-order"
              type="text"
              value={saleOrderValue}
              onChange={(event) => setSaleOrderNumber(event.target.value)}
              aria-describedby={saleOrderDuplicates.length > 0 ? "invoice-sale-order-duplicate" : undefined}
              className={cn(saleOrderDuplicates.length > 0 && "border-amber-400 focus-visible:ring-amber-100")}
            />
            {saleOrderDuplicates.length > 0 && (
              <p id="invoice-sale-order-duplicate" role="status" className="mt-1.5 text-xs leading-5 text-amber-700">
                Sale Order No. นี้ซ้ำกับ{" "}
                {saleOrderDuplicates.slice(0, 3).map((match, index) => (
                  <span key={match.id}>
                    {index > 0 && ", "}
                    <Link href={`/invoices/${match.id}`} target="_blank" className="font-medium underline underline-offset-2">
                      {match.invoiceNumber}
                      {match.subNumber > 1 ? ` (ใบย่อยที่ ${match.subNumber})` : ""}
                    </Link>
                  </span>
                ))}
                {saleOrderDuplicates.length > 3 && ` และอีก ${saleOrderDuplicates.length - 3} ใบ`} — ถ้าตั้งใจใช้เลขซ้ำ บันทึกต่อได้เลย
              </p>
            )}
          </Field>

          <Field label="ประเภทเอกสาร" htmlFor="invoice-document-type" className="min-w-0 sm:col-span-2">
            <Select id="invoice-document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
              {DOCUMENT_TYPES.map((type, index) => (
                <option key={type.value} value={type.value}>
                  {index + 1}. {type.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="วันที่ Invoice" htmlFor="invoice-date" required className="min-w-0">
            <Input
              id="invoice-date"
              type="date"
              value={invoiceDate}
              onChange={(event) => setInvoiceDate(event.target.value)}
              required
            />
          </Field>

          <Field label="วันครบกำหนดชำระ" htmlFor="invoice-due-date" className="min-w-0">
            <Input
              id="invoice-due-date"
              type="date"
              value={dueDate}
              min={invoiceDate || undefined}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>

          <Field label="Payment Term" htmlFor="invoice-payment-term" className="min-w-0">
            <Input
              id="invoice-payment-term"
              type="text"
              value={paymentTerm}
              onChange={(event) => setPaymentTerm(event.target.value)}
              placeholder="เช่น เครดิต 30 วัน"
            />
          </Field>

          <Field label="Sale Name / Entry By" htmlFor="invoice-sale-name" className="min-w-0">
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="invoice-sale-name"
                type="text"
                value={saleName}
                onChange={(event) => setSaleName(event.target.value)}
                placeholder="ชื่อ Sales"
              />
              <Input
                aria-label="Entry By"
                type="text"
                value={entryBy}
                onChange={(event) => setEntryBy(event.target.value)}
                placeholder="ผู้บันทึก"
              />
            </div>
          </Field>
        </CardBody>
      </Card>

      {/* Earlier sub-invoices of this PO */}
      {initialData.existingInvoices.length > 0 && (
        <Alert tone="info" title={`Invoice ${initialData.invoiceNumber} มีใบย่อยแล้ว ${initialData.existingInvoices.length} ใบ`}>
          <ul className="mt-1 space-y-1">
            {initialData.existingInvoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/invoices/${invoice.id}`} className="font-medium underline-offset-2 hover:underline">
                  {invoice.label}
                </Link>
                <InvoiceStatusBadge status={invoice.status} />
                <span className="tabular-nums">{formatMoney(invoice.grandTotal)}</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Customer (read-only, from the PO) and ship-to */}
      <Card>
        <CardHeader title="ลูกค้าและสถานที่ส่ง" description={`ข้อมูลลูกค้าดึงมาจาก Purchase Order ${initialData.poNumber}`} />

        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <DetailBlock label="รหัสลูกค้า">{initialData.customerCode}</DetailBlock>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <DetailBlock label="ชื่อลูกค้า">
              <span className="font-medium">{initialData.customerName}</span>
            </DetailBlock>
          </div>
          <div className="min-w-0">
            <DetailBlock label="Tax ID">{initialData.customerTaxId}</DetailBlock>
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-4">
            <DetailBlock label="ที่อยู่">{initialData.customerAddress}</DetailBlock>
          </div>

          <Field
            label="Ship To / สถานที่ส่ง"
            htmlFor="invoice-ship-to"
            hint="ค่าเริ่มต้นจากสถานที่ส่งใน Purchase Order แก้ไขได้"
            className="min-w-0 border-t border-slate-100 pt-5 sm:col-span-2 lg:col-span-4"
          >
            <Input id="invoice-ship-to" type="text" value={shipTo} onChange={(event) => setShipTo(event.target.value)} />
          </Field>
        </CardBody>
      </Card>

      {/* Lines to bill */}
      <Card>
        <CardHeader
          title="รายการที่จะเรียกเก็บ"
          description="ติ๊กเลือกรายการและใส่จำนวนที่จะเรียกเก็บในใบนี้ (ค่าเริ่มต้น = จำนวนที่ยังไม่ได้เรียกเก็บ)"
        />

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr>
                <th scope="col" className={cn(th, "w-10 pl-5 text-center")}>
                  เลือก
                </th>
                <th scope="col" className={cn(th, "w-10 text-center")}>
                  #
                </th>
                <th scope="col" className={cn(th, "text-left")}>
                  รายละเอียด
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  PO / เรียกเก็บแล้ว
                </th>
                <th scope="col" className={cn(th, "w-32 text-right")}>
                  จำนวนครั้งนี้
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  Unit Price
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  Discount
                </th>
                <th scope="col" className={cn(th, "pr-5 text-right")}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const state = lineState[line.id];
                const priced = lineHasAmount(line);
                const done = priced && line.remaining <= 0;

                return (
                  <tr key={line.id} className={cn(done && "bg-slate-50 text-slate-400")}>
                    <td className={cn(td, "pl-5 pt-3 text-center")}>
                      <input
                        type="checkbox"
                        checked={Boolean(state?.selected) && !done}
                        disabled={done}
                        onChange={(event) => updateLine(line.id, { selected: event.target.checked })}
                        aria-label={`เลือก ${line.description}`}
                        className="size-4 accent-slate-900"
                      />
                    </td>
                    <td className={cn(td, "pt-3 text-center tabular-nums text-slate-500")}>{numbers[index] ?? ""}</td>
                    <td className={cn(td, "pt-3", line.lineType === "SUB" && "pl-8")}>
                      <span className="whitespace-pre-line">{displayLineDescription(line.description, line.lineType)}</span>
                      {done && <span className="ml-2 text-xs">(เรียกเก็บครบแล้ว)</span>}
                    </td>
                    <td className={cn(td, "whitespace-nowrap pt-3 text-right tabular-nums")}>
                      {priced ? (
                        <>
                          {formatQuantity(line.quantity)} {line.unit ?? ""}
                          {line.billed > 0 && (
                            <span className="block text-xs text-slate-500">เก็บแล้ว {formatQuantity(line.billed)}</span>
                          )}
                        </>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className={td}>
                      {priced && !done && (
                        <>
                          <Input
                            inputMode="decimal"
                            value={state?.quantity ?? ""}
                            disabled={!state?.selected}
                            onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                            aria-label={`จำนวนที่เรียกเก็บ ${line.description}`}
                            aria-invalid={Boolean(lineErrors[line.id]) || undefined}
                            className="h-8 text-right tabular-nums"
                          />
                          {lineErrors[line.id] && <p className="mt-1 text-right text-xs text-red-600">{lineErrors[line.id]}</p>}
                        </>
                      )}
                    </td>
                    <td className={cn(td, "pt-3 text-right tabular-nums")}>{priced ? formatMoney(line.unitPrice) : ""}</td>
                    <td className={cn(td, "pt-3 text-right tabular-nums")}>
                      {priced ? formatLineDiscount(line.discount, line.discountType) || "-" : ""}
                    </td>
                    <td className={cn(td, "pr-5 pt-3 text-right font-medium tabular-nums text-slate-900")}>
                      {priced && state?.selected && !done && amountById.has(line.id) ? formatMoney(amountById.get(line.id)) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-6 px-5 py-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <Field label="หมายเหตุ" htmlFor="invoice-note" hint="พิมพ์ที่มุมล่างซ้ายของช่องรายการในฟอร์ม" className="min-w-0">
              <Textarea
                id="invoice-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="เช่น REFER: Quotation : TC2025-001-C101"
              />
            </Field>

            <Field
              label="ส่วนลดท้ายบิล"
              htmlFor="invoice-bill-discount"
              hint="ใส่เป็นบาท (เช่น 4800) หรือ % (เช่น 5%) หักก่อนคิด VAT"
              error={discountError || undefined}
              className="min-w-0 max-w-xs"
            >
              <Input
                id="invoice-bill-discount"
                value={billDiscount}
                onChange={(event) => setBillDiscount(event.target.value)}
                placeholder="0"
                aria-invalid={Boolean(discountError) || undefined}
                className="text-right tabular-nums"
              />
            </Field>
          </div>

          <dl className="w-full space-y-2 self-end text-sm lg:ml-auto lg:max-w-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">รวมรายการ</dt>
              <dd className="tabular-nums text-slate-900">{formatMoney(totals.itemsTotal)}</dd>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">ส่วนลดท้ายบิล</dt>
                <dd className="tabular-nums text-red-600">-{formatMoney(totals.discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums text-slate-900">{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">VAT</dt>
              <dd className="tabular-nums text-slate-900">{formatMoney(totals.vat)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-3">
              <dt className="font-semibold text-slate-900">Grand Total</dt>
              <dd className="text-xl font-semibold tabular-nums text-slate-900">{formatMoney(totals.grandTotal)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}
      {!hasPricedSelection && <Alert tone="warning">กรุณาเลือกรายการที่จะเรียกเก็บอย่างน้อย 1 รายการ</Alert>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => router.push(`/purchase-orders/${initialData.purchaseOrderId}`)}
          disabled={submitting}
        >
          ยกเลิก
        </Button>

        <Button type="submit" variant="brand" disabled={!canSubmit} className="sm:min-w-40">
          {submitting ? <LoaderCircle className="animate-spin" /> : <Save />}
          {submitting ? "กำลังสร้าง Invoice..." : initialData.subNumber > 1 ? `สร้างใบย่อยที่ ${initialData.subNumber}` : "สร้าง Invoice"}
        </Button>
      </div>
    </form>
  );
}
