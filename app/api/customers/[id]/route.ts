import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: {
        id,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลลูกค้า" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("GET CUSTOMER ERROR:", error);

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้า" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const {
      code,
      name,
      address,
      tel,
      taxId,
      branchType,
      branchNumber,
      contactName,
      email,
      note,
      isActive,
    } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัสลูกค้าและชื่อลูกค้า" },
        { status: 400 }
      );
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        code,
        NOT: {
          id,
        },
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "รหัสลูกค้านี้มีอยู่แล้ว" },
        { status: 409 }
      );
    }

    const customer = await prisma.customer.update({
      where: {
        id,
      },
      data: {
        code,
        name,
        address: address || null,
        tel: tel || null,
        taxId: taxId || null,
        branchType: branchType || null,
        branchNumber: branchNumber || null,
        contactName: contactName || null,
        email: email || null,
        note: note || null,
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json({
      message: "แก้ไขข้อมูลลูกค้าสำเร็จ",
      customer,
    });
  } catch (error) {
    console.error("UPDATE CUSTOMER ERROR:", error);

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการแก้ไขข้อมูลลูกค้า" },
      { status: 500 }
    );
  }
}