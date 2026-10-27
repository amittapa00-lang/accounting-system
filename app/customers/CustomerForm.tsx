"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function CustomerForm() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [tel, setTel] = useState("");
  const [taxId, setTaxId] = useState("");
  const [branchType, setBranchType] = useState("");
  const [branchNumber, setBranchNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "ไม่สามารถบันทึกลูกค้าได้");
        setLoading(false);
        return;
      }

      setSuccess("บันทึกลูกค้าสำเร็จ");

      setCode("");
      setName("");
      setAddress("");
      setTel("");
      setTaxId("");
      setBranchType("");
      setBranchNumber("");
      setContactName("");
      setEmail("");
      setNote("");

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
      <h2 className="text-xl font-bold text-gray-900">
        เพิ่มลูกค้า
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        กรอกข้อมูลลูกค้า
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
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
            placeholder="เช่น CUST-001"
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
            placeholder="ชื่อบริษัท / ชื่อลูกค้า"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
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
            rows={3}
            placeholder="ที่อยู่ลูกค้า"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

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
            placeholder="02-xxx-xxxx"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="taxId"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            เลขประจำตัวผู้เสียภาษี
          </label>

          <input
            id="taxId"
            type="text"
            value={taxId}
            onChange={(event) => setTaxId(event.target.value)}
            placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="branchType"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              ประเภทสาขา
            </label>

            <select
              id="branchType"
              value={branchType}
              onChange={(event) => setBranchType(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 outline-none focus:border-blue-500"
            >
              <option value="">เลือก</option>
              <option value="สำนักงานใหญ่">
                สำนักงานใหญ่
              </option>
              <option value="สาขา">
                สาขา
              </option>
            </select>
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
              onChange={(event) => setBranchNumber(event.target.value)}
              placeholder="00000"
              className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-blue-500"
            />
          </div>
        </div>

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
            onChange={(event) => setContactName(event.target.value)}
            placeholder="ชื่อผู้ติดต่อ"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
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
            placeholder="example@email.com"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
          />
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
            rows={3}
            placeholder="หมายเหตุเพิ่มเติม"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-600">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "กำลังบันทึก..." : "บันทึกลูกค้า"}
        </button>
      </form>
    </div>
  );
}