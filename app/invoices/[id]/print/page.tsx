import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";

import authOptions from "@/auth";
import { prisma } from "@/lib/prisma";

import PrintButton from "./PrintButton";

export const instant = false;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

/* =========================================================
   DEBUG
   true  = พิมพ์เส้นกริดทุก 1 ซม. (เส้นแดง) และ 5 มม. (เส้นฟ้า)
   false = ปิดกริด (ใช้ตอนพิมพ์จริง)
========================================================= */

const DEBUG = false;

/* =========================================================
   OFFSET ปรับทั้งใบ (mm)
   พิมพ์ไปทางขวา  -> OFFSET_X ติดลบ
   พิมพ์ไปทางซ้าย -> OFFSET_X บวก
   พิมพ์ต่ำไป     -> OFFSET_Y ติดลบ
   พิมพ์สูงไป     -> OFFSET_Y บวก
========================================================= */

const OFFSET_X = 0;
const OFFSET_Y = 0;

/* =========================================================
   ตำแหน่งทุกช่อง (mm) วัดจากมุมซ้ายบนของ A4
========================================================= */

const POS = {
  invoiceNumber: { left: 172, top: 29, width: 28 },
  invoiceDate: { left: 172, top: 35, width: 28 },

  customerCode: { left: 45, top: 55, width: 30 },
  customerName: { left: 15, top: 67, width: 125 },
  customerAddress: { left: 15, top: 71.5, width: 125 },
  shipTo: { left: 140, top: 60, width: 60 },

  saleOrder: { left: 20, top: 95, width: 90 },
  poNumber: { left: 115, top: 95, width: 33 },
  saleName: { left: 150, top: 95, width: 25 },
  entryBy: { left: 177, top: 95, width: 23 },

  subtotal: { left: 178, top: 234, width: 22 },
  vat: { left: 178, top: 244, width: 22 },
  grandTotal: { left: 178, top: 254, width: 22 },

  amountInWords: { left: 27, top: 252, width: 149 },
};

/* =========================================================
   ตารางสินค้า
========================================================= */

const ITEM_START_TOP = 105;
const ITEM_ROW_HEIGHT = 7;

const COL = {
  itemNo: { left: 15, width: 10 },
  description: { left: 25, width: 60 },
  quantity: { left: 85, width: 15 },
  unitPrice: { left: 100, width: 25 },
  discount: { left: 125, width: 25 },
  amount: { left: 139, width: 30 },
};

/* =========================================================
   FORMAT
========================================================= */

function formatMoney(value: unknown) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* =========================================================
   แปลงตัวเลขเป็นข้อความภาษาไทย
========================================================= */

