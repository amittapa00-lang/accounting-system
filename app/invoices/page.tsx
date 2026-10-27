import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import authOptions from "../../auth";
import { prisma } from "../../lib/prisma";

export const instant = false;

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

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
      items: {
        select: {
          id: true,
          amount: true,
        },
      },
    },
  });

  const formattedInvoices = invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    documentType: invoice.documentType,
    invoiceDate: invoice.invoiceDate.toISOString(),
    customerName: invoice.customerNameSnapshot,
    purchaseOrderId: invoice.purchaseOrder.id,
    purchaseOrderNumber: invoice.purchaseOrder.poNumber,
    subtotal: Number(invoice.subtotal),
    vat: Number(invoice.vat),
    grandTotal: Number(invoice.grandTotal),
    status: invoice.status,
    itemCount: invoice.items.length,
  }));

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(date));
  };

  const formatMoney = (amount: number) => {
    return amount.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getDocumentTypeName = (type: string) => {
    switch (type) {
      case "TAX_INVOICE_DELIVERY":
        return "ใบกำกับภาษี / ใบส่งของ / ใบแจ้งหนี้";

      case "BILLING_INVOICE":
        return "ใบวางบิล / ใบแจ้งหนี้";

      case "RECEIPT":
        return "ใบเสร็จรับเงิน";

      default:
        return type;
    }
  };

  const getStatusName = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "ฉบับร่าง";

      case "ISSUED":
        return "ออกเอกสารแล้ว";

      case "PAID":
        return "ชำระแล้ว";

      case "CANCELLED":
        return "ยกเลิก";

      default:
        return status;
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Invoice
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              รายการใบแจ้งหนี้และเอกสารการขาย
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
             ← กลับ Dashboard
          </Link>
        </div>

        {/* Summary */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              จำนวน Invoice
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-800">
              {formattedInvoices.length.toLocaleString("th-TH")}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              ยอดรวมทั้งหมด
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-800">
              {formatMoney(
                formattedInvoices.reduce(
                  (sum, invoice) =>
                    sum + invoice.grandTotal,
                  0
                )
              )}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Invoice ฉบับร่าง
            </p>

            <p className="mt-2 text-2xl font-bold text-amber-600">
              {
                formattedInvoices.filter(
                  (invoice) =>
                    invoice.status === "DRAFT"
                ).length
              }
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-1100px w-full">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Invoice No.
                  </th>

                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    วันที่
                  </th>

                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Customer
                  </th>

                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    PO No.
                  </th>

                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    ประเภทเอกสาร
                  </th>

                  <th className="px-4 py-3 text-right text-sm font-semibold">
                    จำนวนเงิน
                  </th>

                  <th className="px-4 py-3 text-center text-sm font-semibold">
                    สถานะ
                  </th>

                  <th className="px-4 py-3 text-center text-sm font-semibold">
                    จัดการ
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {formattedInvoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      ยังไม่มี Invoice
                    </td>
                  </tr>
                ) : (
                  formattedInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-800">
                          {invoice.invoiceNumber}
                        </div>

                        <div className="text-xs text-slate-400">
                          {invoice.itemCount} รายการ
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(invoice.invoiceDate)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-800">
                          {invoice.customerName}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <Link
                          href={`/purchase-orders/${invoice.purchaseOrderId}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          {invoice.purchaseOrderNumber}
                        </Link>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600">
                        {getDocumentTypeName(
                          invoice.documentType
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <span className="font-semibold text-slate-800">
                          {formatMoney(invoice.grandTotal)}
                        </span>

                        <div className="text-xs text-slate-400">
                          VAT{" "}
                          {formatMoney(invoice.vat)}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            invoice.status === "DRAFT"
                              ? "bg-amber-100 text-amber-700"
                              : invoice.status === "PAID"
                                ? "bg-emerald-100 text-emerald-700"
                                : invoice.status ===
                                    "CANCELLED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {getStatusName(
                            invoice.status
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="inline-flex rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                        >
                          ดูรายละเอียด
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}