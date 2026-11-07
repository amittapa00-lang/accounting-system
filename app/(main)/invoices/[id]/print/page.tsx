import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { requirePageSession } from "@/lib/auth";
import { bahtText } from "@/lib/bahtText";
import { formatDate, formatMoney } from "@/lib/format";
import { formatLineDiscount, formatQuantity } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";

import PrintButton from "@/components/invoices/PrintButton";

export const instant = false;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    debug?: string;
  }>;
};

/* =========================================================
   DEBUG GRID
   เปิดด้วย ?debug=1 ต่อท้าย URL
   = พิมพ์เส้นกริดทุก 1 ซม. (เส้นแดง) และ 5 มม. (เส้นฟ้า) ไว้ปรับตำแหน่ง
========================================================= */

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
  invoiceNumber: { left: 165, top: 29, width: 25 },
  invoiceDate: { left: 165, top: 35, width: 25 },

  customerCode: { left: 45, top: 55, width: 30 },
  customerName: { left: 15, top: 67, width: 125 },
  customerAddress: { left: 15, top: 71.5, width: 125 },
  shipTo: { left: 140, top: 60, width: 60 },

  saleOrder: { left: 20, top: 95, width: 90 },
  poNumber: { left: 115, top: 95, width: 33 },
  saleName: { left: 150, top: 95, width: 25 },
  entryBy: { left: 177, top: 95, width: 23 },

  subtotal: { left: 178, top: 230, width: 22 },
  vat: { left: 178, top: 240, width: 22 },
  grandTotal: { left: 178, top: 250, width: 22 },

  amountInWords: { left: 15, top: 252, width: 150 },
};

/* =========================================================
   ตารางสินค้า
========================================================= */

const ITEM_START_TOP = 99;
const ITEM_ROW_HEIGHT = 7;

/** แถวรายการที่ลงได้ต่อหน้า ก่อนถึงช่องยอดรวม (99 + 18 x 7 = 225 < 230) */
const ROWS_PER_PAGE = Math.floor((POS.subtotal.top - ITEM_START_TOP) / ITEM_ROW_HEIGHT);

/** รายละเอียด 1 แถว (7 มม.) แสดงได้ 2 บรรทัด */
const DESCRIPTION_LINES_PER_ROW = 2;

const COL = {
  itemNo: { left: 15, width: 10 },
  description: { left: 20, width: 77 },
  quantity: { left: 98, width: 13 },
  unitPrice: { left: 111.5, width: 32 },
  discount: { left: 143.5, width: 29 },
  amount: { left: 173, width: 27 },
};

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
   แบ่งหน้า: รายการที่ยาวเกินพื้นที่ขึ้นหน้าใหม่ ยอดรวมพิมพ์ที่หน้าสุดท้าย
========================================================= */

type PlacedItem<T> = { item: T; row: number; rows: number };

function paginate<T extends { description: string }>(items: T[]): PlacedItem<T>[][] {
  const pages: PlacedItem<T>[][] = [[]];
  let row = 0;

  for (const item of items) {
    const lineCount = item.description.split(/\r?\n/).length;
    const rows = Math.min(Math.max(1, Math.ceil(lineCount / DESCRIPTION_LINES_PER_ROW)), ROWS_PER_PAGE);

    if (row + rows > ROWS_PER_PAGE) {
      pages.push([]);
      row = 0;
    }

    pages[pages.length - 1].push({ item, row, rows });
    row += rows;
  }

  return pages;
}

/* =========================================================
   PAGE
========================================================= */

