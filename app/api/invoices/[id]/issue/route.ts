import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";

import { changeDraftInvoiceStatus } from "@/app/api/invoices/draftStatus";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** DRAFT -> ISSUED */
export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireApiSession();

    const { id } = await context.params;

    const invoice = await changeDraftInvoiceStatus(id, "ISSUED");

    return NextResponse.json({ message: "ออก Invoice สำเร็จ", invoice });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถออก Invoice ได้");
  }
}
