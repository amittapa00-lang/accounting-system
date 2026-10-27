import { NextResponse } from "next/server";

import { prisma } from "../../../lib/prisma";

export async function POST(request: Request) {
  try {
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
    } = body;

    if (!code || !name) {
      return NextResponse.json(
        {
          error: "กรุณากรอกรหัสลูกค้าและชื่อลูกค้า",
        },
        {
          status: 400,
        }
      );
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: {
        code,
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        {
          error: "รหัสลูกค้านี้มีอยู่แล้ว",
        },
        {
          status: 409,
        }
      );
    }

    const customer = await prisma.customer.create({
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
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        message: "บันทึกลูกค้าสำเร็จ",
        customer,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);

    return NextResponse.json(
      {
        error: "เกิดข้อผิดพลาดในการบันทึกลูกค้า",
      },
      {
        status: 500,
      }
    );
  }
}