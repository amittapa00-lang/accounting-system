import { NextResponse } from "next/server";

import { handleApiError, readJson } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { CUSTOMER_CODE_CONFLICT, parseCustomerInput } from "./input";

export async function POST(request: Request) {
  try {
    await requireApiSession();

    const body = await readJson(request);
    const data = parseCustomerInput(body);

    // code is @unique: a duplicate (including two saves at the same moment) is P2002 -> 409
    const customer = await prisma.customer.create({
      data: {
        ...data,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        message: "บันทึกลูกค้าสำเร็จ",
        customer,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "เกิดข้อผิดพลาดในการบันทึกลูกค้า", {
      conflict: CUSTOMER_CODE_CONFLICT,
    });
  }
}
