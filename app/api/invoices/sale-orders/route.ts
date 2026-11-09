/**
 * GET /api/invoices/sale-orders?number=TC%202026/001-001
 *
 * Invoices (not cancelled) that already use this Sale Order No. The create form uses it to warn
 * about a duplicate; duplicates are still allowed. Spaces and letter case are ignored, so
 * "TC 2026/001-001" and "tc2026/001-001" count as the same number.
 */
import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_LENGTH = 100;
const MAX_MATCHES = 10;

export async function GET(request: Request) {
  try {
    await requireApiSession();

    const number = (new URL(request.url).searchParams.get("number") ?? "").trim();
    if (number === "" || number.length > MAX_LENGTH) {
      return NextResponse.json({ matches: [] });
    }

    const matches = await prisma.$queryRaw<
      { id: string; invoiceNumber: string; subNumber: number; saleOrderNumber: string }[]
    >`
      SELECT id, "invoiceNumber", "subNumber", "saleOrderNumber"
      FROM "Invoice"
      WHERE status <> 'CANCELLED'
        AND regexp_replace(lower("saleOrderNumber"), '\\s', '', 'g') = regexp_replace(lower(${number}), '\\s', '', 'g')
      ORDER BY "invoiceDate" DESC, "createdAt" DESC
      LIMIT ${MAX_MATCHES}
    `;

    return NextResponse.json({ matches }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถตรวจสอบ Sale Order No. ได้");
  }
}
