import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import authOptions from "../../../auth";
import { prisma } from "../../../lib/prisma";
import IssueInvoiceButton from "../IssueInvoiceButton";

export const instant = false;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatMoney(value: number) {
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: Date) {
  return value.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDocumentTypeLabel(type: string) {
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
}

function getPaymentMethodLabel(method: string) {
  switch (method) {
    case "TRANSFER":
      return "โอนเงิน";

    case "CASH":
      return "เงินสด";

    case "CHEQUE":
      return "เช็ค";

    case "CREDIT_CARD":
      return "บัตรเครดิต";

    case "OTHER":
      return "อื่น ๆ";

    default:
      return method;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "ฉบับร่าง";

    case "ISSUED":
      return "ออก Invoice แล้ว";

    case "PARTIAL":
      return "ชำระบางส่วน";

    case "PAID":
      return "ชำระครบแล้ว";

    case "CANCELLED":
      return "ยกเลิก";

    default:
      return status;
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "PAID":
      return "bg-emerald-100 text-emerald-700";

    case "PARTIAL":
      return "bg-blue-100 text-blue-700";

    case "ISSUED":
      return "bg-amber-100 text-amber-700";

    case "CANCELLED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function InvoiceDetailPage({
  params,
}: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: {
      id,
    },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          poDate: true,
        },
      },
      items: {
        orderBy: {
          itemNo: "asc",
        },
      },
      payments: {
        orderBy: {
          paymentDate: "desc",
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  // ==========================================
  // คำนวณยอดรับชำระ
  // ==========================================

  const totalPaid = invoice.payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount),
    0
  );

  const grandTotal = Number(invoice.grandTotal);

  const remainingAmount =
    grandTotal - totalPaid;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* ================================== */}
        {/* Header */}
        {/* ================================== */}

        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Invoice {invoice.invoiceNumber}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              รายละเอียด Invoice
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
  <Link
    href="/invoices"
    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
  >
    กลับ
  </Link>

  <Link
    href={`/purchase-orders/${invoice.purchaseOrder.id}`}
    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
  >
    ดู Purchase Order
  </Link>

  {invoice.status === "DRAFT" && (
    <IssueInvoiceButton
      invoiceId={invoice.id}
    />
  )}

  {remainingAmount > 0 &&
    invoice.status !== "DRAFT" && (
      <Link
        href={`/payments/new?invoiceId=${invoice.id}`}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        รับชำระเงิน
      </Link>

      
    )}
    <Link
  href={`/invoices/${invoice.id}/print`}
  target="_blank"
  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
>
  🖨️ พิมพ์ / PDF
