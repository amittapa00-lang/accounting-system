"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Save, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

/** Values offered for ประเภทสาขา (same list when creating and editing). */
const BRANCH_TYPES = ["สำนักงานใหญ่", "สาขา"];

export type CustomerFormCustomer = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  tel: string | null;
  taxId: string | null;
  branchType: string | null;
  branchNumber: string | null;
  contactName: string | null;
  email: string | null;
  note: string | null;
  isActive: boolean;
};

type CustomerFormProps = {
  /** Omit to create a new customer; pass to edit an existing one. */
  customer?: CustomerFormCustomer;
};

type Fields = {
  code: string;
  name: string;
  address: string;
  tel: string;
  taxId: string;
  branchType: string;
  branchNumber: string;
  contactName: string;
  email: string;
  note: string;
  isActive: boolean;
};

function toFields(customer?: CustomerFormCustomer): Fields {
  return {
    code: customer?.code ?? "",
    name: customer?.name ?? "",
    address: customer?.address ?? "",
    tel: customer?.tel ?? "",
    taxId: customer?.taxId ?? "",
    branchType: customer?.branchType ?? "",
    branchNumber: customer?.branchNumber ?? "",
    contactName: customer?.contactName ?? "",
    email: customer?.email ?? "",
    note: customer?.note ?? "",
    isActive: customer?.isActive ?? true,
  };
}

/**
 * A group of fields. Edit mode: its own card. Create mode: a titled block inside the single "เพิ่มลูกค้า" card.
 * Fields switch to two columns when the block is wide enough (container query), so the same markup
 * works in the narrow side card and in the wide edit page.
 */
function Section({ title, asCard, children }: { title: string; asCard: boolean; children: ReactNode }) {
  const body = <div className="@container space-y-4">{children}</div>;

  if (asCard) {
    return (
      <Card>
        <CardHeader title={title} />
        <CardBody>{body}</CardBody>
      </Card>
    );
  }

  return (
    <div className="px-5 py-5">
      <h3 className="mb-4 text-xs font-semibold tracking-wide text-slate-500">{title}</h3>
      {body}
    </div>
  );
}

const twoColumns = "grid grid-cols-1 gap-4 @sm:grid-cols-2";

