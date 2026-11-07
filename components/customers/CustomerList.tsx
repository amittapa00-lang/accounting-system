"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, SearchX, UserPlus, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";

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
    <Card>
      <CardHeader
        title="รายชื่อลูกค้า"
        description={
          <>
            พบ <span className="font-medium tabular-nums text-slate-700">{filteredCustomers.length}</span> /{" "}
            <span className="tabular-nums">{customers.length}</span> ราย
          </>
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="ยังไม่มีข้อมูลลูกค้า"
          description="เพิ่มลูกค้ารายแรกจากแบบฟอร์มเพิ่มลูกค้า"
          action={
            <ButtonAnchor href="#new-customer" variant="outline" size="sm">
              <UserPlus /> เพิ่มลูกค้า
            </ButtonAnchor>
          }
        />
      ) : (
        <>
          <div className="border-b border-slate-100 px-5 py-3">
            <label htmlFor="customer-search" className="sr-only">
              ค้นหาลูกค้า
            </label>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

              <Input
                id="customer-search"
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหารหัสลูกค้า, ชื่อลูกค้า, เบอร์โทร หรือเลขผู้เสียภาษี..."
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
          </div>

          {filteredCustomers.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="ไม่พบข้อมูลลูกค้า"
              description="ลองค้นหาด้วยคำอื่น"
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
                  <Th>ชื่อลูกค้า / รหัส</Th>
                  <Th>โทรศัพท์</Th>
                  <Th>เลขผู้เสียภาษี</Th>
                  <Th>ผู้ติดต่อ</Th>
                  <Th>สถานะ</Th>
                  {/* relative: keeps the sr-only text inside the scrolling table on phones */}
                  <Th align="right" className="relative">
                    <span className="sr-only">จัดการ</span>
                  </Th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => (
                  <Tr key={customer.id}>
                    <Td className="min-w-40">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {customer.name}
                      </Link>
                      <p className="text-xs text-slate-500">{customer.code}</p>
                    </Td>

                    <Td className="whitespace-nowrap">{customer.tel || "-"}</Td>

                    <Td className="whitespace-nowrap tabular-nums">{customer.taxId || "-"}</Td>

                    <Td>{customer.contactName || "-"}</Td>

                    <Td>
                      {customer.isActive ? (
                        <Badge tone="success" dot>
                          ใช้งาน
                        </Badge>
                      ) : (
                        <Badge tone="neutral" dot>
                          ปิดใช้งาน
                        </Badge>
                      )}
                    </Td>

                    <Td align="right">
                      <ButtonLink
                        href={`/customers/${customer.id}`}
                        variant="ghost"
                        size="icon"
                        aria-label={`ดู / แก้ไข ${customer.name}`}
                        title="ดู / แก้ไข"
                      >
                        <ChevronRight />
                      </ButtonLink>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </Card>
  );
}
