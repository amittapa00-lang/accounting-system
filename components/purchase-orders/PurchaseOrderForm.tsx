"use client";

import { FormEvent, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DetailBlock } from "@/components/ui/data-display";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { formatMoney, todayInputValue } from "@/lib/format";
import { PO_STATUSES } from "@/lib/labels";
import { lineHasAmount, toLineType } from "@/lib/lines";
import { calcTotals, MoneyInputError } from "@/lib/money";
import { cleanPoItems, previewPoLine, type PoLock } from "@/lib/purchase-orders";

import PurchaseOrderItemsTable, { newPOItem, type POItem, type POItemField } from "./PurchaseOrderItemsTable";
import PurchaseOrderTotals from "./PurchaseOrderTotals";

export type PurchaseOrderFormCustomer = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  tel: string | null;
  taxId: string | null;
  contactName: string | null;
  isActive: boolean;
};

export type PurchaseOrderFormHeader = {
  poNumber: string;
  customerId: string;
  plant: string;
  poDate: string;
  deliveryDate: string;
  deliveryPlace: string;
  billPlacement: string;
  paymentTerm: string;
  quotationNumber: string;
  quotationDate: string;
  contactName: string;
  contactPhone: string;
  contactMobile: string;
  acceptanceCondition: string;
  note: string;
  status: string;
};

type Header = PurchaseOrderFormHeader;

export type PurchaseOrderInitialData = {
  id: string;
  header: Header;
  items: POItem[];
};

type PurchaseOrderFormProps = {
  customers: PurchaseOrderFormCustomer[];
  /** Omit to create a new PO; pass to edit an existing one. */
  initialData?: PurchaseOrderInitialData;
  /** What can no longer be edited (edit mode only). */
  lock?: PoLock | null;
};

function emptyHeader(): Header {
  return {
    poNumber: "",
    customerId: "",
    plant: "",
    poDate: todayInputValue(),
    deliveryDate: "",
    deliveryPlace: "",
    billPlacement: "",
    paymentTerm: "",
    quotationNumber: "",
    quotationDate: "",
    contactName: "",
    contactPhone: "",
    contactMobile: "",
    acceptanceCondition: "",
    note: "",
    status: "DRAFT",
  };
}

/** A titled card of fields. Fields switch to more columns when the card is wide enough (container query). */
function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="@container">{children}</CardBody>
    </Card>
  );
}

/** Small divider title for a second group of fields inside a Section. */
function SubHeading({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 mt-6 border-t border-slate-100 pt-5 text-xs font-semibold tracking-wide text-slate-500">
      {children}
    </p>
  );
}

const fieldGrid = "grid grid-cols-1 gap-4 @md:grid-cols-2";

