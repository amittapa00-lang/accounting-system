import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import authOptions from "../../auth";
import { prisma } from "../../lib/prisma";

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const payments = await prisma.payment.findMany({
    orderBy: {
      paymentDate: "desc",
    },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          customerNameSnapshot: true,
          grandTotal: true,
          status: true,
        },
      },
    },
  });

  const totalPayment = payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount),
    0
  );

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

  function getPaymentMethodLabel(
    method: string
  ) {
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
    case "PAID":
      return "ชำระครบแล้ว";

    case "PARTIAL":
      return "ชำระบางส่วน";

    case "ISSUED":
      return "ออก Invoice แล้ว";

    case "DRAFT":
      return "ฉบับร่าง";

    case "CANCELLED":
      return "ยกเลิก";

    default:
      return status;
  }
}

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}

        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Payment
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              รายการรับชำระเงิน
            </p>
          </div>

          <Link
            href="/invoices"
            className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            ไปหน้า Invoice
          </Link>
        </div>

        {/* Summary */}

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              จำนวนรายการรับเงิน
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-800">
              {payments.length.toLocaleString(
                "th-TH"
              )}{" "}
              รายการ
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              ยอดรับชำระรวม
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {formatMoney(totalPayment)} บาท
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">
              Invoice ที่มีการรับเงิน
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-600">
              {
                new Set(
                  payments.map(
                    (payment) =>
                      payment.invoice.id
                  )
                ).size
              }{" "}
              ใบ
            </p>
          </div>
        </div>

        {/* Payment Table */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    วันที่
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Invoice No.
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    ลูกค้า
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    จำนวนเงิน
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    วิธีชำระ
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    เลขที่อ้างอิง
                  </th>

                  <th className="px-4 py-3 text-center font-semibold text-slate-700">
                    สถานะ Invoice
                  </th>

                  <th className="px-4 py-3 text-center font-semibold text-slate-700">
                    จัดการ
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      ยังไม่มีรายการรับชำระเงิน
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      {/* Date */}

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatDate(
                          payment.paymentDate
                        )}
                      </td>

                      {/* Invoice */}

                      <td className="whitespace-nowrap px-4 py-3">
                        <Link
                          href={`/invoices/${payment.invoice.id}`}
                          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {
                            payment.invoice
                              .invoiceNumber
                          }
                        </Link>
                      </td>

                      {/* Customer */}

                      <td className="px-4 py-3 text-slate-700">
                        {
                          payment.invoice
                            .customerNameSnapshot
                        }
                      </td>

                      {/* Amount */}

                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-600">
                        {formatMoney(
                          Number(payment.amount)
                        )}{" "}
                        บาท
                      </td>

                      {/* Payment Method */}

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {getPaymentMethodLabel(
                          payment.paymentMethod
                        )}
                      </td>

                      {/* Reference */}

                      <td className="px-4 py-3 text-slate-600">
                        {payment.referenceNumber ||
                          "-"}
                      </td>

                      {/* Invoice Status */}

                      <td className="px-4 py-3 text-center">
                        <span
  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
    payment.invoice.status === "PAID"
      ? "bg-emerald-100 text-emerald-700"
      : payment.invoice.status === "PARTIAL"
        ? "bg-blue-100 text-blue-700"
        : payment.invoice.status === "ISSUED"
          ? "bg-amber-100 text-amber-700"
          : payment.invoice.status === "CANCELLED"
            ? "bg-red-100 text-red-700"
            : "bg-slate-100 text-slate-700"
  }`}
>
  {getStatusLabel(
    payment.invoice.status
  )}
</span>
                      </td>

                      {/* Action */}

                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/invoices/${payment.invoice.id}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          ดู Invoice
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