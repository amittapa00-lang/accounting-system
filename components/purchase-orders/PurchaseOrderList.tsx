"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, ClipboardList, Plus, Search, SearchX, X } from "lucide-react";

import { PoStatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";

type PurchaseOrder = {
  id: string;
  poNumber: string;
  poDate: string;
  status: string;
  customer: {
    code: string;
    name: string;
  };
  itemCount: number;
  /** subtotal + VAT */
  grandTotal: number;
};

type Props = {
  purchaseOrders: PurchaseOrder[];
};

export default function PurchaseOrderList({ purchaseOrders }: Props) {
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

  if (purchaseOrders.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="ยังไม่มีข้อมูล PO"
          description="เริ่มต้นด้วยการสร้าง Purchase Order แรก แล้วออก Invoice จาก PO ได้ภายหลัง"
          action={
            <ButtonLink href="/purchase-orders/new" variant="outline" size="sm">
              <Plus /> สร้าง PO ใหม่
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      {/* Search + count */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 sm:max-w-md sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา PO No., รหัสลูกค้า หรือชื่อลูกค้า..."
            aria-label="ค้นหา PO"
            className="pl-9 pr-10"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="ล้างคำค้นหา"
              title="ล้าง"
              className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <p className="shrink-0 text-sm text-slate-500">
          พบทั้งหมด{" "}
          <span className="font-semibold tabular-nums text-slate-900">{filteredPurchaseOrders.length}</span> รายการ
        </p>
      </div>

      {filteredPurchaseOrders.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="ไม่พบข้อมูล PO ที่ค้นหา"
          description="ลองค้นหาด้วยเลขที่ PO รหัสลูกค้า หรือชื่อลูกค้าอื่น"
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              ล้างการค้นหา
            </Button>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>PO No.</Th>
              <Th>วันที่ PO</Th>
              <Th>ลูกค้า</Th>
              <Th align="center">จำนวนรายการ</Th>
              <Th align="right">ยอดรวม (รวม VAT)</Th>
              <Th>สถานะ</Th>
              {/* relative: keeps the sr-only text inside the scrolling table on phones */}
              <Th align="right" className="relative">
                <span className="sr-only">จัดการ</span>
              </Th>
            </tr>
          </thead>

          <tbody>
            {filteredPurchaseOrders.map((po) => (
              <Tr key={po.id}>
                <Td className="whitespace-nowrap">
                  <Link
                    href={`/purchase-orders/${po.id}`}
                    className="font-medium text-slate-900 hover:text-brand-700"
                  >
                    {po.poNumber}
                  </Link>
                </Td>

                <Td className="whitespace-nowrap">{formatDate(po.poDate)}</Td>

                <Td className="min-w-48">
                  <p className="font-medium text-slate-900">{po.customer.name}</p>
                  <p className="text-xs text-slate-500">รหัสลูกค้า: {po.customer.code}</p>
                </Td>

                <Td align="center" className="tabular-nums">
                  {po.itemCount}
                </Td>

                <Td align="right" className="whitespace-nowrap font-medium tabular-nums text-slate-900">
                  {formatMoney(po.grandTotal)}
                </Td>

                <Td>
                  <PoStatusBadge status={po.status} />
                </Td>

                <Td align="right">
                  <ButtonLink href={`/purchase-orders/${po.id}`} variant="ghost" size="sm">
                    ดูรายละเอียด <ChevronRight />
                  </ButtonLink>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
