/**
 * GET /api/invoices/numbers?number=IV2026/007&exclude=<invoice id>
 *
 * Invoices that already use this invoice number (cancelled ones too: the number stays taken),
 * with their Sale Order No. and PO. Another PO may share the number only with a different Sale
 * Order No.: the invoice form shows the conflict before saving (lib/invoices.ts
 * blockingNumberHolders), and POST /api/invoices and PUT /api/invoices/[id] check it again.
 * `exclude` leaves out the invoice being edited.
 */
import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_LENGTH = 100;
// enough that the form sees every invoice sharing a number (the server checks again anyway)
const MAX_MATCHES = 50;

export async function GET(request: Request) {
  try {
    await requireApiSession();

    const params = new URL(request.url).searchParams;
    const number = (params.get("number") ?? "").trim();
    const exclude = params.get("exclude") ?? undefined;
    if (number === "" || number.length > MAX_LENGTH) {
      return NextResponse.json({ matches: [] });
    }

    const matches = await prisma.invoice.findMany({
      where: { invoiceNumber: number, ...(exclude ? { id: { not: exclude } } : {}) },
      select: {
        id: true,
        invoiceNumber: true,
        subNumber: true,
        status: true,
        saleOrderNumber: true,
        purchaseOrderId: true,
      },
      orderBy: { subNumber: "asc" },
      take: MAX_MATCHES,
    });

    return NextResponse.json({ matches }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถตรวจสอบเลข Invoice ได้");
  }
}