</Link>
</div>

        </div>
        

        {/* ================================== */}
        {/* Invoice Information */}
        {/* ================================== */}

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* Document */}

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-800">
              ข้อมูลเอกสาร
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Invoice No.
                </span>

                <span className="font-semibold text-slate-800">
                  {invoice.invoiceNumber}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  ประเภทเอกสาร
                </span>

                <span className="text-right text-slate-800">
                  {getDocumentTypeLabel(
                    invoice.documentType
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  วันที่ Invoice
                </span>

                <span className="text-slate-800">
                  {formatDate(
                    invoice.invoiceDate
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  วันครบกำหนด
                </span>

                <span className="text-slate-800">
                  {invoice.dueDate
                    ? formatDate(invoice.dueDate)
                    : "-"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Payment Term
                </span>

                <span className="text-slate-800">
                  {invoice.paymentTerm || "-"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Sale Order No.
                </span>

                <span className="text-slate-800">
                  {invoice.saleOrderNumber || "-"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">
                  สถานะ
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                    invoice.status
                  )}`}
                >
                  {getStatusLabel(
                    invoice.status
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Customer */}

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-800">
              ข้อมูลลูกค้า
            </h2>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500">
                  รหัสลูกค้า
                </p>

                <p className="font-semibold text-slate-800">
                  {invoice.customerCodeSnapshot ||
                    "-"}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  ชื่อลูกค้า
                </p>

                <p className="font-semibold text-slate-800">
                  {invoice.customerNameSnapshot}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  ที่อยู่
                </p>

                <p className="whitespace-pre-wrap text-slate-800">
                  {invoice.customerAddressSnapshot ||
                    "-"}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  เลขประจำตัวผู้เสียภาษี
                </p>

                <p className="text-slate-800">
                  {invoice.customerTaxIdSnapshot ||
                    "-"}
                </p>
              </div>

              <div>
                <p className="text-slate-500">
                  สถานที่จัดส่ง
                </p>

                <p className="whitespace-pre-wrap text-slate-800">
                  {invoice.shipToSnapshot || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================================== */}
        {/* Items */}
        {/* ================================== */}

        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-800">
              รายการสินค้า
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">
                    #
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    รายละเอียด
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    จำนวน
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    หน่วย
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    ราคาต่อหน่วย
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    ส่วนลด %
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    จำนวนเงิน
                  </th>
                </tr>
              </thead>

              <tbody>
                {invoice.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-100"
                  >
                    <td className="px-4 py-3 text-center text-slate-600">
                      {item.itemNo}
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      {item.description}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-700">
                      {Number(
                        item.quantity
                      ).toLocaleString(
                        "th-TH"
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {item.unit || "-"}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatMoney(
                        Number(item.unitPrice)
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-700">
                      {Number(
                        item.discountPercent
                      ).toLocaleString(
                        "th-TH"
                      )}
                      %
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatMoney(
                        Number(item.amount)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================================== */}
        {/* Invoice Summary */}
        {/* ================================== */}

        <div className="mb-6 flex justify-end">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex justify-between py-2 text-sm">
              <span className="text-slate-500">
                Subtotal
              </span>

              <span className="font-medium text-slate-800">
                {formatMoney(
                  Number(invoice.subtotal)
                )}{" "}
                บาท
              </span>
            </div>

            <div className="flex justify-between py-2 text-sm">
              <span className="text-slate-500">
                VAT
              </span>

              <span className="font-medium text-slate-800">
                {formatMoney(
                  Number(invoice.vat)
                )}{" "}
                บาท
              </span>
            </div>

            <div className="my-2 border-t border-slate-200" />

            <div className="flex justify-between py-2">
              <span className="font-bold text-slate-800">
                ยอดรวมทั้งสิ้น
              </span>

              <span className="text-xl font-bold text-slate-800">
                {formatMoney(grandTotal)} บาท
              </span>
            </div>
          </div>
        </div>

        {/* ================================== */}
        {/* Payment Summary */}
        {/* ================================== */}

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              ยอด Invoice
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-800">
              {formatMoney(grandTotal)} บาท
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm text-emerald-700">
              ชำระแล้ว
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {formatMoney(totalPaid)} บาท
            </p>
          </div>

          <div
            className={`rounded-xl border p-5 ${
              remainingAmount > 0
                ? "border-red-200 bg-red-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <p
              className={`text-sm ${
                remainingAmount > 0
                  ? "text-red-700"
                  : "text-emerald-700"
              }`}
            >
              คงเหลือ
            </p>

            <p
              className={`mt-2 text-2xl font-bold ${
                remainingAmount > 0
                  ? "text-red-700"
                  : "text-emerald-700"
              }`}
            >
              {formatMoney(
                Math.max(remainingAmount, 0)
              )}{" "}
              บาท
            </p>
          </div>
        </div>

        {/* ================================== */}
        {/* Payment History */}
        {/* ================================== */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                ประวัติการรับชำระเงิน
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                รับชำระแล้ว{" "}
                {invoice.payments.length}{" "}
                รายการ
              </p>
            </div>

            {remainingAmount > 0 && (
              <Link
                href={`/payments/new?invoiceId=${invoice.id}`}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                + รับชำระเงิน
              </Link>
            )}
          </div>

          {invoice.payments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-500">
                Invoice นี้ยังไม่มีประวัติการรับชำระเงิน
              </p>

              {remainingAmount > 0 && (
                <Link
                  href={`/payments/new?invoiceId=${invoice.id}`}
                  className="mt-4 inline-block text-sm font-semibold text-emerald-600 hover:underline"
                >
                  บันทึกการรับชำระเงิน
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">
                      #
                    </th>

                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      วันที่รับเงิน
                    </th>

                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      วิธีชำระเงิน
                    </th>

                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      เลขที่อ้างอิง
                    </th>

                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      ผู้รับเงิน
                    </th>

                    <th className="px-4 py-3 text-right font-semibold text-slate-700">
                      จำนวนเงิน
                    </th>

                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      หมายเหตุ
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {invoice.payments.map(
                    (payment, index) => (
                      <tr
                        key={payment.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 text-center text-slate-500">
                          {index + 1}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDate(
                            payment.paymentDate
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {getPaymentMethodLabel(
                            payment.paymentMethod
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {payment.referenceNumber ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {payment.receivedBy ||
                            "-"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-600">
                          {formatMoney(
                            Number(payment.amount)
                          )}{" "}
                          บาท
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {payment.note || "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

                <tfoot className="bg-slate-50">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-4 text-right font-bold text-slate-700"
                    >
                      รวมรับชำระ
                    </td>

                    <td className="px-4 py-4 text-right text-lg font-bold text-emerald-600">
                      {formatMoney(totalPaid)}{" "}
                      บาท
                    </td>

                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}