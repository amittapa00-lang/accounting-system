"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Customer = {
  id: string;
  code: string;
  name: string;
  tel: string | null;
  taxId: string | null;
  contactName: string | null;
  isActive: boolean;
};

type CustomerListProps = {
  customers: Customer[];
};

export default function CustomerList({
  customers,
}: CustomerListProps) {
  const [search, setSearch] = useState("");

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return customers;
    }

    return customers.filter((customer) => {
      return (
        customer.code.toLowerCase().includes(keyword) ||
        customer.name.toLowerCase().includes(keyword) ||
        (customer.tel ?? "").toLowerCase().includes(keyword) ||
        (customer.taxId ?? "").toLowerCase().includes(keyword) ||
        (customer.contactName ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [customers, search]);

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            รายชื่อลูกค้า
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            ค้นหาและจัดการข้อมูลลูกค้า
          </p>
        </div>

        <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
          พบ {filteredCustomers.length} / {customers.length} ราย
        </div>
      </div>

      <div className="mt-6">
        <label
          htmlFor="customer-search"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          ค้นหาลูกค้า
        </label>

        <div className="relative">
          <input
            id="customer-search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหารหัสลูกค้า, ชื่อลูกค้า, เบอร์โทร หรือเลขผู้เสียภาษี..."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-20 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            >
              ล้าง
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        {filteredCustomers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
            <p className="font-medium text-gray-600">
              ไม่พบข้อมูลลูกค้า
            </p>

            {search && (
              <p className="mt-2 text-sm text-gray-400">
                ลองค้นหาด้วยคำอื่น
              </p>
            )}
          </div>
        ) : (
          <table className="w-full min-w-850px border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                  รหัส
                </th>

                <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                  ชื่อลูกค้า
                </th>

                <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                  โทรศัพท์
                </th>

                <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                  เลขผู้เสียภาษี
                </th>

                <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                  ผู้ติดต่อ
                </th>

                <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                  สถานะ
                </th>

                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  จัดการ
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b last:border-b-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                    {customer.code}
                  </td>

                  <td className="px-4 py-4 text-sm text-gray-800">
                    {customer.name}
                  </td>

                  <td className="px-4 py-4 text-sm text-gray-600">
                    {customer.tel || "-"}
                  </td>

                  <td className="px-4 py-4 text-sm text-gray-600">
                    {customer.taxId || "-"}
                  </td>

                  <td className="px-4 py-4 text-sm text-gray-600">
                    {customer.contactName || "-"}
                  </td>

                  <td className="px-4 py-4">
                    {customer.isActive ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        ใช้งาน
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                        ปิดใช้งาน
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="inline-flex rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      ดู / แก้ไข
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}