export default async function InvoicePrintPage({ params, searchParams }: PageProps) {
  await requirePageSession();

  const { id } = await params;
  const { debug } = await searchParams;
  const showGrid = debug === "1";

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      purchaseOrder: { select: { poNumber: true } },
      items: {
        orderBy: { itemNo: "asc" },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  if (invoice.status === "CANCELLED") {
    return (
      <main className="p-6">
        <div className="mx-auto max-w-xl rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">Invoice {invoice.invoiceNumber} ถูกยกเลิกแล้ว</h1>

          <p className="mt-2 text-sm text-slate-500">ไม่สามารถพิมพ์ Invoice ที่ถูกยกเลิกได้</p>

          <Link
            href={`/invoices/${invoice.id}`}
            className="mt-6 inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            กลับไปหน้า Invoice
          </Link>
        </div>
      </main>
    );
  }

  const pages = paginate(invoice.items);
  const amountInWords = bahtText(invoice.grandTotal);

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        .print-root,
        .print-root *,
        .print-root *::before,
        .print-root *::after {
          box-sizing: border-box;
        }

        .print-root {
          background: #e5e7eb;
          padding-bottom: 20px;
          font-family: Arial, Tahoma, sans-serif;
        }

        .print-toolbar {
          width: 210mm;
          min-height: 60px;
          margin: 0 auto;
          padding: 12px;
          background: white;
          border-bottom: 1px solid #d1d5db;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .print-notice {
          font-size: 13px;
          color: #b45309;
        }

        .print-page {
          position: relative;
          width: 210mm;
          height: 297mm;
          min-width: 210mm;
          min-height: 297mm;
          margin: 20px auto 0;
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
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-root {
            background: white !important;
            padding: 0 !important;
          }

          .print-toolbar {
            display: none !important;
          }

          .print-page {
            margin: 0 !important;
            break-after: page;
            break-inside: avoid;
          }

          .print-page:last-child {
            break-after: auto;
          }
        }
      `}</style>

      <div className="print-root">
        <div className="print-toolbar">
          <PrintButton />

          {invoice.status === "DRAFT" && (
            <p className="print-notice">Invoice นี้ยังเป็นฉบับร่าง (ยังไม่ได้กดออก Invoice)</p>
          )}

          {pages.length > 1 && (
            <p className="print-notice">
              มีสินค้า {invoice.items.length} รายการ เกินพื้นที่ 1 หน้า จะพิมพ์ทั้งหมด {pages.length} หน้า
              (ยอดรวมอยู่หน้าสุดท้าย)
            </p>
          )}
        </div>

        <div>
          {pages.map((pageItems, pageIndex) => {
            const isLastPage = pageIndex === pages.length - 1;

            return (
              <div className="print-page" key={pageIndex}>
                {/* ===== DEBUG GRID (?debug=1) ===== */}

                {showGrid && (
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
                  {formatDate(invoice.invoiceDate, "")}
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

                {pageItems.map(({ item, row, rows }) => {
                  const top = ITEM_START_TOP + row * ITEM_ROW_HEIGHT;
                  const firstRowHeight = `${ITEM_ROW_HEIGHT - 0.5}mm`;
                  const descriptionHeight = `${rows * ITEM_ROW_HEIGHT - 0.5}mm`;

                  return (
                    <div key={item.id}>
                      <div
                        className="item"
                        style={pos(
                          { ...COL.itemNo, top },
                          { textAlign: "left", height: firstRowHeight, whiteSpace: "nowrap" }
                        )}
                      >
                        {item.itemNo}
                      </div>

                      <div
                        className="item"
                        style={pos(
                          { ...COL.description, top },
                          { height: descriptionHeight, whiteSpace: "pre-line", lineHeight: "1.15" }
                        )}
                      >
                        {item.description}
                      </div>

                      <div
                        className="item"
                        style={pos(
                          { ...COL.quantity, top },
                          { textAlign: "left", height: firstRowHeight, whiteSpace: "nowrap" }
                        )}
                      >
                        {formatQuantity(item.quantity)}
                      </div>

                      <div
                        className="item"
                        style={pos(
                          { ...COL.unitPrice, top },
                          { textAlign: "left", height: firstRowHeight, whiteSpace: "nowrap" }
                        )}
                      >
                        {formatMoney(item.unitPrice)}
                      </div>

                      <div
                        className="item"
                        style={pos(
                          { ...COL.discount, top },
                          { textAlign: "left", height: firstRowHeight, whiteSpace: "nowrap" }
                        )}
                      >
                        {formatLineDiscount(item.discount, item.discountType)}
                      </div>

                      <div
                        className="item"
                        style={pos(
                          { ...COL.amount, top },
                          { textAlign: "right", height: firstRowHeight, whiteSpace: "nowrap" }
                        )}
                      >
                        {formatMoney(item.amount)}
                      </div>
                    </div>
                  );
                })}

                {isLastPage ? (
                  <>
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

                    <div className="field" style={pos(POS.subtotal, { fontSize: "9pt", textAlign: "right" })}>
                      {formatMoney(invoice.subtotal)}
                    </div>

                    {/* ===== VAT ===== */}

                    <div className="field" style={pos(POS.vat, { fontSize: "9pt", textAlign: "right" })}>
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
                  </>
                ) : (
                  /* ===== CONTINUED (ใต้แถวสุดท้ายของตาราง ก่อนช่องยอดรวม) ===== */
                  <div
                    className="item"
                    style={pos(
                      { ...COL.description, top: ITEM_START_TOP + ROWS_PER_PAGE * ITEM_ROW_HEIGHT },
                      { height: "4.5mm", whiteSpace: "nowrap" }
                    )}
                  >
                    (มีต่อหน้าถัดไป หน้า {pageIndex + 1}/{pages.length})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
