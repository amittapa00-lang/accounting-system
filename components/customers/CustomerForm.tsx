"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const labelClass = "mb-2 block text-sm font-medium text-gray-700";

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

  return (
    <div className="@container rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{isEditMode ? "ข้อมูลลูกค้า" : "เพิ่มลูกค้า"}</h2>

        <p className="mt-1 text-sm text-gray-500">
          {isEditMode ? "แก้ไขข้อมูลแล้วกดบันทึก" : "กรอกข้อมูลลูกค้า"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-5 @lg:grid-cols-2">
          <div>
            <label htmlFor="code" className={labelClass}>
              รหัสลูกค้า *
            </label>

            <input
              id="code"
              type="text"
              value={fields.code}
              onChange={(event) => setField("code", event.target.value)}
              placeholder="เช่น CUST-001"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="name" className={labelClass}>
              ชื่อลูกค้า *
            </label>

            <input
              id="name"
              type="text"
              value={fields.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="ชื่อบริษัท / ชื่อลูกค้า"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="address" className={labelClass}>
            ที่อยู่
          </label>

          <textarea
            id="address"
            value={fields.address}
            onChange={(event) => setField("address", event.target.value)}
            rows={3}
            placeholder="ที่อยู่ลูกค้า"
            className={inputClass}
          />
        </div>

        <div className="grid gap-5 @lg:grid-cols-2">
          <div>
            <label htmlFor="tel" className={labelClass}>
              โทรศัพท์
            </label>

            <input
              id="tel"
              type="text"
              value={fields.tel}
              onChange={(event) => setField("tel", event.target.value)}
              placeholder="02-xxx-xxxx"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="taxId" className={labelClass}>
              เลขประจำตัวผู้เสียภาษี
            </label>

            <input
              id="taxId"
              type="text"
              value={fields.taxId}
              onChange={(event) => setField("taxId", event.target.value)}
              placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="branchType" className={labelClass}>
              ประเภทสาขา
            </label>

            <select
              id="branchType"
              value={fields.branchType}
              onChange={(event) => setField("branchType", event.target.value)}
              className={inputClass}
            >
              <option value="">เลือก</option>
              {branchTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="branchNumber" className={labelClass}>
              เลขที่สาขา
            </label>

            <input
              id="branchNumber"
              type="text"
              value={fields.branchNumber}
              onChange={(event) => setField("branchNumber", event.target.value)}
              placeholder="00000"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-5 @lg:grid-cols-2">
          <div>
            <label htmlFor="contactName" className={labelClass}>
              ชื่อผู้ติดต่อ
            </label>

            <input
              id="contactName"
              type="text"
              value={fields.contactName}
              onChange={(event) => setField("contactName", event.target.value)}
              placeholder="ชื่อผู้ติดต่อ"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>

            <input
              id="email"
              type="email"
              value={fields.email}
              onChange={(event) => setField("email", event.target.value)}
              placeholder="example@email.com"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="note" className={labelClass}>
            หมายเหตุ
          </label>

          <textarea
            id="note"
            value={fields.note}
            onChange={(event) => setField("note", event.target.value)}
            rows={3}
            placeholder="หมายเหตุเพิ่มเติม"
            className={inputClass}
          />
        </div>

        {isEditMode && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
            <h3 className="mb-4 font-semibold text-gray-800">สถานะลูกค้า</h3>

            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={fields.isActive}
                onChange={(event) => setField("isActive", event.target.checked)}
                className="h-5 w-5 rounded border-gray-300"
              />

              <span className="text-sm font-medium text-gray-700">ลูกค้านี้ยังใช้งานอยู่</span>
            </label>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {isEditMode ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.push("/customers")}
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              ยกเลิก
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "กำลังบันทึก..." : "บันทึกลูกค้า"}
          </button>
        )}
      </form>
    </div>
  );
}
