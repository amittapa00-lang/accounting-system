"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = {
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

type CustomerEditFormProps = {
  customer: Customer;
};

export default function CustomerEditForm({
  customer,
}: CustomerEditFormProps) {
  const router = useRouter();

  const [code, setCode] = useState(customer.code);
  const [name, setName] = useState(customer.name);
  const [address, setAddress] = useState(customer.address ?? "");
  const [tel, setTel] = useState(customer.tel ?? "");
  const [taxId, setTaxId] = useState(customer.taxId ?? "");
  const [branchType, setBranchType] = useState(
    customer.branchType ?? ""
  );
  const [branchNumber, setBranchNumber] = useState(
    customer.branchNumber ?? ""
  );
  const [contactName, setContactName] = useState(
    customer.contactName ?? ""
  );
  const [email, setEmail] = useState(customer.email ?? "");
  const [note, setNote] = useState(customer.note ?? "");
  const [isActive, setIsActive] = useState(customer.isActive);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          name,
          address,
          tel,
          taxId,
          branchType,
          branchNumber,
          contactName,
          email,
          note,
          isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error || "ไม่สามารถแก้ไขข้อมูลลูกค้าได้"
        );
        return;
      }

      setSuccess("แก้ไขข้อมูลลูกค้าสำเร็จ");

      router.refresh();
    } catch (error) {
      console.error(error);
      setError("ไม่สามารถเชื่อมต่อกับระบบได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          ข้อมูลลูกค้า
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          แก้ไขข้อมูลแล้วกดบันทึก
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="code"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              รหัสลูกค้า *
            </label>

            <input
              id="code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              ชื่อลูกค้า *
            </label>

            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="address"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            ที่อยู่
          </label>

          <textarea
            id="address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="tel"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              โทรศัพท์
            </label>

            <input
              id="tel"
              type="text"
              value={tel}
              onChange={(event) => setTel(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="taxId"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              เลขผู้เสียภาษี
            </label>

            <input
              id="taxId"
              type="text"
              value={taxId}
              onChange={(event) => setTaxId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
          <h3 className="mb-4 font-semibold text-gray-800">
            ข้อมูลสาขา
          </h3>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="branchType"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                ประเภทสาขา
              </label>

              <input
                id="branchType"
                type="text"
                value={branchType}
                onChange={(event) =>
                  setBranchType(event.target.value)
                }
                placeholder="สำนักงานใหญ่ / สาขา"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="branchNumber"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                เลขที่สาขา
              </label>

              <input
                id="branchNumber"
                type="text"
                value={branchNumber}
                onChange={(event) =>
                  setBranchNumber(event.target.value)
                }
                placeholder="00000"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
          <h3 className="mb-4 font-semibold text-gray-800">
            ผู้ติดต่อ
          </h3>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="contactName"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                ชื่อผู้ติดต่อ
              </label>

              <input
                id="contactName"
                type="text"
                value={contactName}
                onChange={(event) =>
                  setContactName(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="note"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            หมายเหตุ
          </label>

          <textarea
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
          <h3 className="mb-4 font-semibold text-gray-800">
            สถานะลูกค้า
          </h3>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) =>
                setIsActive(event.target.checked)
              }
              className="h-5 w-5 rounded border-gray-300"
            />

            <span className="text-sm font-medium text-gray-700">
              ลูกค้านี้ยังใช้งานอยู่
            </span>
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

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
      </form>
    </div>
  );
}