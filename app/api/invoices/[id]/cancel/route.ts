import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";

import { changeDraftInvoiceStatus } from "@/app/api/invoices/draftStatus";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** DRAFT -> CANCELLED (frees the purchase order for a new invoice) */
export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireApiSession();

    const { id } = await context.params;

    const invoice = await changeDraftInvoiceStatus(id, "CANCELLED");

    return NextResponse.json({ message: "ยกเลิก Invoice สำเร็จ", invoice });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถยกเลิก Invoice ได้");
  }
}
