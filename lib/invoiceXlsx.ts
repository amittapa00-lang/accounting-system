import ExcelJS from "exceljs";
import { bahtText } from "./bahtText";

export type InvoiceXlsxData = {
  invoiceNumber: string;
  invoiceDate: Date;
  customerCode?: string | null;
  customerName: string;
  customerAddress?: string | null;
  customerTaxId?: string | null;
  shipTo?: string | null;
  tel?: string | null;
  saleOrderNumber?: string | null;
  poNumber?: string | null;
  remark?: string | null;
  acceptanceCondition?: string | null;
  subtotal: number;
  vat: number;
  grandTotal: number;
  items: {
    itemNo: number;
    description: string;
    quantity: number;
    unit?: string | null;
    unitPrice: number;
    discountPercent: number;
    amount: number;
  }[];
};

export class InvoiceXlsxError extends Error {}

const FIRST_ROW = 18; // แถวรายการแรกของฟอร์ม
const LAST_ROW = 39; // แถวสุดท้ายก่อนช่องรวมราคา (J40)
const ADDRESS_LINE_MAX = 50; // จำนวนตัวอักษรต่อบรรทัดที่อยู่ (ฟอนต์ 14 ตามไฟล์ IV)

// วันที่ตามเวลาไทย -> เก็บเป็นวันที่ล้วนใน Excel (กันวันเพี้ยนจาก timezone)
function bangkokDate(d: Date) {
  const text = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, day] = text.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function splitAddress(address: string): [string, string] {
  const text = address.replace(/\s+/g, " ").trim();
  if (text.length <= ADDRESS_LINE_MAX) return [text, ""];
  let cut = text.lastIndexOf(" ", ADDRESS_LINE_MAX);
  if (cut <= 0) cut = ADDRESS_LINE_MAX;
  return [text.slice(0, cut).trim(), text.slice(cut).trim()];
}

function lines(text?: string | null) {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l, i, arr) => l !== "" || (i > 0 && i < arr.length - 1));
}

const FONT_NAME = "Angsana New";

type HAlign = "left" | "center" | "right";

// ตั้งฟอนต์ Angsana New + ขนาด + การจัดตำแหน่ง ตามตารางที่กำหนด
function fmt(ws: ExcelJS.Worksheet, address: string, size: number, h: HAlign) {
  const c = ws.getCell(address);
  // กำหนด style ใหม่ทั้งก้อน (กันเซลล์ที่ใช้สไตล์ร่วมกันถูกแก้ไปด้วย)
  c.style = {
    ...c.style,
    font: { ...(c.font ?? {}), name: FONT_NAME, size, bold: false, family: undefined, scheme: undefined },
    alignment: { horizontal: h, vertical: "middle" },
  };
}

function applyFormats(ws: ExcelJS.Worksheet) {
  fmt(ws, "J3", 16, "center");
  fmt(ws, "J4", 16, "center"); // J4:J5 ผสานเซลล์
  fmt(ws, "D7", 14, "left");
  for (const r of [9, 10, 11, 12, 13]) fmt(ws, `B${r}`, 14, "left"); // B13 = เบอร์โทร
  fmt(ws, "B15", 14, "center");
  fmt(ws, "G15", 14, "center"); // G15:H15 ผสานเซลล์ (PO)
  for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
    fmt(ws, `B${r}`, 14, "center");
    fmt(ws, `C${r}`, 14, "left");
    fmt(ws, `D${r}`, 14, "left");
    fmt(ws, `F${r}`, 12, "center");
    fmt(ws, `G${r}`, 14, "center");
    fmt(ws, `H${r}`, 14, "right");
    fmt(ws, `I${r}`, 14, "center");
    fmt(ws, `J${r}`, 14, "right");
  }
  fmt(ws, "J40", 14, "right");
  fmt(ws, "J42", 14, "right");
  fmt(ws, "B43", 14, "center"); // B43:H44 ผสานเซลล์ (จำนวนเงินตัวอักษร)
  fmt(ws, "J43", 14, "right"); // J43:J44 ผสานเซลล์
}

