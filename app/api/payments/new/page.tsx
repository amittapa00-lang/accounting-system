import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import authOptions from "../../../auth";
import { prisma } from "../../../lib/prisma";
import PaymentForm from "../PaymentForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    invoiceId?: string;
  }>;
};

export default async function NewPaymentPage({
  searchParams,
}: PageProps) {
  const session =
    await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;

  const invoiceId = params.invoiceId;

  if (!invoiceId) {
    notFound();
  }

  const invoice =
    await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
      },
      include: {
        payments: true,
      },
    });

  if (!invoice) {
    notFound();
  }

  const totalPaid = invoice.payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount),
    0
  );

  const grandTotal =
    Number(invoice.grandTotal);

  const remainingAmount =
    grandTotal - totalPaid;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">
            รับชำระเงิน
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            บันทึกการรับชำระเงินของ Invoice
          </p>
        </div>

        {/* Form */}

        <PaymentForm
          invoice={{
            id: invoice.id,
            invoiceNumber:
              invoice.invoiceNumber,
            invoiceDate:
              invoice.invoiceDate.toISOString(),
            grandTotal,
            totalPaid,
            remainingAmount,
            customerName:
              invoice.customerNameSnapshot,
          }}
        />
      </div>
    </main>
  );
}