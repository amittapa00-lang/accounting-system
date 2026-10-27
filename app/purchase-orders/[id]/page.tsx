import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import authOptions from "@/auth";
import { prisma } from "@/lib/prisma";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(date: Date | null) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("th-TH", {
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

export default async function PurchaseOrderDetailPage({
  params,
}: Props) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: {
      id,
    },
    include: {
      customer: true,
      items: {
        orderBy: {
          itemNo: "asc",
        },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          documentType: true,
          grandTotal: true,
          status: true,
        },
        orderBy: {
          invoiceDate: "desc",
        },
      },
    },
  });

  if (!purchaseOrder) {
    notFound();
  }

  const subtotal = purchaseOrder.items.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  );

  const vat = purchaseOrder.items.reduce(
    (sum, item) => {
      return sum + Number(item.amount) * (Number(item.vat) / 100);
    },
    0
  );

  const grandTotal = subtotal + vat;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2">
              <Link
                href="/purchase-orders"
                className="text-sm text-blue-600 hover:underline"
              >
                ← กลับรายการ PO
              </Link>
            </div>

            <h1 className="text-2xl font-bold text-slate-800">
              PO No. {purchaseOrder.poNumber}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              รายละเอียด Purchase Order
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/purchase-orders/${purchaseOrder.id}/edit`}
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              แก้ไข PO
            </Link>

            <Link
              href={`/invoices/new?purchaseOrderId=${purchaseOrder.id}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              สร้าง Invoice จาก PO
            </Link>
          </div>
        </div>

        {/* PO Information */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              ข้อมูล PO
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs text-slate-500">PO No.</label>
              <div className="mt-1 font-medium text-slate-800">
                {purchaseOrder.poNumber}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">วันที่ PO</label>
              <div className="mt-1 font-medium text-slate-800">
                {formatDate(purchaseOrder.poDate)}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">สถานะ</label>
              <div className="mt-1 font-medium text-slate-800">
                {getStatusLabel(purchaseOrder.status)}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">PLANT</label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.plant || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">วันที่ส่งสินค้า</label>
              <div className="mt-1 text-slate-800">
                {formatDate(purchaseOrder.deliveryDate)}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">
                สถานที่ส่งสินค้า
              </label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.deliveryPlace || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">วางบิล</label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.billPlacement || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">
                เครดิต / Payment Term
              </label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.paymentTerm || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">Quotation No.</label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.quotationNumber || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">
                วันที่ Quotation
              </label>
              <div className="mt-1 text-slate-800">
                {formatDate(purchaseOrder.quotationDate)}
              </div>
            </div>
          </div>
        </section>

        {/* Customer */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              ข้อมูลลูกค้า
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">รหัสลูกค้า</label>
              <div className="mt-1 font-medium text-slate-800">
                {purchaseOrder.customer.code}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">ชื่อลูกค้า</label>
              <div className="mt-1 font-medium text-slate-800">
                {purchaseOrder.customer.name}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">ที่อยู่</label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.customer.address || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">โทรศัพท์</label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.customer.tel || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">
                เลขประจำตัวผู้เสียภาษี
              </label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.customer.taxId || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">ผู้ติดต่อ</label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.contactName ||
                  purchaseOrder.customer.contactName ||
                  "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">
                โทรศัพท์ผู้ติดต่อ
              </label>
              <div className="mt-1 text-slate-800">
                {purchaseOrder.contactPhone ||
                  purchaseOrder.contactMobile ||
                  "-"}
              </div>
            </div>
          </div>
        </section>

        {/* Items */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              รายการสินค้า
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-sm">
                  <th className="px-4 py-3 text-center">#</th>
                  <th className="px-4 py-3 text-left">รายละเอียด</th>
                  <th className="px-4 py-3 text-right">จำนวน</th>
                  <th className="px-4 py-3 text-center">หน่วย</th>
                  <th className="px-4 py-3 text-right">ราคาต่อหน่วย</th>
                  <th className="px-4 py-3 text-right">ส่วนลด</th>
                  <th className="px-4 py-3 text-right">VAT</th>
                  <th className="px-4 py-3 text-right">จำนวนเงิน</th>
                </tr>
              </thead>

              <tbody>
                {purchaseOrder.items.map((item) => {
                  const discountText =
                    item.discountType === "AMOUNT"
                      ? formatMoney(Number(item.discount))
                      : `${formatMoney(Number(item.discount))}%`;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100"
                    >
                      <td className="px-4 py-4 text-center text-sm">
                        {item.itemNo}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-800">
                        {item.description}
                      </td>

                      <td className="px-4 py-4 text-right text-sm">
                        {formatMoney(Number(item.quantity))}
                      </td>

                      <td className="px-4 py-4 text-center text-sm">
                        {item.unit || "-"}
                      </td>

                      <td className="px-4 py-4 text-right text-sm">
                        {formatMoney(Number(item.unitPrice))}
                      </td>

                      <td className="px-4 py-4 text-right text-sm">
                        {discountText}
                      </td>

                      <td className="px-4 py-4 text-right text-sm">
                        {formatMoney(Number(item.vat))}%
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-medium">
                        {formatMoney(Number(item.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-md space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">รวมก่อน VAT</span>

                <span className="font-medium text-slate-800">
                  {formatMoney(subtotal)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">VAT</span>

                <span className="font-medium text-slate-800">
                  {formatMoney(vat)}
                </span>
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-3">
                <span className="font-semibold text-slate-800">
                  ยอดรวมทั้งสิ้น
                </span>

                <span className="text-xl font-bold text-blue-600">
                  {formatMoney(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Other information */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              ข้อมูลเพิ่มเติม
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">
                โทรศัพท์ผู้ติดต่อ
              </label>

              <div className="mt-1 text-slate-800">
                {purchaseOrder.contactPhone || "-"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">
                มือถือผู้ติดต่อ
              </label>

              <div className="mt-1 text-slate-800">
                {purchaseOrder.contactMobile || "-"}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">
                เงื่อนไขการรับสินค้า / ตรวจรับ
              </label>

              <div className="mt-1 whitespace-pre-wrap text-slate-800">
                {purchaseOrder.acceptanceCondition || "-"}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">หมายเหตุ</label>

              <div className="mt-1 whitespace-pre-wrap text-slate-800">
                {purchaseOrder.note || "-"}
              </div>
            </div>
          </div>
        </section>

        {/* Invoice */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              Invoice ที่เกี่ยวข้อง
            </h2>
          </div>

          {purchaseOrder.invoices.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              ยังไม่มี Invoice ที่สร้างจาก PO นี้
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-sm">
                    <th className="px-4 py-3 text-left">Invoice No.</th>
                    <th className="px-4 py-3 text-left">วันที่</th>
                    <th className="px-4 py-3 text-left">ประเภท</th>
                    <th className="px-4 py-3 text-right">ยอดรวม</th>
                    <th className="px-4 py-3 text-center">สถานะ</th>
                  </tr>
                </thead>

                <tbody>
                  {purchaseOrder.invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-slate-100"
                    >
                      <td className="px-4 py-4 text-sm font-medium">
                        {invoice.invoiceNumber}
                      </td>

                      <td className="px-4 py-4 text-sm">
                        {formatDate(invoice.invoiceDate)}
                      </td>

                      <td className="px-4 py-4 text-sm">
                        {invoice.documentType}
                      </td>

                      <td className="px-4 py-4 text-right text-sm">
                        {formatMoney(Number(invoice.grandTotal))}
                      </td>

                      <td className="px-4 py-4 text-center text-sm">
                        {invoice.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}