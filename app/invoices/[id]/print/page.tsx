import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

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
   ขนาดกระดาษจริง (รวมขอบรู)

   กว้าง = 23 cm = 230 mm
   สูง   = 28 cm = 280 mm
========================================================= */

/* =========================================================
   ปรับเลื่อนทั้งใบ

   ถ้าปริ้นแล้วข้อมูล:
   ไปทางขวา 1 mm  => OFFSET_X = -1
   ไปทางซ้าย 1 mm => OFFSET_X = 1
   ลง 1 mm        => OFFSET_Y = -1
   ขึ้น 1 mm      => OFFSET_Y = 1
========================================================= */

const OFFSET_X = 0;
const OFFSET_Y = 0;

/* =========================================================
   ตำแหน่งข้อมูล (หน่วย mm)

   จุด 0,0 = มุมซ้ายบนของกระดาษจริง
   วัดจากรูปแบบฟอร์มจริง กระดาษ 230 x 280 mm

   เส้นสำคัญที่วัดได้:
   - ขอบขวากล่องฟอร์ม      ~ 213 mm
   - หัวตาราง Sale Order    ~ 76 - 85 mm
   - แถวข้อมูลใต้หัวตาราง   ~ 85 - 90 mm
   - หัวตารางรายการ         ~ 90 - 99 mm
   - สิ้นสุดพื้นที่รายการ    ~ 212 mm
   - กล่องสรุปยอด           ~ 212 - 243 mm
========================================================= */

const POS = {
  /* INVOICE NUMBER / DATE (กล่อง Original-Customer มุมขวาบน) */

  invoiceNumber: {
    left: 175,
    top: 20,
    width: 38,
  },

  invoiceDate: {
    left: 175,
    top: 25.5,
    width: 38,
  },

  /* CUSTOMER */

  customerCode: {
    left: 55,
    top: 45.5,
    width: 40,
  },

  customerName: {
    left: 20,
    top: 60,
    width: 130,
  },

  customerAddress: {
    left: 20,
    top: 64.5,
    width: 130,
  },

  /* SHIP TO (ช่องสูงประมาณ 5 mm) */

  shipTo: {
    left: 155,
    top: 48.6,
    width: 58,
  },

  /* =====================================================
     แถวข้อมูลใต้หัวตาราง (y ~ 85 - 90 mm)

     ไม่แสดง Term Of Payment และ Due Date
  ===================================================== */

  saleOrder: {
    left: 22,
    top: 86,
    width: 32,
  },

  poNumber: {
    left: 115,
    top: 86,
    width: 38,
  },

  saleName: {
    left: 155,
    top: 86,
    width: 25,
  },

  entryBy: {
    left: 190,
    top: 86,
    width: 23,
  },

  /* =====================================================
     กล่องสรุปยอด
     ช่องค่าเริ่มที่เส้น 190 mm ถึงขอบ 213 mm
  ===================================================== */

  subtotal: {
    left: 185,
    top: 215,
    width: 28,
  },

  vat: {
    left: 185,
    top: 225,
    width: 28,
  },

  grandTotal: {
    left: 185,
    top: 235,
    width: 28,
  },

  /* จำนวนเงินเป็นตัวหนังสือ (ใต้ข้อความเล็ก เหนือช่องลายเซ็น) */

  amountInWords: {
    left: 30,
    top: 235,
    width: 128,
  },
};

/* =========================================================
   ตารางสินค้า

   รายการแรกเริ่มที่ 10.5 cm = 105 mm
========================================================= */

const ITEM_START_TOP = 105; // 10.5 ซม.

/* ระยะห่างรายการ (mm) */

const ITEM_ROW_HEIGHT = 7;

/* =========================================================
   COLUMN

   left = จุดเริ่มข้อความ ตามดาวและตัวเลข ซม. ในรูป
   ข้อความทุกช่องชิดซ้าย เริ่มที่จุดนี้

   Item        2 ซม.
   Description ~ 4 ซม.
   Qty         11.5 ซม.
   Unit Price  13.5 ซม.
   Discount    16 ซม.
   Amount      18.5 ซม.
========================================================= */

