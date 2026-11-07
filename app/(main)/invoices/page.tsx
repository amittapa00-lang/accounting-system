import Link from "next/link";

import { requirePageSession } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { isBilledInvoiceStatus } from "@/lib/invoices";
import { documentTypeLabel, invoiceStatusClass, invoiceStatusLabel } from "@/lib/labels";
import { sumMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function InvoicesPage() {
  await requirePageSession();

  const invoices = await prisma.invoice.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
        },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  // Only invoices that were actually billed (not drafts, not cancelled)
  const billedTotal = sumMoney(
    invoices.filter((invoice) => isBilledInvoiceStatus(invoice.status)).map((invoice) => invoice.grandTotal)
  );

  const draftCount = invoices.filter((invoice) => invoice.status === "DRAFT").length;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Invoice</h1>

          <p className="mt-1 text-sm text-slate-500">รายการใบแจ้งหนี้และเอกสารการขาย</p>
        </div>

        {/* Summary */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">จำนวน Invoice</p>

            <p className="mt-2 text-2xl font-bold text-slate-800">{invoices.length.toLocaleString("en-US")}</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">ยอดรวม Invoice ที่ออกแล้ว</p>

            <p className="mt-2 text-2xl font-bold text-slate-800">{formatMoney(billedTotal)}</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Invoice ฉบับร่าง</p>

            <p className="mt-2 text-2xl font-bold text-amber-600">{draftCount}</p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Invoice No.</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">วันที่</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">PO No.</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">ประเภทเอกสาร</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">จำนวนเงิน</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">สถานะ</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">จัดการ</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                      ยังไม่มี Invoice
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => {
                    const itemCount = invoice._count.items;
                    const isCancelled = invoice.status === "CANCELLED";

                    return (
                      <tr key={invoice.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-800">{invoice.invoiceNumber}</div>

                          <div className="text-xs text-slate-400">{itemCount} รายการ</div>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">{formatDate(invoice.invoiceDate)}</td>

                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-800">{invoice.customerNameSnapshot}</div>
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            href={`/purchase-orders/${invoice.purchaseOrder.id}`}
                            className="text-sm font-medium text-blue-600 hover:underline"
                          >
                            {invoice.purchaseOrder.poNumber}
                          </Link>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">{documentTypeLabel(invoice.documentType)}</td>

                        <td className="px-4 py-4 text-right">
                          <span className="font-semibold text-slate-800">{formatMoney(invoice.grandTotal)}</span>

                          <div className="text-xs text-slate-400">VAT {formatMoney(invoice.vat)}</div>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${invoiceStatusClass(
                              invoice.status
                            )}`}
                          >
                            {invoiceStatusLabel(invoice.status)}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-wrap justify-center gap-2">
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="inline-flex rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                            >
                              ดูรายละเอียด
                            </Link>

                            {/* Invoice ที่ยกเลิกแล้วดาวน์โหลดไม่ได้ (route ตอบ 409) */}
                            {!isCancelled && (
                              <a
                                href={`/api/invoices/${invoice.id}/excel`}
                                className="inline-flex whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                              >
                                ↓ ดาวน์โหลด Excel
                              </a>
                            )}
                          </div>
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
    </main>
  );
}
