import { NextResponse } from "next/server";

import { ApiError, handleApiError, readJson } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { CUSTOMER_CODE_CONFLICT, parseCustomerInput } from "../input";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireApiSession();

    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new ApiError(404, "ไม่พบข้อมูลลูกค้า");
    }

    return NextResponse.json(customer);
  } catch (error) {
    return handleApiError(error, "เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า");
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireApiSession();

    const { id } = await context.params;
    const body = await readJson(request);
    const data = parseCustomerInput(body);

    // isActive not sent: keep the current value (do not silently deactivate)
    if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
      throw new ApiError(400, "สถานะลูกค้าไม่ถูกต้อง");
    }

    // Unknown id is P2025 -> 404; duplicate code is P2002 -> 409
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...data,
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });

    return NextResponse.json({
      message: "แก้ไขข้อมูลลูกค้าสำเร็จ",
      customer,
    });
  } catch (error) {
    return handleApiError(error, "เกิดข้อผิดพลาดในการแก้ไขข้อมูลลูกค้า", {
      conflict: CUSTOMER_CODE_CONFLICT,
      notFound: "ไม่พบข้อมูลลูกค้า",
    });
  }
}
