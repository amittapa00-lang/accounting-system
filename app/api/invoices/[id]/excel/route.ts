import fs from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";

import { ApiError, handleApiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth";
import { bahtText } from "@/lib/bahtText";
import { toDateInputValue } from "@/lib/format";
import { INVOICE_EXCEL_MAX_ITEMS } from "@/lib/invoices";
import { displayLineDescription, displayLineNumbers, lineHasAmount, toLineType } from "@/lib/lines";
import { toNumber, type Numeric } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** First and last item rows of the template (J40 holds the subtotal). */
const FIRST_ITEM_ROW = 18;
const LAST_ITEM_ROW = FIRST_ITEM_ROW + INVOICE_EXCEL_MAX_ITEMS - 1; // 39

const MONEY_FORMAT = "#,##0.00";

/** Number format without a trailing "." for whole numbers ("#,##0.##" shows 5 as "5."). */
function plainNumberFormat(value: number) {
  return Number.isInteger(value) ? "#,##0" : "#,##0.####";
}

/** The invoice date as a pure date (UTC midnight of the Thai calendar day), so Excel shows the right day. */
function excelDate(value: Date) {
  return new Date(`${toDateInputValue(value)}T00:00:00Z`);
}

/**
 * Template cells with the same formatting share one style object in ExcelJS, so setting the
 * font, alignment or number format of one cell would change all of them (e.g. the indent of a
 * SUB line showing on every item row). Give the cell its own copy before changing its format.
 */
function ownStyle(cell: ExcelJS.Cell): ExcelJS.Cell {
  cell.style = { ...cell.style };
  return cell;
}

function setDiscountCell(cell: ExcelJS.Cell, discount: Numeric, discountType: string) {
  const value = toNumber(discount);

  if (value === 0) {
    cell.value = null;
    return;
  }

  ownStyle(cell);

  if (discountType === "AMOUNT") {
    cell.value = value;
    cell.numFmt = MONEY_FORMAT;
    return;
  }

  // Percent cells hold the fraction (5% = 0.05)
  cell.value = value / 100;
  cell.numFmt = Number.isInteger(value) ? "0%" : "0.####%";
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireApiSession();

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        purchaseOrder: { select: { poNumber: true } },
        items: { orderBy: { itemNo: "asc" } },
      },
    });

    if (!invoice) {
      throw new ApiError(404, "ไม่พบ Invoice ที่ต้องการ");
    }

    if (invoice.status === "CANCELLED") {
      throw new ApiError(409, "Invoice นี้ถูกยกเลิกแล้ว ไม่สามารถดาวน์โหลดได้");
    }

    // Rows after the items: one "Discount" row (bill discount) and one row per line of the note.
    // They share the template's item rows, so they count toward INVOICE_EXCEL_MAX_ITEMS.
    const billDiscountAmount = toNumber(invoice.billDiscountAmount);
    const noteRows = (invoice.note ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .map((line, index) => (index === 0 ? `หมายเหตุ: ${line}` : line));
    const extraRows = (billDiscountAmount > 0 ? 1 : 0) + noteRows.length;

    if (invoice.items.length + extraRows > INVOICE_EXCEL_MAX_ITEMS) {
      throw new ApiError(
        400,
        `Invoice นี้มีสินค้าเกิน ${INVOICE_EXCEL_MAX_ITEMS} รายการ ซึ่งเกินพื้นที่ของแบบฟอร์ม Excel` +
          (extraRows > 0 ? ` (นับรวมบรรทัดส่วนลดท้ายบิลและหมายเหตุ ${extraRows} บรรทัด)` : "")
      );
    }

    // ไฟล์ Excel ต้นแบบ (อยู่นอก public/ เพื่อไม่ให้ดาวน์โหลดได้โดยไม่ล็อกอิน)
    const templatePath = path.join(process.cwd(), "templates", "invoice-template.xlsx");
    const templateBuffer = await fs.readFile(templatePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer as unknown as ExcelJS.Buffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error("ไม่พบ Worksheet ในไฟล์ Excel ต้นแบบ");
    }

    // C28:D29 is merged in the template. Writing to a merged cell writes to its top-left
    // cell, so item 12 (row 29) would overwrite item 11's description (row 28).
    worksheet.unMergeCells("C28:D29");

    // =====================================
    // ข้อมูลส่วนหัว Invoice
    // =====================================

    worksheet.getCell("J3").value = invoice.invoiceNumber;
    worksheet.getCell("J4").value = excelDate(invoice.invoiceDate);
    worksheet.getCell("D7").value = invoice.customerCodeSnapshot ?? "";
    worksheet.getCell("B9").value = invoice.customerNameSnapshot ?? "";
    worksheet.getCell("B10").value = invoice.customerAddressSnapshot ?? "";
    worksheet.getCell("B11").value = "";
    worksheet.getCell("B12").value = invoice.customerTaxIdSnapshot ?? "";
    worksheet.getCell("G15").value = `PO. No. ${invoice.purchaseOrder.poNumber}`;

    // =====================================
    // ล้างพื้นที่รายการสินค้าในต้นแบบ
    // =====================================

    for (let row = FIRST_ITEM_ROW; row <= LAST_ITEM_ROW; row++) {
      for (const column of ["B", "C", "D", "F", "G", "H", "I", "J"]) {
        worksheet.getCell(`${column}${row}`).value = null;
      }
    }

    // =====================================
    // รายการสินค้า
    // =====================================

    // ITEM lines are numbered 1, 2, ...; SUB lines have no number and start with "- "
    const lineNumbers = displayLineNumbers(invoice.items);

    invoice.items.forEach((item, index) => {
      const row = FIRST_ITEM_ROW + index;
      const lineType = toLineType(item.lineType);

      worksheet.getCell(`B${row}`).value = lineNumbers[index];

      const descriptionCell = ownStyle(worksheet.getCell(`C${row}`));
      descriptionCell.value = displayLineDescription(item.description, lineType);
      if (lineType === "SUB") {
        descriptionCell.alignment = { ...descriptionCell.alignment, indent: 1 };
      }

      // A line without price is text only: no quantity, unit, price, discount or amount
      if (!lineHasAmount(item)) return;

      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unitPrice);

      const quantityCell = ownStyle(worksheet.getCell(`F${row}`));
      quantityCell.value = quantity;
      quantityCell.numFmt = plainNumberFormat(quantity);

      worksheet.getCell(`G${row}`).value = item.unit ?? "";

      const unitPriceCell = ownStyle(worksheet.getCell(`H${row}`));
      unitPriceCell.value = unitPrice;
      unitPriceCell.numFmt = MONEY_FORMAT;

      setDiscountCell(worksheet.getCell(`I${row}`), item.discount, item.discountType);

      const amountCell = ownStyle(worksheet.getCell(`J${row}`));
      amountCell.value = toNumber(item.amount);
      amountCell.numFmt = MONEY_FORMAT;
    });

    // =====================================
    // ส่วนลดท้ายบิล และหมายเหตุ (แถวว่างถัดจากรายการ)
    // =====================================

    let nextRow = FIRST_ITEM_ROW + invoice.items.length;

    if (billDiscountAmount > 0) {
      worksheet.getCell(`C${nextRow}`).value = "Discount";

      const discountCell = ownStyle(worksheet.getCell(`J${nextRow}`));
      discountCell.value = -billDiscountAmount;
      discountCell.numFmt = MONEY_FORMAT;

      nextRow += 1;
    }

    for (const text of noteRows) {
      worksheet.getCell(`C${nextRow}`).value = text;
      nextRow += 1;
    }

    // =====================================
    // ยอดเงิน (ค่าที่บันทึกไว้ใน Invoice)
    // =====================================

    worksheet.getCell("J40").value = toNumber(invoice.subtotal);
    worksheet.getCell("J42").value = toNumber(invoice.vat);
    worksheet.getCell("J43").value = toNumber(invoice.grandTotal);
    worksheet.getCell("B43").value = bahtText(invoice.grandTotal);

    for (const cell of ["J40", "J42", "J43"]) {
      ownStyle(worksheet.getCell(cell)).numFmt = MONEY_FORMAT;
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

    // Sub-invoices share the invoice number: add the sub-number so the files do not overwrite each other
    const baseName = invoice.subNumber > 1 ? `${invoice.invoiceNumber}-${invoice.subNumber}` : invoice.invoiceNumber;
    const fileName = `Invoice-${baseName.replace(/[\\/:*?"<>|]/g, "-")}.xlsx`;

    return new Response(Buffer.from(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="invoice.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "ไม่สามารถสร้างไฟล์ Excel ได้ กรุณาตรวจสอบไฟล์ต้นแบบ");
  }
}