const COL = {
  itemNo: {
    left: 20,
    width: 7,
  },

  description: {
    left: 40,
    width: 68,
  },

  quantity: {
    left: 115,
    width: 10.5,
  },

  unitPrice: {
    left: 135,
    width: 18,
  },

  discount: {
    left: 160,
    width: 20,
  },

  amount: {
    left: 185,
    width: 28,
  },
};

/* =========================================================
   FORMAT MONEY
========================================================= */

function formatMoney(value: unknown) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* =========================================================
   FORMAT DATE
========================================================= */

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

    /* ล้าน */

    if (num >= 1_000_000) {
      const millionPart = Math.floor(num / 1_000_000);

      result += convertNumber(millionPart);

      result += "ล้าน";

      num %= 1_000_000;
    }

    /* หลักต่าง ๆ */

    const digits = [
      {
        value: Math.floor(num / 100_000),
        unit: "แสน",
      },

      {
        value: Math.floor((num % 100_000) / 10_000),
        unit: "หมื่น",
      },

      {
        value: Math.floor((num % 10_000) / 1_000),
        unit: "พัน",
      },

      {
        value: Math.floor((num % 1_000) / 100),
        unit: "ร้อย",
      },

      {
        value: Math.floor((num % 100) / 10),
        unit: "สิบ",
      },

      {
        value: num % 10,
        unit: "",
      },
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

      /* หลักสิบ */

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

      /* หลักหน่วย */

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

  /* บาท */

  if (baht === 0) {
    result = "ศูนย์บาท";
  } else {
    result = convertNumber(baht) + "บาท";
  }

  /* สตางค์ */

  if (satang === 0) {
    result += "ถ้วน";
  } else {
    result += convertNumber(satang) + "สตางค์";
  }

  return result;
}

/* =========================================================
   TYPE
========================================================= */

type Box = {
  left: number;
  top: number;
  width: number;
};

/* =========================================================
   POSITION (ทุกตำแหน่งใช้ mm)
========================================================= */