function numberToThaiText(number: number): string {
  if (!Number.isFinite(number)) {
    return "";
  }

  const rounded = Math.round(number * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);

  function convertNumber(num: number): string {
    if (num === 0) {
      return "";
    }

    let result = "";

    if (num >= 1_000_000) {
      const millionPart = Math.floor(num / 1_000_000);
      result += convertNumber(millionPart);
      result += "ล้าน";
      num %= 1_000_000;
    }

    const digits = [
      { value: Math.floor(num / 100_000), unit: "แสน" },
      { value: Math.floor((num % 100_000) / 10_000), unit: "หมื่น" },
      { value: Math.floor((num % 10_000) / 1_000), unit: "พัน" },
      { value: Math.floor((num % 1_000) / 100), unit: "ร้อย" },
      { value: Math.floor((num % 100) / 10), unit: "สิบ" },
      { value: num % 10, unit: "" },
    ];

    const numbers = [
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

    for (const digit of digits) {
      if (digit.value === 0) {
        continue;
      }

      if (digit.unit === "สิบ") {
        if (digit.value === 1) {
          result += "สิบ";
        } else if (digit.value === 2) {
          result += "ยี่สิบ";
        } else {
          result += numbers[digit.value] + "สิบ";
        }
        continue;
      }

      if (digit.unit === "") {
        if (digit.value === 1 && num >= 10) {
          result += "เอ็ด";
        } else {
          result += numbers[digit.value];
        }
        continue;
      }

      result += numbers[digit.value] + digit.unit;
    }

    return result;
  }

  let result = "";

  if (baht === 0) {
    result = "ศูนย์บาท";
  } else {
    result = convertNumber(baht) + "บาท";
  }

  if (satang === 0) {
    result += "ถ้วน";
  } else {
    result += convertNumber(satang) + "สตางค์";
  }

  return result;
}

/* =========================================================
   POSITION HELPER
========================================================= */

type Box = {
  left: number;
  top: number;
  width: number;
};

function pos(p: Box, extra: CSSProperties = {}): CSSProperties {
  return {
    position: "absolute",
    left: `${p.left + OFFSET_X}mm`,
    top: `${p.top + OFFSET_Y}mm`,
    width: `${p.width}mm`,
    ...extra,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default async function InvoicePrintPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      purchaseOrder: true,
      items: {
        orderBy: { itemNo: "asc" },
      },
      payments: {
        orderBy: { paymentDate: "asc" },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  const amountInWords = numberToThaiText(Number(invoice.grandTotal));

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        html {
          margin: 0;
          padding: 0;
          width: 210mm;
          min-width: 210mm;
          height: 297mm;
          min-height: 297mm;
        }

        body {
          margin: 0;
          padding: 0;
          width: 210mm;
          min-width: 210mm;
          height: 297mm;
          min-height: 297mm;
          background: #e5e7eb;
          font-family: Arial, Tahoma, sans-serif;
          overflow-x: hidden;
        }

        .print-toolbar {
          width: 210mm;
          min-height: 60px;
          padding: 12px;
          background: white;
          border-bottom: 1px solid #d1d5db;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .print-page {
          position: relative;
          width: 210mm;
          height: 297mm;
          min-width: 210mm;
          min-height: 297mm;
          margin: 20px auto;
          padding: 0;
          background: white;
          overflow: hidden;
          flex-shrink: 0;
        }

        .field {
          position: absolute;
          font-size: 9pt;
          line-height: 1.15;
          color: #000;
          white-space: nowrap;
          overflow: visible;
          font-family: Arial, Tahoma, sans-serif;
        }

        .field.wrap {
          white-space: normal;
        }

        .table-field {
          position: absolute;
          font-size: 8.5pt;
          line-height: 1.1;
          color: #000;
          white-space: nowrap;
          overflow: visible;
          font-family: Arial, Tahoma, sans-serif;
          text-align: left;
          padding: 0;
        }

        .item {
          position: absolute;
          font-size: 8.5pt;
          line-height: 1.15;
          color: #000;
          overflow: hidden;
          text-align: left;
          font-family: Arial, Tahoma, sans-serif;
        }

        .amount-in-words {
          position: absolute;
          font-size: 8.5pt;
          line-height: 6mm;
          font-weight: 500;
          color: #000;
          white-space: nowrap;
          overflow: visible;
          font-family: Arial, Tahoma, sans-serif;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html {
            width: 210mm !important;
            min-width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body {
            width: 210mm !important;
            min-width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-toolbar {
            display: none !important;
          }

          .print-page {
            width: 210mm !important;
            height: 297mm !important;
            min-width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: hidden !important;
            page-break-after: always;
            page-break-inside: avoid;
            break-after: page;
          }
        }
      `}</style>

      <div className="print-toolbar">
        <PrintButton />
      </div>

      <div className="print-page">
        {/* ===== DEBUG GRID ===== */}

        {DEBUG && (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                backgroundImage: `
                  linear-gradient(to right, rgba(255,0,0,.55) 0.2mm, transparent 0.2mm),
                  linear-gradient(to bottom, rgba(255,0,0,.55) 0.2mm, transparent 0.2mm),
                  linear-gradient(to right, rgba(0,0,255,.18) 0.1mm, transparent 0.1mm),
                  linear-gradient(to bottom, rgba(0,0,255,.18) 0.1mm, transparent 0.1mm)
                `,
                backgroundSize: "10mm 10mm, 10mm 10mm, 5mm 5mm, 5mm 5mm",
              }}
            />

            {Array.from({ length: 21 }, (_, i) => (
              <div
                key={`x${i}`}
                style={{
                  position: "absolute",
                  left: `${i * 10 + 0.5}mm`,
                  top: "0.5mm",
                  fontSize: "6pt",
                  color: "red",
                }}
              >
                {i * 10}
              </div>
            ))}

            {Array.from({ length: 30 }, (_, i) => (
              <div
                key={`y${i}`}
                style={{
                  position: "absolute",
                  top: `${i * 10 + 0.5}mm`,
                  left: "0.5mm",
                  fontSize: "6pt",
                  color: "red",
                }}
              >
                {i * 10}
              </div>
            ))}
          </>
        )}

        {/* ===== INVOICE NUMBER ===== */}

        <div className="field" style={pos(POS.invoiceNumber, { fontSize: "9pt" })}>
          {invoice.invoiceNumber}
        </div>

        {/* ===== INVOICE DATE ===== */}

        <div className="field" style={pos(POS.invoiceDate, { fontSize: "9pt" })}>
          {formatDate(invoice.invoiceDate)}
        </div>

        {/* ===== CUSTOMER CODE ===== */}

        <div className="field" style={pos(POS.customerCode, { fontSize: "9pt" })}>
          {invoice.customerCodeSnapshot ?? ""}
        </div>

        {/* ===== CUSTOMER NAME ===== */}

        <div className="field" style={pos(POS.customerName, { fontSize: "9pt" })}>
          {invoice.customerNameSnapshot}
        </div>

        {/* ===== CUSTOMER ADDRESS ===== */}

        <div
          className="field wrap"
          style={pos(POS.customerAddress, {
            height: "11mm",
            lineHeight: "1.25",
            whiteSpace: "normal",
            fontSize: "8pt",
          })}
        >
          {invoice.customerAddressSnapshot ?? ""}
        </div>

        {/* ===== SHIP TO ===== */}

        <div
          className="field wrap"
          style={pos(POS.shipTo, {
            height: "8mm",
            lineHeight: "1.05",
            fontSize: "7pt",
            whiteSpace: "normal",
            overflow: "visible",
          })}
        >
          {invoice.shipToSnapshot ?? ""}
        </div>

        {/* ===== SALE ORDER ===== */}

        <div className="table-field" style={pos(POS.saleOrder, { fontSize: "8.5pt" })}>
          {invoice.saleOrderNumber ?? ""}
        </div>

        {/* ===== PURCHASE ORDER ===== */}

        <div className="table-field" style={pos(POS.poNumber, { fontSize: "8.5pt" })}>
          {invoice.purchaseOrder.poNumber}
        </div>

        {/* ===== SALE NAME ===== */}

        <div className="table-field" style={pos(POS.saleName, { fontSize: "8.5pt" })}>
          {invoice.saleName ?? ""}
        </div>

        {/* ===== ENTRY BY ===== */}

        <div className="table-field" style={pos(POS.entryBy, { fontSize: "8.5pt" })}>
          {invoice.entryBy ?? ""}
        </div>

        {/* ===== ITEMS ===== */}

        {invoice.items.map((item, index) => {
          const top = ITEM_START_TOP + index * ITEM_ROW_HEIGHT;
          const rowHeight = `${ITEM_ROW_HEIGHT - 0.5}mm`;

          return (
            <div key={item.id}>
              <div
                className="item"
                style={pos(
                  { ...COL.itemNo, top },
                  { textAlign: "left", height: rowHeight, whiteSpace: "nowrap" }
                )}
              >
                {item.itemNo}
              </div>

              <div
                className="item"
                style={pos(
                  { ...COL.description, top },
                  { height: rowHeight, whiteSpace: "normal", lineHeight: "1.15" }
                )}
              >
                {item.description}
              </div>

              <div
                className="item"
                style={pos(
                  { ...COL.quantity, top },
                  { textAlign: "left", height: rowHeight, whiteSpace: "nowrap" }
                )}
              >
                {Number(item.quantity).toLocaleString("en-US")}
              </div>

              <div
                className="item"
                style={pos(
                  { ...COL.unitPrice, top },
                  { textAlign: "left", height: rowHeight, whiteSpace: "nowrap" }
                )}
              >
                {formatMoney(item.unitPrice)}
              </div>

              <div
                className="item"
                style={pos(
                  { ...COL.discount, top },
                  { textAlign: "left", height: rowHeight, whiteSpace: "nowrap" }
                )}
              >
                {item.discountPercent
                  ? `${Number(item.discountPercent).toLocaleString("en-US")}%`
                  : ""}
              </div>

              <div
                className="item"
                style={pos(
                  { ...COL.amount, top },
                  { textAlign: "left", height: rowHeight, whiteSpace: "nowrap" }
                )}
              >
                {formatMoney(item.amount)}
              </div>
            </div>
          );
        })}

        {/* ===== AMOUNT IN WORDS ===== */}

        <div
          className="amount-in-words"
          style={pos(POS.amountInWords, {
            height: "6mm",
            lineHeight: "6mm",
            padding: 0,
            margin: 0,
            whiteSpace: "nowrap",
            fontSize: "8.5pt",
          })}
        >
          {amountInWords}
        </div>

        {/* ===== SUB TOTAL ===== */}

        <div
          className="field"
          style={pos(POS.subtotal, { fontSize: "9pt", textAlign: "right" })}
        >
          {formatMoney(invoice.subtotal)}
        </div>

        {/* ===== VAT ===== */}

        <div
          className="field"
          style={pos(POS.vat, { fontSize: "9pt", textAlign: "right" })}
        >
          {formatMoney(invoice.vat)}
        </div>

        {/* ===== GRAND TOTAL ===== */}

        <div
          className="field"
          style={pos(POS.grandTotal, {
            fontSize: "9pt",
            fontWeight: 500,
            textAlign: "right",
          })}
        >
          {formatMoney(invoice.grandTotal)}
        </div>
      </div>
    </>
  );
}