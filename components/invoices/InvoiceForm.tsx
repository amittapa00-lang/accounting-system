"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCopy, LoaderCircle, Save } from "lucide-react";

import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { DetailBlock } from "@/components/ui/data-display";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { formatMoney, todayInputValue } from "@/lib/format";
import PurchaseOrderItemsTable, {
  newPOItem,
  type POItem,
  type POItemField,
} from "@/components/purchase-orders/PurchaseOrderItemsTable";
import {
  blockingNumberHolders,
  buildInvoiceLines,
  checkVatRate,
  customLineTotals,
  formatLineDiscount,
  formatQuantity,
  INVOICE_NUMBER_PREFIX,
  invoiceNumberLabel,
  invoiceNumberTakenMessage,
  poBalanceError,
  type BillingMode,
  type PoBalance,
} from "@/lib/invoices";
import { DOCUMENT_TYPES } from "@/lib/labels";
import {
  defaultSelectedLines,
  displayLineDescription,
  displayLineNumbers,
  lineHasAmount,
  toLineType,
  type LineType,
} from "@/lib/lines";
import { formatDiscountInput, MoneyInputError, parseDiscount, parseNumber, type ParsedDiscount } from "@/lib/money";
import { cleanPoItems, poAmountInput, previewPoLine } from "@/lib/purchase-orders";

import PoBalanceStrip from "./PoBalanceStrip";

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
  /** the PO line's amount (typed by the user, or quantity x price - discount) */
  amount: number;
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
  existingInvoices: {
    id: string;
    label: string;
    status: string;
    grandTotal: number;
  }[];

  /** PO lines; when editing, `billed` / `remaining` leave out this invoice's own quantities */
  lines: BillingLine[];

  /** PO total before VAT and what other invoices billed (when editing, without this invoice) */
  balance: PoBalance;

  /** Set when editing a draft invoice: its saved values fill the form */
  editing?: InvoiceEditValues;
};

export type InvoiceEditValues = {
  id: string;
  documentType: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerm: string;
  saleOrderNumber: string;
  saleName: string;
  entryBy: string;
  shipTo: string;
  note: string;
  billDiscount: string;
  /** billed quantity per PO line id (0 for text lines) */
  quantities: Record<string, number>;
  /** CUSTOM when the invoice's lines were typed (ทำรายการใหม่) */
  billingMode: BillingMode;
  /** the typed lines (CUSTOM), as in the PO line table, and their VAT % */
  customItems: POItem[];
  vatRate: number;
};

const BILLING_MODE_OPTIONS: { value: BillingMode; label: string }[] = [
  { value: "PO", label: "เลือกจากรายการ PO" },
  { value: "CUSTOM", label: "ทำรายการใหม่" },
];

/** A typed row nothing was entered in (rows added with Enter and left empty are not sent). */
function isBlankItem(item: POItem) {
  return !item.description.trim() && !item.amount.trim() && !item.unitPrice;
}

type LineState = { selected: boolean; quantity: string };

function initialLineState(lines: BillingLine[], editing?: InvoiceEditValues): Record<string, LineState> {
  if (editing) {
    // the invoice's own lines are ticked, with their saved quantities
    return Object.fromEntries(
      lines.map((line) => {
        const saved = editing.quantities[line.id];
        const selected = saved !== undefined;
        const quantity = lineHasAmount(line) ? String(selected ? saved : line.remaining) : "";
        return [line.id, { selected, quantity }];
      }),
    );
  }

  // everything still unbilled is selected by default; text lines follow the lines of their group
  const selected = defaultSelectedLines(lines);
  return Object.fromEntries(
    lines.map((line, index) => [
      line.id,
      {
        selected: selected[index],
        quantity: lineHasAmount(line) ? String(line.remaining) : "",
      },
    ]),
  );
}

type InvoiceMatch = {
  id: string;
  invoiceNumber: string;
  subNumber: number;
  saleOrderNumber: string | null;
  /** only from /api/invoices/numbers */
  purchaseOrderId?: string;
};

/**
 * Other invoices that already use `value`, looked up while typing (debounced) from
 * /api/invoices/sale-orders or /api/invoices/numbers. Empty while `value` is blank or `enabled`
 * is false; the server checks again when saving.
 */