export default function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(customer);

  const [fields, setFields] = useState<Fields>(() => toFields(customer));

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  // Keep a branch type saved before the dropdown existed (free text) selectable, so saving does not erase it
  const branchTypeOptions =
    fields.branchType && !BRANCH_TYPES.includes(fields.branchType)
      ? [...BRANCH_TYPES, fields.branchType]
      : BRANCH_TYPES;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!fields.code.trim()) {
      setError("กรุณากรอกรหัสลูกค้า");
      return;
    }

    if (!fields.name.trim()) {
      setError("กรุณากรอกชื่อลูกค้า");
      return;
    }

    setLoading(true);

    try {
      const { isActive, ...rest } = fields;

      const response = await fetch(customer ? `/api/customers/${customer.id}` : "/api/customers", {
        method: customer ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customer ? { ...rest, isActive } : rest),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || (isEditMode ? "ไม่สามารถแก้ไขข้อมูลลูกค้าได้" : "ไม่สามารถบันทึกลูกค้าได้"));
        return;
      }

      if (isEditMode) {
        // Show what was actually saved (the server trims values)
        if (data.customer) {
          setFields(toFields(data.customer));
        }
        setSuccess("แก้ไขข้อมูลลูกค้าสำเร็จ");
      } else {
        setFields(toFields());
        setSuccess("บันทึกลูกค้าสำเร็จ");
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setError("ไม่สามารถเชื่อมต่อกับระบบได้");
    } finally {
      setLoading(false);
    }
  }

  const customerSection = (
    <Section title="ข้อมูลลูกค้า" asCard={isEditMode}>
      <div className={twoColumns}>
        <Field label="รหัสลูกค้า" htmlFor="code" required>
          <Input
            id="code"
            type="text"
            value={fields.code}
            onChange={(event) => setField("code", event.target.value)}
            placeholder="เช่น CUST-001"
            required
          />
        </Field>

        <Field label="ชื่อลูกค้า" htmlFor="name" required>
          <Input
            id="name"
            type="text"
            value={fields.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="ชื่อบริษัท / ชื่อลูกค้า"
            required
          />
        </Field>
      </div>

      <Field label="เลขประจำตัวผู้เสียภาษี" htmlFor="taxId">
        <Input
          id="taxId"
          type="text"
          value={fields.taxId}
          onChange={(event) => setField("taxId", event.target.value)}
          placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก"
          className="tabular-nums"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ประเภทสาขา" htmlFor="branchType" className="min-w-0">
          <Select
            id="branchType"
            value={fields.branchType}
            onChange={(event) => setField("branchType", event.target.value)}
          >
            <option value="">เลือก</option>
            {branchTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="เลขที่สาขา" htmlFor="branchNumber" className="min-w-0">
          <Input
            id="branchNumber"
            type="text"
            value={fields.branchNumber}
            onChange={(event) => setField("branchNumber", event.target.value)}
            placeholder="00000"
            className="tabular-nums"
          />
        </Field>
      </div>
    </Section>
  );

  const contactSection = (
    <Section title="ข้อมูลติดต่อ" asCard={isEditMode}>
      <Field label="ชื่อผู้ติดต่อ" htmlFor="contactName">
        <Input
          id="contactName"
          type="text"
          value={fields.contactName}
          onChange={(event) => setField("contactName", event.target.value)}
          placeholder="ชื่อผู้ติดต่อ"
        />
      </Field>

      <div className={twoColumns}>
        <Field label="โทรศัพท์" htmlFor="tel">
          <Input
            id="tel"
            type="text"
            value={fields.tel}
            onChange={(event) => setField("tel", event.target.value)}
            placeholder="02-xxx-xxxx"
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={fields.email}
            onChange={(event) => setField("email", event.target.value)}
            placeholder="example@email.com"
          />
        </Field>
      </div>
    </Section>
  );

  const addressSection = (
    <Section title="ที่อยู่และหมายเหตุ" asCard={isEditMode}>
      <Field label="ที่อยู่" htmlFor="address">
        <Textarea
          id="address"
          value={fields.address}
          onChange={(event) => setField("address", event.target.value)}
          rows={3}
          placeholder="ที่อยู่ลูกค้า"
        />
      </Field>

      <Field label="หมายเหตุ" htmlFor="note">
        <Textarea
          id="note"
          value={fields.note}
          onChange={(event) => setField("note", event.target.value)}
          rows={3}
          placeholder="หมายเหตุเพิ่มเติม"
        />
      </Field>
    </Section>
  );

  // Edit mode only
  const statusSection = (
    <Section title="สถานะลูกค้า" asCard>
      <label
        htmlFor="isActive"
        className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
      >
        <input
          id="isActive"
          type="checkbox"
          checked={fields.isActive}
          onChange={(event) => setField("isActive", event.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-slate-900"
        />

        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900">ลูกค้านี้ยังใช้งานอยู่</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            ลูกค้าที่ปิดใช้งานจะไม่แสดงให้เลือกตอนสร้าง PO ใหม่
          </span>
        </span>
      </label>
    </Section>
  );

  const messages = (error || success) && (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}
    </div>
  );

  if (!isEditMode) {
    // Create: one compact card that sits next to the customer list
    return (
      <Card>
        <CardHeader title="เพิ่มลูกค้า" description="กรอกข้อมูลลูกค้า" />

        <form onSubmit={handleSubmit}>
          <div className="divide-y divide-slate-100">
            {customerSection}
            {contactSection}
            {addressSection}
          </div>

          {messages && <div className="px-5 pb-5">{messages}</div>}

          <CardFooter>
            <Button type="submit" disabled={loading} className="w-full">
              <UserPlus />
              {loading ? "กำลังบันทึก..." : "บันทึกลูกค้า"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  // Edit: one card per group, two columns on desktop, actions in a bar that stays in view
  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          {customerSection}
          {addressSection}
        </div>

        <div className="min-w-0 space-y-6">
          {contactSection}
          {statusSection}
        </div>
      </div>

      <div className="sticky bottom-4 z-20 mt-6 space-y-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:px-5 print:hidden">
        {messages}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-sm text-slate-500 sm:block">แก้ไขข้อมูลแล้วกดบันทึก</p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => router.push("/customers")}>
              ยกเลิก
            </Button>

            <Button type="submit" disabled={loading}>
              <Save />
              {loading ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