export default function PurchaseOrderForm({ customers, initialData, lock = null }: PurchaseOrderFormProps) {
  const router = useRouter();

  const isEditMode = Boolean(initialData);
  const linesLocked = lock !== null;
  const identityLocked = lock?.identityLocked ?? false;

  const [header, setHeader] = useState<Header>(() => initialData?.header ?? emptyHeader());

  const [items, setItems] = useState<POItem[]>(() => initialData?.items ?? [newPOItem()]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCustomer = customers.find((customer) => customer.id === header.customerId);

  const totals = calcTotals(items.map((item) => ({ amount: previewPoLine(item), vat: item.vat })));

  function setField<K extends keyof Header>(key: K, value: Header[K]) {
    setHeader((current) => ({ ...current, [key]: value }));
  }

  function handleCustomerChange(value: string) {
    const customer = customers.find((item) => item.id === value);

    setHeader((current) => ({
      ...current,
      customerId: value,
      contactName: customer?.contactName ?? "",
      contactPhone: customer?.tel ?? "",
    }));
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, newPOItem()]);
  }

  function removeItem(id: string) {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems;
      }

      return currentItems.filter((item) => item.id !== id);
    });
  }

  function updateItem(id: string, field: POItemField, value: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (field === "lineType") {
          const lineType = toLineType(value);

          // A saved heading is stored without quantity and VAT: give it the defaults of a new line
          if (!lineHasAmount(item.lineType) && lineHasAmount(lineType) && item.quantity <= 0) {
            const { quantity, vat } = newPOItem();
            return { ...item, lineType, quantity, vat };
          }

          return { ...item, lineType };
        }

        if (field === "description" || field === "unit" || field === "discount") {
          return { ...item, [field]: value };
        }

        return { ...item, [field]: Number(value) || 0 };
      })
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!header.poNumber.trim()) {
      setError("กรุณากรอก PO No.");
      return;
    }

    if (!header.customerId) {
      setError("กรุณาเลือกลูกค้า");
      return;
    }

    if (!header.poDate) {
      setError("กรุณาเลือกวันที่ PO");
      return;
    }

    if (!linesLocked) {
      // Same validation as the API (lib/purchase-orders)
      try {
        cleanPoItems(items);
      } catch (validationError) {
        if (validationError instanceof MoneyInputError) {
          setError(validationError.message);
          return;
        }
        throw validationError;
      }
    }

    setLoading(true);

    try {
      const url = initialData ? `/api/purchase-orders/${initialData.id}` : "/api/purchase-orders";

      const response = await fetch(url, {
        method: initialData ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...header,
          // A new PO always starts as DRAFT (set by the API)
          status: isEditMode ? header.status : undefined,
          // Locked lines are not sent: the API keeps them as they are
          items: linesLocked
            ? undefined
            : items.map((item) => ({
                lineType: item.lineType,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                discount: item.discount,
                vat: item.vat,
              })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "ไม่สามารถบันทึก PO ได้");
        setLoading(false);
        return;
      }

      if (initialData) {
        setSuccess("แก้ไข PO สำเร็จ");

        // Keep the button disabled until we have left the page (prevents a second save)
        setTimeout(() => {
          router.push(`/purchase-orders/${initialData.id}`);
          router.refresh();
        }, 500);

        return;
      }

      setSuccess("บันทึก PO พร้อมรายการสำเร็จ");
      setHeader(emptyHeader());
      setItems([newPOItem()]);
      setLoading(false);

      router.refresh();
    } catch (submitError) {
      console.error(submitError);
      setError("ไม่สามารถเชื่อมต่อกับระบบได้");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {lock && <Alert tone="warning">{lock.message}</Alert>}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Section title="ข้อมูล PO" description="เลขที่ วันที่ และใบเสนอราคาที่อ้างอิง">
            <div className={fieldGrid}>
              <Field label="PO No." htmlFor="poNumber" required hint="เลขที่ PO ห้ามซ้ำ" className="min-w-0">
                <Input
                  id="poNumber"
                  type="text"
                  value={header.poNumber}
                  onChange={(event) => setField("poNumber", event.target.value)}
                  placeholder="เช่น PO-2026-001"
                  required
                  disabled={identityLocked}
                />
              </Field>

              <Field label="PO Date" htmlFor="poDate" required className="min-w-0">
                <Input
                  id="poDate"
                  type="date"
                  value={header.poDate}
                  onChange={(event) => setField("poDate", event.target.value)}
                  required
                />
              </Field>

              {isEditMode && (
                <Field label="สถานะ" htmlFor="status" className="min-w-0">
                  <Select
                    id="status"
                    value={header.status}
                    onChange={(event) => setField("status", event.target.value)}
                  >
                    {PO_STATUSES.map((status) => (
                      <option
                        key={status.value}
                        value={status.value}
                        // A PO with an invoice cannot be cancelled (cancel the invoice first)
                        disabled={
                          status.value === "CANCELLED" &&
                          lock?.reason === "INVOICED" &&
                          initialData?.header.status !== "CANCELLED"
                        }
                      >
                        {status.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>

            <SubHeading>อ้างอิง Quotation</SubHeading>

            <div className={fieldGrid}>
              <Field label="Quotation No." htmlFor="quotationNumber" className="min-w-0">
                <Input
                  id="quotationNumber"
                  type="text"
                  value={header.quotationNumber}
                  onChange={(event) => setField("quotationNumber", event.target.value)}
                  placeholder="เช่น QT-2026-001"
                />
              </Field>

              <Field label="Quotation Date" htmlFor="quotationDate" className="min-w-0">
                <Input
                  id="quotationDate"
                  type="date"
                  value={header.quotationDate}
                  onChange={(event) => setField("quotationDate", event.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="การส่งมอบ" description="สถานที่ วันที่ส่ง และเงื่อนไขการชำระเงิน">
            <div className={fieldGrid}>
              <Field label="Plant" htmlFor="plant" className="min-w-0">
                <Input
                  id="plant"
                  type="text"
                  value={header.plant}
                  onChange={(event) => setField("plant", event.target.value)}
                  placeholder="ระบุ Plant"
                />
              </Field>

              <Field label="Delivery Date" htmlFor="deliveryDate" className="min-w-0">
                <Input
                  id="deliveryDate"
                  type="date"
                  value={header.deliveryDate}
                  onChange={(event) => setField("deliveryDate", event.target.value)}
                />
              </Field>

              <Field label="Delivery Place" htmlFor="deliveryPlace" className="min-w-0">
                <Input
                  id="deliveryPlace"
                  type="text"
                  value={header.deliveryPlace}
                  onChange={(event) => setField("deliveryPlace", event.target.value)}
                  placeholder="สถานที่จัดส่ง"
                />
              </Field>

              <Field label="Bill Placement" htmlFor="billPlacement" className="min-w-0">
                <Input
                  id="billPlacement"
                  type="text"
                  value={header.billPlacement}
                  onChange={(event) => setField("billPlacement", event.target.value)}
                  placeholder="สถานที่วางบิล"
                />
              </Field>

              <Field label="Payment Term" htmlFor="paymentTerm" className="min-w-0 @md:col-span-2">
                <Input
                  id="paymentTerm"
                  type="text"
                  value={header.paymentTerm}
                  onChange={(event) => setField("paymentTerm", event.target.value)}
                  placeholder="เช่น เครดิต 30 วัน"
                />
              </Field>
            </div>
          </Section>
        </div>

        <Section title="ลูกค้า" description="เลือกลูกค้าและผู้ติดต่อของ PO นี้">
          <div className="space-y-4">
            {customers.length === 0 && (
              <Alert tone="warning">
                ยังไม่มีลูกค้าที่ใช้งานอยู่{" "}
                <Link href="/customers" className="font-medium underline underline-offset-2">
                  เพิ่มลูกค้า
                </Link>
              </Alert>
            )}

            <Field label="ลูกค้า" htmlFor="customerId" required>
              <Select
                id="customerId"
                value={header.customerId}
                onChange={(event) => handleCustomerChange(event.target.value)}
                required
                disabled={identityLocked}
              >
                <option value="">-- เลือกลูกค้า --</option>

                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} - {customer.name}
                    {customer.isActive ? "" : " (ปิดใช้งาน)"}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedCustomer && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-500">รหัส: {selectedCustomer.code}</p>
                </div>

                <DetailBlock label="ที่อยู่">{selectedCustomer.address}</DetailBlock>

                <div className="grid grid-cols-1 gap-3 @xs:grid-cols-2">
                  <div className="min-w-0">
                    <DetailBlock label="โทร">{selectedCustomer.tel}</DetailBlock>
                  </div>
                  <div className="min-w-0">
                    <DetailBlock label="เลขผู้เสียภาษี">{selectedCustomer.taxId}</DetailBlock>
                  </div>
                </div>
              </div>
            )}
          </div>

          <SubHeading>ผู้ติดต่อ</SubHeading>

          <div className="space-y-4">
            <Field label="Contact Name" htmlFor="contactName">
              <Input
                id="contactName"
                type="text"
                value={header.contactName}
                onChange={(event) => setField("contactName", event.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 @xs:grid-cols-2">
              <Field label="Contact Phone" htmlFor="contactPhone" className="min-w-0">
                <Input
                  id="contactPhone"
                  type="text"
                  value={header.contactPhone}
                  onChange={(event) => setField("contactPhone", event.target.value)}
                />
              </Field>

              <Field label="Contact Mobile" htmlFor="contactMobile" className="min-w-0">
                <Input
                  id="contactMobile"
                  type="text"
                  value={header.contactMobile}
                  onChange={(event) => setField("contactMobile", event.target.value)}
                />
              </Field>
            </div>
          </div>
        </Section>
      </div>

      <Card>
        <PurchaseOrderItemsTable
          items={items}
          readOnly={linesLocked}
          onAdd={addItem}
          onRemove={removeItem}
          onChange={updateItem}
        />

        <PurchaseOrderTotals {...totals} />
      </Card>

      <Section title="หมายเหตุ" description="เงื่อนไขการรับมอบและข้อความเพิ่มเติม">
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
          <Field label="เงื่อนไขการรับมอบ / ตรวจรับ" htmlFor="acceptanceCondition" className="min-w-0">
            <Textarea
              id="acceptanceCondition"
              value={header.acceptanceCondition}
              onChange={(event) => setField("acceptanceCondition", event.target.value)}
              rows={4}
              placeholder="ระบุเงื่อนไขการรับมอบหรือการตรวจรับ"
            />
          </Field>

          <Field label="หมายเหตุ" htmlFor="note" className="min-w-0">
            <Textarea
              id="note"
              value={header.note}
              onChange={(event) => setField("note", event.target.value)}
              rows={4}
              placeholder="หมายเหตุเพิ่มเติม"
            />
          </Field>
        </div>
      </Section>

      {/* Action bar: stays at the bottom of the screen while scrolling through the long form */}
      <div className="sticky bottom-4 z-20 space-y-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:px-5 print:hidden">
        {error && <Alert tone="danger">{error}</Alert>}

        {success && <Alert tone="success">{success}</Alert>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
            <p className="text-xs text-slate-500">ยอดรวมทั้งสิ้น</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">฿{formatMoney(totals.grandTotal)}</p>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex">
            <Button
              variant="outline"
              onClick={() =>
                router.push(initialData ? `/purchase-orders/${initialData.id}` : "/purchase-orders")
              }
            >
              ยกเลิก
            </Button>

            <Button type="submit" disabled={loading}>
              <Save />
              {loading ? "กำลังบันทึก..." : isEditMode ? "บันทึกการแก้ไข" : "บันทึก PO"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
