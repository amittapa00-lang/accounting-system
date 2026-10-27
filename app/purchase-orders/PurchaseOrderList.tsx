"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PurchaseOrder = {
  id: string;
  poNumber: string;
  poDate: string;
  status: string;
  customer: {
    code: string;
    name: string;
  };
  items: {
    id: string;
    amount: number;
  }[];
};

type Props = {
  purchaseOrders: PurchaseOrder[];
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStatusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "ฉบับร่าง";

    case "CONFIRMED":
      return "ยืนยันแล้ว";

    case "COMPLETED":
      return "เสร็จสิ้น";

    case "CANCELLED":
      return "ยกเลิก";

    default:
      return status;
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-yellow-100 text-yellow-700";

    case "CONFIRMED":
      return "bg-blue-100 text-blue-700";

    case "COMPLETED":
      return "bg-green-100 text-green-700";

    case "CANCELLED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function PurchaseOrderList({
  purchaseOrders,
}: Props) {
  const [search, setSearch] = useState("");

  const filteredPurchaseOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return purchaseOrders;
    }

    return purchaseOrders.filter((po) => {
      return (
        po.poNumber.toLowerCase().includes(keyword) ||
        po.customer.code.toLowerCase().includes(keyword) ||
        po.customer.name.toLowerCase().includes(keyword)
      );
    });
  }, [search, purchaseOrders]);

  return (
    
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            รายการ Purchase Order
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            จัดการและค้นหาใบสั่งซื้อของลูกค้า
          </p>
        </div>
        <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
             ← กลับ Dashboard
          </Link>
      </div>

      <Link
          href="/purchase-orders/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          + เพิ่ม PO
        </Link>

      {/* Search */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา PO No., รหัสลูกค้า หรือชื่อลูกค้า..."
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl bg-white px-5 py-4 shadow-sm">
        <div className="text-sm text-slate-500">
          พบทั้งหมด{" "}
          <span className="font-semibold text-slate-800">
            {filteredPurchaseOrders.length}
          </span>{" "}
          รายการ
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-sm text-slate-600">
                <th className="whitespace-nowrap px-5 py-4 font-semibold">
                  PO No.
                </th>

                <th className="whitespace-nowrap px-5 py-4 font-semibold">
                  วันที่ PO
                </th>

                <th className="whitespace-nowrap px-5 py-4 font-semibold">
                  ลูกค้า
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                  จำนวนรายการ
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right font-semibold">
                  ยอดรวม
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                  สถานะ
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                  จัดการ
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredPurchaseOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    {search
                      ? "ไม่พบข้อมูล PO ที่ค้นหา"
                      : "ยังไม่มีข้อมูล PO"}
                  </td>
                </tr>
              ) : (
                filteredPurchaseOrders.map((po) => {
                  const total = po.items.reduce(
                    (sum, item) => sum + item.amount,
                    0
                  );

                  return (
                    <tr
                      key={po.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      {/* PO Number */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800">
                          {po.poNumber}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {formatDate(po.poDate)}
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">
                          {po.customer.name}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          รหัสลูกค้า: {po.customer.code}
                        </div>
                      </td>

                      {/* Item count */}
                      <td className="px-5 py-4 text-center text-sm text-slate-600">
                        {po.items.length}
                      </td>

                      {/* Total */}
                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-slate-800">
                        {formatMoney(total)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                            po.status
                          )}`}
                        >
                          {getStatusLabel(po.status)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-center">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-600"
                        >
                          ดูรายละเอียด
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}