export async function buildInvoiceXlsx(
  data: InvoiceXlsxData,
  templatePath: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);

  const ws = wb.worksheets[0];

  ws.getCell("C28").alignment = { horizontal: "center", vertical: "middle" };
  fmt(ws, "C28", 14, "center");
  applyFormats(ws);

  // เก็บสไตล์ต้นแบบก่อนล้างข้อมูลตัวอย่าง
  const itemTextStyle = { ...ws.getCell("C18").style };
  const remarkStyle = { ...itemTextStyle };
  const withholdStyle = { ...ws.getCell("C28").style };

  // ล้างข้อมูลตัวอย่างในพื้นที่รายการ
  try {
    ws.unMergeCells("C28:D29");
  } catch {
    /* ไม่มีช่องผสาน */
  }
  for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
    for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J"]) {
      ws.getCell(`${col}${r}`).value = null;
    }
  }

  // ----- ส่วนหัว -----
  ws.getCell("J3").value = data.invoiceNumber;
  ws.getCell("J4").value = bangkokDate(data.invoiceDate);
  ws.getCell("D7").value = data.customerCode || null;
  ws.getCell("I8").value = data.shipTo || data.customerName;
  ws.getCell("B9").value = data.customerName;

  const [addr1, addr2] = splitAddress(data.customerAddress || "");
  ws.getCell("B10").value = addr1 || null;
  ws.getCell("B11").value = addr2 || null;

  // ตามไฟล์ IV: B12 = เลขผู้เสียภาษี, B13 = เบอร์โทร
  const taxDigits = (data.customerTaxId || "").replace(/\D/g, "");
  const taxCell = ws.getCell("B12");
  if (taxDigits.length === 13) {
    taxCell.value = `เลขประจำตัวผู้เสียภาษีอากร ${taxDigits[0]}-${taxDigits.slice(1, 5)}-${taxDigits.slice(5, 9)}-${taxDigits.slice(9)}`;
  } else if (data.customerTaxId) {
    taxCell.value = `เลขประจำตัวผู้เสียภาษีอากร ${data.customerTaxId}`;
  } else {
    taxCell.value = null;
  }

  const telCell = ws.getCell("B13");
  telCell.alignment = { horizontal: "left", vertical: "middle" };
  telCell.value = data.tel ? `Tel : ${data.tel}` : null;

  ws.getCell("B15").value = data.saleOrderNumber || null;
  const poCell = ws.getCell("G15");
  poCell.value = data.poNumber ? `PO. No. ${data.poNumber}` : null;

  // ----- รายการ (รายละเอียดหลายบรรทัดลงแถวละบรรทัด) -----
  let row = FIRST_ROW;

  for (const item of data.items) {
    const descLines = lines(item.description);
    if (descLines.length === 0) descLines.push("");

    descLines.forEach((text, index) => {
      if (row > LAST_ROW) {
        throw new InvoiceXlsxError(
          `รายการสินค้ายาวเกินพื้นที่ฟอร์ม (สูงสุด ${LAST_ROW - FIRST_ROW + 1} บรรทัด)`
        );
      }

      const c = ws.getCell(`C${row}`);
      c.value = text;
      c.style = { ...itemTextStyle };
      c.alignment = { horizontal: "left", vertical: "top" };

      if (index === 0) {
        ws.getCell(`B${row}`).value = item.itemNo;
        ws.getCell(`F${row}`).value = item.quantity;
        ws.getCell(`G${row}`).value = item.unit || null;
        ws.getCell(`H${row}`).value = item.unitPrice;
        ws.getCell(`I${row}`).value = item.discountPercent / 100;
        ws.getCell(`J${row}`).value = item.amount;
      }

      row++;
    });
  }

  // ----- หมายเหตุ / เงื่อนไขการรับสินค้า + หัก ภาษี ณ ที่จ่าย ต่อท้ายรายการ -----
  const blockLines: string[] = [];
  lines(data.remark).forEach((text, index) =>
    blockLines.push(index === 0 ? `หมายเหตุ: ${text}` : text)
  );
  lines(data.acceptanceCondition).forEach((text, index) =>
    blockLines.push(
      index === 0 ? `เงื่อนไขการรับสินค้า / ตรวจรับ: ${text}` : text
    )
  );

  let cursor = row + 1;

  if (blockLines.length > 0) {
    blockLines.forEach((text) => {
      if (cursor > LAST_ROW) {
        throw new InvoiceXlsxError("หมายเหตุยาวเกินพื้นที่ฟอร์ม");
      }
      const c = ws.getCell(`C${cursor}`);
      c.value = text;
      c.style = { ...remarkStyle };
      c.alignment = { horizontal: "left", vertical: "top" };
      cursor++;
    });
    cursor++;
  }

  if (cursor + 1 <= LAST_ROW) {
    const w = ws.getCell(`C${cursor}`);
    w.value = "หัก ภาษี ณ ที่จ่ายได้";
    w.style = { ...withholdStyle };
    ws.mergeCells(`C${cursor}:D${cursor + 1}`);
  } else if (cursor <= LAST_ROW) {
    const w = ws.getCell(`C${cursor}`);
    w.value = "หัก ภาษี ณ ที่จ่ายได้";
    w.style = { ...withholdStyle };
  }

  // ----- ยอดรวม (ค่าจากฐานข้อมูล ไม่ใช้สูตร) -----
  ws.getCell("J40").value = data.subtotal;
  ws.getCell("J42").value = data.vat;
  ws.getCell("J43").value = data.grandTotal;
  ws.getCell("B43").value = `(${bahtText(data.grandTotal)})`;

  // ชีตอื่น (ตั้งค่า / วิธีใช้) ไม่จำเป็นในไฟล์ที่ออกให้ลูกค้า
  for (const other of wb.worksheets.slice(1)) {
    wb.removeWorksheet(other.id);
  }
  ws.name = "Invoice";

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}