function pos(
  p: Box,
  extra: React.CSSProperties = {}
): React.CSSProperties {
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
  /* LOGIN */

  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  /* ID */

  const { id } = await params;

  /* INVOICE */

  const invoice = await prisma.invoice.findUnique({
    where: {
      id,
    },

    include: {
      purchaseOrder: true,

      items: {
        orderBy: {
          itemNo: "asc",
        },
      },

      payments: {
        orderBy: {
          paymentDate: "asc",
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  /* AMOUNT IN WORDS */

  const amountInWords = numberToThaiText(Number(invoice.grandTotal));

  return (
    <>
      <style>{`

        /* PAGE SIZE: 230mm x 280mm (รวมขอบรู) */

        @page {
          size: 230mm 280mm;
          margin: 0;
        }

        /* RESET */

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        html {
          margin: 0;
          padding: 0;

          width: 230mm;
          min-width: 230mm;

          height: 280mm;
          min-height: 280mm;
        }

        body {
          margin: 0;
          padding: 0;

          width: 230mm;
          min-width: 230mm;

          height: 280mm;
          min-height: 280mm;

          background: #e5e7eb;

          font-family: Arial, Tahoma, sans-serif;

          overflow-x: hidden;
        }

        /* TOOLBAR */

        .print-toolbar {
          width: 230mm;

          min-height: 60px;

          padding: 12px;

          background: white;

          border-bottom: 1px solid #d1d5db;

          display: flex;

          align-items: center;

          justify-content: center;
        }

        /* PRINT PAGE */

        .print-page {
          position: relative;

          width: 230mm;
          height: 280mm;

          min-width: 230mm;
          min-height: 280mm;

          margin: 20px auto;

          padding: 0;

          background: white;

          overflow: hidden;

          flex-shrink: 0;
        }

        /* FIELD */

        .field {
          position: absolute;

          font-size: 9.5pt;

          line-height: 1.15;

          color: #000;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: clip;

          font-family: Arial, Tahoma, sans-serif;
        }

        .field.wrap {
          white-space: normal;
        }

        .field.right {
          text-align: right;
        }

        .field.center {
          text-align: center;
        }

        /* TABLE FIELD */

        .table-field {
          position: absolute;

          font-size: 8.5pt;

          line-height: 1.1;

          color: #000;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: clip;

          font-family: Arial, Tahoma, sans-serif;

          text-align: center;

          padding-left: 1mm;

          padding-right: 1mm;
        }

        /* ITEM */

        .item {
          position: absolute;

          font-size: 9pt;

          line-height: 1.15;

          color: #000;

          overflow: hidden;

          text-align: left;

          font-family: Arial, Tahoma, sans-serif;
        }

        /* AMOUNT WORDS */

        .amount-in-words {
          position: absolute;

          font-size: 8.5pt;

          line-height: 6mm;

          font-weight: 500;

          color: #000;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: clip;

          font-family: Arial, Tahoma, sans-serif;
        }

        /* PRINT */

        @media print {

          @page {
            size: 230mm 280mm;
            margin: 0;
          }

          html {
            width: 230mm !important;
            min-width: 230mm !important;

            height: 280mm !important;
            min-height: 280mm !important;

            margin: 0 !important;
            padding: 0 !important;
          }

          body {
            width: 230mm !important;
            min-width: 230mm !important;

            height: 280mm !important;
            min-height: 280mm !important;

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
            width: 230mm !important;
            height: 280mm !important;

            min-width: 230mm !important;
            min-height: 280mm !important;

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

      {/* PRINT BUTTON */}

      <div className="print-toolbar">
        <PrintButton />
      </div>

      {/* PAPER 230 x 280 MM */}

      <div className="print-page">

        {/* INVOICE NUMBER */}

        <div
          className="field"
          style={pos(POS.invoiceNumber, {
            fontSize: "9pt",
          })}
        >
          {invoice.invoiceNumber}
        </div>

        {/* INVOICE DATE */}

        <div
          className="field"
          style={pos(POS.invoiceDate, {
            fontSize: "9pt",
          })}
        >
          {formatDate(invoice.invoiceDate)}
        </div>

        {/* CUSTOMER CODE */}

        <div
          className="field"
          style={pos(POS.customerCode, {
            fontSize: "9pt",
          })}
        >
          {invoice.customerCodeSnapshot ?? ""}
        </div>

        {/* CUSTOMER NAME */}

        <div
          className="field"
          style={pos(POS.customerName, {
            fontSize: "9.5pt",
          })}
        >
          {invoice.customerNameSnapshot}
        </div>

        {/* CUSTOMER ADDRESS (เริ่ม 6.45 cm สูง 11 mm ก่อนถึงหัวตาราง 76 mm) */}

        <div
          className="field wrap"
          style={pos(POS.customerAddress, {
            height: "11mm",

            lineHeight: "1.3",

            whiteSpace: "normal",

            fontSize: "8.3pt",
          })}
        >
          {invoice.customerAddressSnapshot ?? ""}
        </div>

        {/* SHIP TO (ช่องสูงประมาณ 5.5 mm = 2 บรรทัด ฟอนต์ 7pt) */}

        <div
          className="field wrap"
          style={pos(POS.shipTo, {
            height: "5.6mm",

            lineHeight: "1.05",

            fontSize: "7pt",

            whiteSpace: "normal",

            overflow: "visible",
          })}
        >
          {invoice.shipToSnapshot ?? ""}
        </div>

        {/* SALE ORDER */}

        <div
          className="table-field"
          style={pos(POS.saleOrder, {
            textAlign: "left",

            paddingLeft: 0,

            paddingRight: 0,

            fontSize: "8.5pt",
          })}
        >
          {invoice.saleOrderNumber ?? ""}
        </div>

        {/* PURCHASE ORDER */}

        <div
          className="table-field"
          style={pos(POS.poNumber, {
            textAlign: "left",
            paddingLeft: 0,

            fontSize: "8.5pt",
          })}
        >
          {invoice.purchaseOrder.poNumber}
        </div>

        {/* SALE NAME */}

        <div
          className="table-field"
          style={pos(POS.saleName, {
            textAlign: "left",
            paddingLeft: 0,

            fontSize: "8.5pt",
          })}
        >
          {invoice.saleName ?? ""}
        </div>

        {/* ENTRY BY */}

        <div
          className="table-field"
          style={pos(POS.entryBy, {
            textAlign: "left",
            paddingLeft: 0,

            fontSize: "8.5pt",
          })}
        >
          {invoice.entryBy ?? ""}
        </div>

        {/* ITEMS */}

        {invoice.items.map((item, index) => {
          const top = ITEM_START_TOP + index * ITEM_ROW_HEIGHT;

          const rowHeight = `${ITEM_ROW_HEIGHT - 0.5}mm`;

          return (
            <div key={item.id}>

              {/* ITEM NO */}

              <div
                className="item"
                style={pos(
                  {
                    ...COL.itemNo,
                    top,
                  },
                  {
                    textAlign: "left",

                    height: rowHeight,

                    whiteSpace: "nowrap",

                    fontSize: "8.5pt",
                  }
                )}
              >
                {item.itemNo}
              </div>

              {/* DESCRIPTION */}

              <div
                className="item"
                style={pos(
                  {
                    ...COL.description,
                    top,
                  },
                  {
                    height: rowHeight,

                    whiteSpace: "normal",

                    lineHeight: "1.15",

                    fontSize: "8.8pt",
                  }
                )}
              >
                {item.description}
              </div>

              {/* QUANTITY */}

              <div
                className="item"
                style={pos(
                  {
                    ...COL.quantity,
                    top,
                  },
                  {
                    textAlign: "left",

                    height: rowHeight,

                    whiteSpace: "nowrap",

                    fontSize: "8.8pt",
                  }
                )}
              >
                {Number(item.quantity).toLocaleString("en-US")}
              </div>

              {/* UNIT PRICE */}

              <div
                className="item"
                style={pos(
                  {
                    ...COL.unitPrice,
                    top,
                  },
                  {
                    textAlign: "left",

                    height: rowHeight,

                    whiteSpace: "nowrap",

                    fontSize: "8.8pt",
                  }
                )}
              >
                {formatMoney(item.unitPrice)}
              </div>

              {/* DISCOUNT */}

              <div
                className="item"
                style={pos(
                  {
                    ...COL.discount,
                    top,
                  },
                  {
                    textAlign: "left",

                    height: rowHeight,

                    whiteSpace: "nowrap",

                    fontSize: "8.8pt",
                  }
                )}
              >
                {item.discountPercent
                  ? `${Number(item.discountPercent).toLocaleString("en-US")}%`
                  : ""}
              </div>

              {/* AMOUNT */}

              <div
                className="item"
                style={pos(
                  {
                    ...COL.amount,
                    top,
                  },
                  {
                    textAlign: "left",

                    height: rowHeight,

                    whiteSpace: "nowrap",

                    fontSize: "8.8pt",
                  }
                )}
              >
                {formatMoney(item.amount)}
              </div>

            </div>
          );
        })}

        {/* AMOUNT IN WORDS */}

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

        {/* SUB TOTAL */}

        <div
          className="field"
          style={pos(POS.subtotal, {
            fontSize: "9pt",
          })}
        >
          {formatMoney(invoice.subtotal)}
        </div>

        {/* VAT */}

        <div
          className="field"
          style={pos(POS.vat, {
            fontSize: "9pt",
          })}
        >
          {formatMoney(invoice.vat)}
        </div>

        {/* GRAND TOTAL */}

        <div
          className="field"
          style={pos(POS.grandTotal, {
            fontSize: "9pt",

            fontWeight: 500,
          })}
        >
          {formatMoney(invoice.grandTotal)}
        </div>

      </div>
    </>
  );
}