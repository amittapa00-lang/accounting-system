"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { todayInputValue } from "@/lib/format";
import { PO_STATUSES } from "@/lib/labels";
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

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-gray-600";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>

      {children}

      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-5 border-b pb-3 text-lg font-bold text-gray-800">{title}</h3>
      {children}
    </section>
  );
}

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
    <div className="rounded-xl bg-white p-8 shadow-sm">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          {isEditMode ? "แก้ไข Purchase Order" : "สร้าง Purchase Order"}
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {isEditMode ? "แก้ไขข้อมูล PO และรายการสินค้า" : "กรอกข้อมูลใบสั่งซื้อและรายการสินค้า"}
        </p>
      </div>

      {lock && (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {lock.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <Section title="ข้อมูลหลัก">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="poNumber" label="PO No. *" hint="เลขที่ PO ห้ามซ้ำ">
              <input
                id="poNumber"
                type="text"
                value={header.poNumber}
                onChange={(event) => setField("poNumber", event.target.value)}
                placeholder="เช่น PO-2026-001"
                required
                disabled={identityLocked}
                className={inputClass}
              />
            </Field>

            <Field id="poDate" label="PO Date *">
              <input
                id="poDate"
                type="date"
                value={header.poDate}
                onChange={(event) => setField("poDate", event.target.value)}
                required
                className={inputClass}
              />
            </Field>

            {isEditMode && (
              <Field id="status" label="สถานะ">
                <select
                  id="status"
                  value={header.status}
                  onChange={(event) => setField("status", event.target.value)}
                  className={inputClass}
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
                </select>
              </Field>
            )}
          </div>
        </Section>

        <Section title="ข้อมูลลูกค้า">
          <Field id="customerId" label="ลูกค้า *">
            <select
              id="customerId"
              value={header.customerId}
              onChange={(event) => handleCustomerChange(event.target.value)}
              required
              disabled={identityLocked}
              className={inputClass}
            >
              <option value="">-- เลือกลูกค้า --</option>

              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} - {customer.name}
                  {customer.isActive ? "" : " (ปิดใช้งาน)"}
                </option>
              ))}
            </select>
          </Field>

          {selectedCustomer && (
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-5">
              <h4 className="font-semibold text-blue-900">ข้อมูลลูกค้า</h4>

              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <p>
                  <span className="font-medium">รหัส:</span> {selectedCustomer.code}
                </p>

                <p>
                  <span className="font-medium">ชื่อ:</span> {selectedCustomer.name}
                </p>

                <p className="md:col-span-2">
                  <span className="font-medium">ที่อยู่:</span> {selectedCustomer.address || "-"}
                </p>

                <p>
                  <span className="font-medium">โทร:</span> {selectedCustomer.tel || "-"}
                </p>

                <p>
                  <span className="font-medium">เลขผู้เสียภาษี:</span> {selectedCustomer.taxId || "-"}
                </p>
              </div>
            </div>
          )}
        </Section>

        <Section title="การส่งมอบ">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="plant" label="Plant">
              <input
                id="plant"
                type="text"
                value={header.plant}
                onChange={(event) => setField("plant", event.target.value)}
                placeholder="ระบุ Plant"
                className={inputClass}
              />
            </Field>

            <Field id="deliveryDate" label="Delivery Date">
              <input
                id="deliveryDate"
                type="date"
                value={header.deliveryDate}
                onChange={(event) => setField("deliveryDate", event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field id="deliveryPlace" label="Delivery Place">
              <input
                id="deliveryPlace"
                type="text"
                value={header.deliveryPlace}
                onChange={(event) => setField("deliveryPlace", event.target.value)}
                placeholder="สถานที่จัดส่ง"
                className={inputClass}
              />
            </Field>

            <Field id="billPlacement" label="Bill Placement">
              <input
                id="billPlacement"
                type="text"
                value={header.billPlacement}
                onChange={(event) => setField("billPlacement", event.target.value)}
                placeholder="สถานที่วางบิล"
                className={inputClass}
              />
            </Field>

            <div className="md:col-span-2">
              <Field id="paymentTerm" label="Payment Term">
                <input
                  id="paymentTerm"
                  type="text"
                  value={header.paymentTerm}
                  onChange={(event) => setField("paymentTerm", event.target.value)}
                  placeholder="เช่น เครดิต 30 วัน"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="อ้างอิง Quotation">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="quotationNumber" label="Quotation No.">
              <input
                id="quotationNumber"
                type="text"
                value={header.quotationNumber}
                onChange={(event) => setField("quotationNumber", event.target.value)}
                placeholder="เช่น QT-2026-001"
                className={inputClass}
              />
            </Field>

            <Field id="quotationDate" label="Quotation Date">
              <input
                id="quotationDate"
                type="date"
                value={header.quotationDate}
                onChange={(event) => setField("quotationDate", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="ผู้ติดต่อ">
          <div className="grid gap-5 md:grid-cols-3">
            <Field id="contactName" label="Contact Name">
              <input
                id="contactName"
                type="text"
                value={header.contactName}
                onChange={(event) => setField("contactName", event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field id="contactPhone" label="Contact Phone">
              <input
                id="contactPhone"
                type="text"
                value={header.contactPhone}
                onChange={(event) => setField("contactPhone", event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field id="contactMobile" label="Contact Mobile">
              <input
                id="contactMobile"
                type="text"
                value={header.contactMobile}
                onChange={(event) => setField("contactMobile", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <section>
          <PurchaseOrderItemsTable
            items={items}
            readOnly={linesLocked}
            onAdd={addItem}
            onRemove={removeItem}
            onChange={updateItem}
          />

          <PurchaseOrderTotals {...totals} />
        </section>

        <Section title="เงื่อนไขการรับมอบ / ตรวจรับ">
          <textarea
            value={header.acceptanceCondition}
            onChange={(event) => setField("acceptanceCondition", event.target.value)}
            rows={4}
            placeholder="ระบุเงื่อนไขการรับมอบหรือการตรวจรับ"
            className={inputClass}
          />
        </Section>

        <Section title="หมายเหตุ">
          <textarea
            value={header.note}
            onChange={(event) => setField("note", event.target.value)}
            rows={4}
            placeholder="หมายเหตุเพิ่มเติม"
            className={inputClass}
          />
        </Section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() =>
              router.push(initialData ? `/purchase-orders/${initialData.id}` : "/purchase-orders")
            }
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ยกเลิก
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "กำลังบันทึก..." : isEditMode ? "บันทึกการแก้ไข" : "บันทึก PO"}
          </button>
        </div>
      </form>
    </div>
  );
}
