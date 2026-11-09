import { notFound } from "next/navigation";

import PaymentForm from "@/components/payments/PaymentForm";
import { PageHeader } from "@/components/ui/page-header";
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
    <>
      <PageHeader
        title="รับชำระเงิน"
        description={`บันทึกการรับชำระเงินของ Invoice ${invoice.invoiceNumber}`}
        back={{ href: `/invoices/${invoice.id}`, label: `กลับไป Invoice ${invoice.invoiceNumber}` }}
      />

      {/* key: Next keeps visited pages (and their client state) alive; after a payment the next
          visit must start from the new remaining amount, not the "saving…" state of the last one */}
      <PaymentForm
        key={`${invoice.id}:${summary.paid}`}
        invoice={{
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerNameSnapshot,
          status: invoice.status,
          grandTotal: round2(invoice.grandTotal),
          totalPaid: summary.paid,
          remainingAmount: summary.remaining,
        }}
        blockedReason={paymentBlockedReason(invoice.status)}
        currentUserName={session.user.name ?? session.user.username ?? ""}
      />
    </>
  );
}
