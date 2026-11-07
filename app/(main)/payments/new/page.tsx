import { notFound } from "next/navigation";

import PaymentForm from "@/components/payments/PaymentForm";
import { requirePageSession } from "@/lib/auth";
import { paymentSummary, round2 } from "@/lib/money";
import { paymentBlockedReason } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export const instant = false;

type PageProps = {
  searchParams: Promise<{
    invoiceId?: string | string[];
  }>;
};

export default async function NewPaymentPage({ searchParams }: PageProps) {
  const session = await requirePageSession();

  const { invoiceId } = await searchParams;

  if (typeof invoiceId !== "string" || invoiceId === "") {
    notFound();
  }

  const invoice = await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
    },
    select: {
      id: true,
      invoiceNumber: true,
      customerNameSnapshot: true,
      status: true,
      grandTotal: true,
      payments: { select: { amount: true } },
    },
  });

  if (!invoice) {
    notFound();
  }

  // Exact satang math: the prefilled amount always equals what the API will accept.
  const summary = paymentSummary(
    invoice.grandTotal,
    invoice.payments.map((payment) => payment.amount)
  );

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
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerNameSnapshot,
            grandTotal: round2(invoice.grandTotal),
            totalPaid: summary.paid,
            remainingAmount: summary.remaining,
          }}
          blockedReason={paymentBlockedReason(invoice.status)}
          currentUserName={session.user.name ?? session.user.username ?? ""}
        />
      </div>
    </main>
  );
}
