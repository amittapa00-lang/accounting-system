import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";

import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function numberToThaiText(number: number): string {
  if (!Number.isFinite(number)) return "";

  const rounded = Math.round(number * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);

  const numberNames = [
    "",
    "หนึ่ง",
    "สอง",
    "สาม",
    "สี่",
    "ห้า",
    "หก",
    "เจ็ด",
    "แปด",
    "เก้า",
  ];

  function convert(value: number): string {
    if (value === 0) return "";

    if (value >= 1_000_000) {
      const million = Math.floor(value / 1_000_000);
      return convert(million) + "ล้าน" + convert(value % 1_000_000);
    }

    const positions = [
      { value: Math.floor(value / 100_000), unit: "แสน" },
      { value: Math.floor((value % 100_000) / 10_000), unit: "หมื่น" },
      { value: Math.floor((value % 10_000) / 1_000), unit: "พัน" },
      { value: Math.floor((value % 1_000) / 100), unit: "ร้อย" },
      { value: Math.floor((value % 100) / 10), unit: "สิบ" },
      { value: value % 10, unit: "" },
    ];

    let result = "";

    for (const position of positions) {
      const digit = position.value;

      if (digit === 0) continue;

      if (position.unit === "สิบ") {
        if (digit === 1) result += "สิบ";
        else if (digit === 2) result += "ยี่สิบ";
        else result += numberNames[digit] + "สิบ";
      } else if (position.unit === "") {
        if (digit === 1 && value >= 10) result += "เอ็ด";
        else result += numberNames[digit];
      } else {
        result += numberNames[digit] + position.unit;
      }
    }

    return result;
  }

  const bahtText = baht === 0 ? "ศูนย์" : convert(baht);
  const satangText = satang === 0 ? "" : convert(satang);

  return satang === 0
    ? `${bahtText}บาทถ้วน`
    : `${bahtText}บาท${satangText}สตางค์`;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        purchaseOrder: true,
        items: {
          orderBy: { itemNo: "asc" },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { message: "ไม่พบ Invoice ที่ต้องการ" },
        { status: 404 }
      );
    }

    // ไฟล์ Excel ต้นแบบ (อยู่นอก public/ เพื่อไม่ให้ดาวน์โหลดได้โดยไม่ล็อกอิน)
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "invoice-template.xlsx"
    );

    const templateBuffer = await fs.readFile(templatePath);

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(templateBuffer as unknown as ExcelJS.Buffer);

    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error("ไม่พบ Worksheet ในไฟล์ Excel ต้นแบบ");
    }

    // =====================================
    // ข้อมูลส่วนหัว Invoice
    // =====================================

    worksheet.getCell("J3").value = invoice.invoiceNumber;
    worksheet.getCell("J4").value = invoice.invoiceDate;

    worksheet.getCell("D7").value =
      invoice.customerCodeSnapshot ?? "";

    worksheet.getCell("B9").value =
      invoice.customerNameSnapshot ?? "";

    worksheet.getCell("B10").value =
      invoice.customerAddressSnapshot ?? "";

    worksheet.getCell("B11").value = "";

    worksheet.getCell("B12").value =
      invoice.customerTaxIdSnapshot ?? "";

    worksheet.getCell("G15").value =
      `PO. No. ${invoice.purchaseOrder.poNumber}`;

    // =====================================
    // ล้างรายการสินค้าเดิมในต้นแบบ
    // =====================================

    for (let row = 18; row <= 39; row++) {
      for (const column of ["B", "C", "F", "G", "H", "I", "J"]) {
        worksheet.getCell(`${column}${row}`).value = null;
      }
    }

    // ต้นแบบมีพื้นที่รายการสินค้า 22 แถว
    if (invoice.items.length > 22) {
      return NextResponse.json(
        {
          message:
            "Invoice นี้มีสินค้าเกิน 22 รายการ กรุณาแบ่งเอกสารก่อนดาวน์โหลด",
        },
        { status: 400 }
      );
    }

    // =====================================
    // รายการสินค้า
    // =====================================

    invoice.items.forEach((item, index) => {
      const row = 18 + index;

      worksheet.getCell(`B${row}`).value = item.itemNo;
      worksheet.getCell(`C${row}`).value = item.description;
      worksheet.getCell(`F${row}`).value = toNumber(item.quantity);
      worksheet.getCell(`G${row}`).value = item.unit ?? "";
      worksheet.getCell(`H${row}`).value = toNumber(item.unitPrice);
      worksheet.getCell(`I${row}`).value = toNumber(item.discount);
      worksheet.getCell(`J${row}`).value = toNumber(item.amount);
    });

    // =====================================
    // ยอดเงิน
    // =====================================

    worksheet.getCell("J40").value = toNumber(invoice.subtotal);
    worksheet.getCell("J42").value = toNumber(invoice.vat);
    worksheet.getCell("J43").value = toNumber(invoice.grandTotal);

    worksheet.getCell("B43").value = numberToThaiText(
      toNumber(invoice.grandTotal)
    );

    // ตั้งค่ารูปแบบตัวเลข
    for (let row = 18; row <= 39; row++) {
      worksheet.getCell(`F${row}`).numFmt = "#,##0.##";
      worksheet.getCell(`H${row}`).numFmt = "#,##0.00";
      worksheet.getCell(`I${row}`).numFmt = "#,##0.##";
      worksheet.getCell(`J${row}`).numFmt = "#,##0.00";
    }

    for (const cell of ["J40", "J42", "J43"]) {
      worksheet.getCell(cell).numFmt = "#,##0.00";
    }

    // ตั้งค่าพิมพ์ A4
    worksheet.pageSetup.paperSize = 9;
    worksheet.pageSetup.orientation = "portrait";
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;
    worksheet.pageSetup.fitToHeight = 1;
    worksheet.pageSetup.printArea = "A1:J44";

    // =====================================
    // ส่งไฟล์ให้ผู้ใช้ดาวน์โหลด
    // =====================================

    const fileBuffer = await workbook.xlsx.writeBuffer();

    const fileName = `Invoice-${invoice.invoiceNumber}.xlsx`;
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(Buffer.from(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          `attachment; filename="invoice.xlsx"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Excel Invoice Error:", error);

    return NextResponse.json(
      { message: "ไม่สามารถสร้างไฟล์ Excel ได้ กรุณาตรวจสอบไฟล์ต้นแบบ" },
      { status: 500 }
    );
  }
}