function useDuplicates(endpoint: "sale-orders" | "numbers", value: string, enabled = true, excludeId?: string) {
  const [result, setResult] = useState<{
    value: string;
    matches: InvoiceMatch[];
  }>({ value: "", matches: [] });
  const query = enabled ? value.trim() : "";

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          number: query,
          ...(excludeId ? { exclude: excludeId } : {}),
        });
        const response = await fetch(`/api/invoices/${endpoint}?${params}`, {
          signal: controller.signal,
        });
        const data: { matches?: InvoiceMatch[] } = await response.json();
        setResult({
          value: query,
          matches: response.ok && Array.isArray(data.matches) ? data.matches : [],
        });
      } catch {
        // offline or aborted: no warning here (the server checks when saving)
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, query, excludeId]);

  // results of an older value never show for the current one; the edited invoice is not its own duplicate
  return query && result.value === query ? result.matches.filter((match) => match.id !== excludeId) : [];
}

export default function InvoiceForm({ initialData }: { initialData: InvoiceInitialData }) {
  const router = useRouter();
  const { lines, editing } = initialData;

  const [documentType, setDocumentType] = useState<string>(editing?.documentType ?? DOCUMENT_TYPES[0].value);
  // Today in Thai time (toISOString would give yesterday before 07:00)
  const [invoiceDate, setInvoiceDate] = useState(editing?.invoiceDate ?? todayInputValue);
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? "");
  const [paymentTerm, setPaymentTerm] = useState(editing?.paymentTerm ?? initialData.paymentTerm);
  const [saleName, setSaleName] = useState(editing?.saleName ?? "");
  const [entryBy, setEntryBy] = useState(editing?.entryBy ?? "");
  const [shipTo, setShipTo] = useState(editing?.shipTo ?? initialData.deliveryPlace);
  const [note, setNote] = useState(editing?.note ?? initialData.note);
  const [billDiscount, setBillDiscount] = useState(editing?.billDiscount ?? "");

  // Invoice number: untouched = let the server assign the next number for the invoice date's year
  const [invoiceNumber, setInvoiceNumber] = useState(initialData.invoiceNumber);
  const [numberTouched, setNumberTouched] = useState(false);
  // typed by the user, no default; blank = none
  const [saleOrderNumber, setSaleOrderNumber] = useState(editing?.saleOrderNumber ?? "");

  const [lineState, setLineState] = useState(() => initialLineState(lines, editing));

  // เลือกจากรายการ PO, or ทำรายการใหม่ (always, once every PO line has been billed by quantity)
  const poLinesLeft = lines.some((line) => lineHasAmount(line) && line.remaining > 0);
  const [billingMode, setBillingMode] = useState<BillingMode>(editing?.billingMode ?? (poLinesLeft ? "PO" : "CUSTOM"));
  const custom = billingMode === "CUSTOM";
  // ทำรายการใหม่: lines typed in the same table as the lines of a PO
  const [customItems, setCustomItems] = useState<POItem[]>(() =>
    editing?.customItems.length ? editing.customItems : [newPOItem()],
  );
  // typed lines share one VAT % (starts with the PO's rate)
  const [vatRate, setVatRate] = useState(() =>
    String(editing?.customItems.length ? editing.vatRate : (lines.find((line) => lineHasAmount(line))?.vat ?? 7)),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Blocks a second submit before React has re-rendered the disabled button
  const inFlight = useRef(false);

  const numbers = useMemo(() => displayLineNumbers(lines), [lines]);
  // Sale Order No.: duplicates are allowed, only warned about
  const saleOrderDuplicates = useDuplicates("sale-orders", saleOrderNumber, true, editing?.id);

  // Invoice number: must start with IV. It may be a number another PO already uses, as long as
  // the Sale Order No. differs (same rule as the API). Checked once the user has typed one (an
  // edited invoice keeps an older number, e.g. INV-..., while it is not changed).
  const checkNumber = initialData.numberEditable && numberTouched;
  const typedNumber = invoiceNumber.trim();
  // this PO's own invoices are sub-invoices, they are not compared
  const numberHolders = useDuplicates("numbers", invoiceNumber, checkNumber, editing?.id).filter(
    (match) => match.purchaseOrderId !== initialData.purchaseOrderId,
  );
  const numberBlocked = blockingNumberHolders(numberHolders, saleOrderNumber);
  const numberError = !checkNumber
    ? ""
    : !typedNumber
      ? "กรุณากรอกเลขที่ Invoice"
      : !typedNumber.startsWith(INVOICE_NUMBER_PREFIX)
        ? `เลขที่ Invoice ต้องขึ้นต้นด้วย ${INVOICE_NUMBER_PREFIX}`
        : invoiceNumberTakenMessage(typedNumber, saleOrderNumber, numberBlocked);
  // shared with other POs and allowed (different Sale Order No.): shown as a note, not an error
  const numberShared = !numberError && numberHolders.length > 0 ? numberHolders : [];

  // ---------------------------------------------------------------- selection and preview

  const lineErrors: Record<string, string> = {};
  const selection: {
    line: BillingLine;
    quantity: number;
    billedBefore: number;
  }[] = [];

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

  // ทำรายการใหม่: the typed rows (empty ones left out), with the same checks as PO lines.
  // Like the PO form, a row's mistakes are reported when saving, not while it is being typed.
  const typedItems = customItems.filter((item) => !isBlankItem(item));
  const customLines = typedItems.map((item) => ({ amount: previewPoLine(item) }));
  const vatCheck = checkVatRate(vatRate);
  const customVat = vatCheck.rate ?? 0;
  function customItemsError(): string {
    try {
      cleanPoItems(typedItems);
      return "";
    } catch (err) {
      return err instanceof MoneyInputError ? err.message : "รายการไม่ถูกต้อง";
    }
  }

  let discount: ParsedDiscount | null = null;
  let discountError = "";
  const itemsTotal = custom
    ? customLineTotals(customLines, customVat).itemsTotal
    : buildInvoiceLines(selection).totals.itemsTotal;
  try {
    discount = parseDiscount(billDiscount, itemsTotal);
  } catch (err) {
    discountError = err instanceof Error ? err.message : "ส่วนลดไม่ถูกต้อง";
  }

  const discountInput = discount ? { value: discount.value, type: discount.type } : null;
  const { lines: previewLines, totals: poTotals } = buildInvoiceLines(selection, discountInput);
  const totals = custom ? customLineTotals(customLines, customVat, discountInput) : poTotals;
  const amountById = new Map(previewLines.map((p) => [p.line.id, p.amount]));

  const hasPricedSelection = custom
    ? customLines.some((line) => line.amount > 0)
    : selection.some(({ line }) => lineHasAmount(line));
  const hasLineErrors = custom ? Boolean(vatCheck.error) : Object.keys(lineErrors).length > 0;
  // every invoice is deducted from the PO: all of them together at most the PO total before VAT
  const balanceError = hasPricedSelection ? poBalanceError(totals.subtotal, initialData.balance) : "";
  const canSubmit =
    hasPricedSelection && !hasLineErrors && !balanceError && !discountError && !numberError && !submitting;

  // ---------------------------------------------------------------- typed lines (same handlers as the PO form)

  function addCustomItem() {
    setCustomItems((current) => [...current, newPOItem()]);
  }

  /** Enter in a description: a new empty line of the same level right below it. */
  function insertCustomItemAfter(id: string): string {
    const added = newPOItem(customItems.find((item) => item.id === id)?.lineType ?? "ITEM");
    setCustomItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      return index === -1 ? [...current, added] : [...current.slice(0, index + 1), added, ...current.slice(index + 1)];
    });
    return added.id;
  }

  function removeCustomItem(id: string) {
    setCustomItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  }

  function updateCustomItem(id: string, field: POItemField, value: string) {
    setCustomItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        if (field === "lineType") return { ...item, lineType: toLineType(value) };
        if (field === "description" || field === "unit" || field === "discount" || field === "amount") {
          return { ...item, [field]: value };
        }
        return { ...item, [field]: Number(value) || 0 };
      }),
    );
  }

  /** ทำรายการใหม่ starting from a copy of the PO lines, to change for this invoice */
  function copyFromPo() {
    setCustomItems(
      lines.map((line) => ({
        ...newPOItem(line.lineType),
        description: line.description,
        quantity: line.quantity,
        unit: line.unit ?? "",
        unitPrice: line.unitPrice,
        discount: lineHasAmount(line) ? formatDiscountInput(line.discount, line.discountType) : "",
        amount: lineHasAmount(line) ? poAmountInput(line) : "",
      })),
    );
  }

  function updateLine(id: string, patch: Partial<LineState>) {
    setLineState((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  // ---------------------------------------------------------------- submit

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !canSubmit) return;

    // typed lines: the same checks as the lines of a PO (the API checks again)
    const itemsError = custom ? customItemsError() : "";
    if (itemsError) {
      setError(itemsError);
      return;
    }

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
      response = await fetch(editing ? `/api/invoices/${editing.id}` : "/api/invoices", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? {} : { purchaseOrderId: initialData.purchaseOrderId }),
          documentType,
          invoiceDate,
          dueDate: dueDate || null,
          paymentTerm,
          ...(initialData.numberEditable && numberTouched ? { invoiceNumber } : {}),
          saleOrderNumber,
          saleName,
          entryBy,
          shipToSnapshot: shipTo,
          note,
          billDiscount,
          billingMode,
          ...(custom
            ? {
                customItems: typedItems.map((item) => ({
                  lineType: item.lineType,
                  description: item.description,
                  quantity: item.quantity,
                  unit: item.unit,
                  unitPrice: item.unitPrice,
                  discount: item.discount,
                  amount: item.amount,
                  vat: vatRate,
                })),
                vatRate,
              }
            : {
                items: selection.map(({ line, quantity }) => ({
                  purchaseOrderItemId: line.id,
                  quantity,
                })),
              }),
        }),
      });
    } catch {
      fail("เกิดข้อผิดพลาดในการเชื่อมต่อระบบ");
      return;
    }

    const data: { error?: unknown; invoice?: { id?: string } } = await response.json().catch(() => ({}));

    if (!response.ok || !data.invoice?.id) {
      fail(
        typeof data.error === "string"
          ? data.error
          : editing
            ? "ไม่สามารถแก้ไข Invoice ได้"
            : "ไม่สามารถสร้าง Invoice ได้",
      );
      return;
    }

    toast(editing ? "บันทึกการแก้ไข Invoice สำเร็จ" : "บันทึก Invoice สำเร็จ");

    // Back to the invoice list. Keep the button disabled until it has loaded (prevents a second save);
    // refresh so the list is not served from the client cache from before the save.
    router.push("/invoices");
    router.refresh();
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
                ? numberShared.length > 0
                  ? undefined
                  : numberTouched
                    ? `ขึ้นต้นด้วย ${INVOICE_NUMBER_PREFIX} ซ้ำกับ Invoice อื่นได้ถ้า Sale Order No. ต่างกัน`
                    : editing
                      ? `แก้ได้ (ขึ้นต้นด้วย ${INVOICE_NUMBER_PREFIX} ซ้ำได้ถ้า Sale Order No. ต่างกัน)`
                      : "เลขถัดไปของปี ถ้าไม่แก้ ระบบจะใช้เลขถัดไปตามปีของวันที่ Invoice"
                : editing
                  ? `ใช้ร่วมกับใบย่อยอื่นของ PO นี้ จึงแก้ไม่ได้ (ใบย่อยที่ ${initialData.subNumber})`
                  : `ใช้เลขเดียวกับใบก่อนหน้าของ PO นี้ (ใบย่อยที่ ${initialData.subNumber})`
            }
            error={numberError || undefined}
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
              aria-invalid={Boolean(numberError) || undefined}
              aria-describedby={numberShared.length > 0 ? "invoice-number-shared" : undefined}
              className="font-medium"
            />
            {numberShared.length > 0 && (
              <p id="invoice-number-shared" role="status" className="mt-1.5 text-xs leading-5 text-sky-700">
                เลขนี้ใช้กับ{" "}
                {numberShared.slice(0, 3).map((match, index) => (
                  <span key={match.id}>
                    {index > 0 && ", "}
                    <Link href={`/invoices/${match.id}`} target="_blank" className="font-medium underline underline-offset-2">
                      {invoiceNumberLabel(match, true)}
                    </Link>
                  </span>
                ))}
                {numberShared.length > 3 && ` และอีก ${numberShared.length - 3} ใบ`} แล้ว — ใช้ร่วมได้เพราะ Sale Order No.
                ต่างกัน
              </p>
            )}
          </Field>

          <Field
            label="Sale Order No."
            htmlFor="invoice-sale-order"
            hint={saleOrderDuplicates.length > 0 ? undefined : "กรอกเอง เว้นว่างได้ ซ้ำได้ (มีแจ้งเตือน)"}
            className="min-w-0"
          >
            <Input
              id="invoice-sale-order"
              type="text"
              value={saleOrderNumber}
              onChange={(event) => setSaleOrderNumber(event.target.value)}
              placeholder="เช่น 26/15915"
              aria-describedby={saleOrderDuplicates.length > 0 ? "invoice-sale-order-duplicate" : undefined}
              className={cn(saleOrderDuplicates.length > 0 && "border-amber-400 focus-visible:ring-amber-100")}
            />
            {saleOrderDuplicates.length > 0 && (
              <p id="invoice-sale-order-duplicate" role="status" className="mt-1.5 text-xs leading-5 text-amber-700">
                Sale Order No. นี้ซ้ำกับ{" "}
                {saleOrderDuplicates.slice(0, 3).map((match, index) => (
                  <span key={match.id}>
                    {index > 0 && ", "}
                    <Link
                      href={`/invoices/${match.id}`}
                      target="_blank"
                      className="font-medium underline underline-offset-2"
                    >
                      {invoiceNumberLabel(match)}
                    </Link>
                  </span>
                ))}
                {saleOrderDuplicates.length > 3 && ` และอีก ${saleOrderDuplicates.length - 3} ใบ`}
                {numberBlocked.length > 0 ? "" : " — ถ้าตั้งใจใช้เลขซ้ำ บันทึกต่อได้เลย"}
              </p>
            )}
          </Field>

          <Field label="ประเภทเอกสาร" htmlFor="invoice-document-type" className="min-w-0 sm:col-span-2">
            <Select
              id="invoice-document-type"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
            >
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
        <Alert
          tone="info"
          title={`Invoice ${initialData.invoiceNumber} มีใบย่อย${editing ? "อื่น" : "แล้ว"} ${initialData.existingInvoices.length} ใบ`}
        >
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
        <CardHeader
          title="ลูกค้าและสถานที่ส่ง"
          description={`ข้อมูลลูกค้าดึงมาจาก Purchase Order ${initialData.poNumber}`}
        />

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
            <Input
              id="invoice-ship-to"
              type="text"
              value={shipTo}
              onChange={(event) => setShipTo(event.target.value)}
            />
          </Field>
        </CardBody>
      </Card>

      {/* Lines to bill */}
      <Card>
        <CardHeader
          title="รายการที่จะเรียกเก็บ"
          description={
            custom
              ? "ทำรายการใหม่: กรอกรายการที่จะพิมพ์ในเอกสารเอง ยอดจะถูกหักจากยอดคงเหลือของ PO"
              : "เลือกจากรายการ PO: ติ๊กเลือกรายการและใส่จำนวนที่จะเรียกเก็บในใบนี้ (ค่าเริ่มต้น = จำนวนที่ยังไม่ได้เรียกเก็บ)"
          }
          actions={
            <div
              role="radiogroup"
              aria-label="วิธีทำรายการ"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            >
              {BILLING_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={billingMode === option.value}
                  onClick={() => setBillingMode(option.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    billingMode === option.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        />

        <PoBalanceStrip
          total={initialData.balance.total}
          billed={initialData.balance.billed}
          remaining={initialData.balance.remaining}
          thisInvoice={totals.subtotal}
          error={balanceError}
        />

        {custom ? (
          <>
            <PurchaseOrderItemsTable
              items={customItems}
              readOnly={false}
              hideHeader
              hideVat
              onAdd={addCustomItem}
              onInsertAfter={insertCustomItemAfter}
              onRemove={removeCustomItem}
              onChange={updateCustomItem}
            />
            <div className="flex flex-wrap items-center gap-2 border-y border-slate-100 px-5 py-2">
              <Button variant="ghost" size="sm" onClick={copyFromPo}>
                <ClipboardCopy /> คัดลอกรายการจาก PO
              </Button>
              <p className="text-xs text-slate-500">
                VAT % ของรายการที่ทำใหม่ใส่ช่องเดียวด้านล่าง · ยอดรวมทุกใบของ PO ต้องไม่เกินยอด PO (ก่อน VAT)
              </p>
            </div>
          </>
        ) : (
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
                          onChange={(event) =>
                            updateLine(line.id, {
                              selected: event.target.checked,
                            })
                          }
                          aria-label={`เลือก ${line.description}`}
                          className="size-4 accent-slate-900"
                        />
                      </td>
                      <td className={cn(td, "pt-3 text-center tabular-nums text-slate-500")}>{numbers[index] ?? ""}</td>
                      <td className={cn(td, "pt-3", line.lineType === "SUB" && "pl-8")}>
                        <span className="whitespace-pre-line">
                          {displayLineDescription(line.description, line.lineType)}
                        </span>
                        {done && <span className="ml-2 text-xs">(เรียกเก็บครบแล้ว)</span>}
                      </td>
                      <td className={cn(td, "whitespace-nowrap pt-3 text-right tabular-nums")}>
                        {priced ? (
                          <>
                            {formatQuantity(line.quantity)} {line.unit ?? ""}
                            {line.billed > 0 && (
                              <span className="block text-xs text-slate-500">
                                ออก Invoice แล้ว {formatQuantity(line.billed)}
                              </span>
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
                              onChange={(event) =>
                                updateLine(line.id, {
                                  quantity: event.target.value,
                                })
                              }
                              aria-label={`จำนวนที่เรียกเก็บ ${line.description}`}
                              aria-invalid={Boolean(lineErrors[line.id]) || undefined}
                              className="h-8 text-right tabular-nums"
                            />
                            {lineErrors[line.id] && (
                              <p className="mt-1 text-right text-xs text-red-600">{lineErrors[line.id]}</p>
                            )}
                          </>
                        )}
                      </td>
                      <td className={cn(td, "pt-3 text-right tabular-nums")}>
                        {priced && line.unitPrice > 0 ? formatMoney(line.unitPrice) : ""}
                      </td>
                      <td className={cn(td, "pt-3 text-right tabular-nums")}>
                        {priced ? formatLineDiscount(line.discount, line.discountType) || "-" : ""}
                      </td>
                      <td className={cn(td, "pr-5 pt-3 text-right font-medium tabular-nums text-slate-900")}>
                        {priced && state?.selected && !done && amountById.has(line.id)
                          ? formatMoney(amountById.get(line.id))
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 px-5 py-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <Field
              label="หมายเหตุ"
              htmlFor="invoice-note"
              hint="พิมพ์ต่อท้ายรายการในฟอร์ม (หลังเงื่อนไขการรับสินค้าและหมายเหตุของ PO ถ้าข้อความต่างกัน)"
              className="min-w-0"
            >
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

            {custom && (
              <Field
                label="VAT %"
                htmlFor="invoice-vat-rate"
                hint="ใช้กับทุกรายการที่ทำใหม่ในใบนี้"
                error={vatCheck.error || undefined}
                className="min-w-0 max-w-xs"
              >
                <Input
                  id="invoice-vat-rate"
                  inputMode="decimal"
                  value={vatRate}
                  onChange={(event) => setVatRate(event.target.value)}
                  aria-invalid={Boolean(vatCheck.error) || undefined}
                  className="text-right tabular-nums"
                />
              </Field>
            )}
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
      {!hasPricedSelection && (
        <Alert tone="warning">
          {custom
            ? "กรุณากรอกรายการที่มี Amount อย่างน้อย 1 รายการ"
            : "กรุณาเลือกรายการที่จะเรียกเก็บอย่างน้อย 1 รายการ"}
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() =>
            router.push(editing ? `/invoices/${editing.id}` : `/purchase-orders/${initialData.purchaseOrderId}`)
          }
          disabled={submitting}
        >
          ยกเลิก
        </Button>

        <Button type="submit" variant="brand" disabled={!canSubmit} className="sm:min-w-40">
          {submitting ? <LoaderCircle className="animate-spin" /> : <Save />}
          {editing
            ? submitting
              ? "กำลังบันทึก..."
              : "บันทึกการแก้ไข"
            : submitting
              ? "กำลังสร้าง Invoice..."
              : initialData.subNumber > 1
                ? `สร้างใบย่อยที่ ${initialData.subNumber}`
                : "สร้าง Invoice"}
        </Button>
      </div>
    </form>
  );
}
