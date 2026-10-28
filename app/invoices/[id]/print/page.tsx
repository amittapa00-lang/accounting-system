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
   ตัวปรับเลื่อนทั้งใบ
========================================================= */

const OFFSET_X = 0;
const OFFSET_Y = 0;

/* =========================================================
   ตำแหน่งข้อมูลบนแบบฟอร์ม
   กระดาษ 9 x 11 นิ้ว
   = 228.6 x 279.4 mm
========================================================= */

const POS = {
  /* =====================================================
     Invoice No. / Date
  ===================================================== */

  invoiceNumber: {
    left: 163,
    top: 20,
    width: 51,
  },

  invoiceDate: {
    left: 163,
    top: 27,
    width: 42,
  },

  /* =====================================================
     Customer
  ===================================================== */

  customerCode: {
    left: 36,
    top: 64,
    width: 55,
  },

  customerName: {
    left: 28,
    top: 72,
    width: 125,
  },

  customerAddress: {
    left: 28,
    top: 80,
    width: 120,
  },

  /* =====================================================
     Ship To / Due Date / Payment
  ===================================================== */

  shipTo: {
    left: 158,
    top: 50,
    width: 62,
  },

  dueDateTop: {
    left: 158,
    top: 62,
    width: 40,
  },

  paymentTermTop: {
    left: 158,
    top: 73,
    width: 40,
  },

  /* =====================================================
     แถวข้อมูลใต้ Customer

     รอบนี้เลื่อนลงจาก 88 → 96 mm
     เพื่อไม่ให้ชนกับที่อยู่ลูกค้า
  ===================================================== */

  saleOrder: {
    left: 29,
    top: 96,
    width: 36,
  },

  paymentTerm: {
    left: 67,
    top: 96,
    width: 26,
  },

  dueDate: {
    left: 88,
    top: 96,
    width: 26,
  },

  poNumber: {
    left: 117,
    top: 96,
    width: 40,
  },

  saleName: {
    left: 160,
    top: 96,
    width: 26,
  },

  entryBy: {
    left: 188,
    top: 96,
    width: 32,
  },

  /* =====================================================
     ยอดรวม
  ===================================================== */

  subtotal: {
    left: 190,
    top: 205.5,
    width: 32,
  },

  vat: {
    left: 190,
    top: 216.5,
    width: 32,
  },

  grandTotal: {
    left: 190,
    top: 226,
    width: 32,
  },

  /* =====================================================
     จำนวนเงินเป็นตัวหนังสือ
  ===================================================== */

  amountInWords: {
    left: 28,
    top: 226,
    width: 158,
  },
};

/* =========================================================
   ตารางสินค้า

   เลื่อนลงตามแถวข้อมูลด้านบน
========================================================= */

const ITEM_START_TOP = 120;

/* ระยะห่างระหว่างรายการ */
const ITEM_ROW_HEIGHT = 7;

/* =========================================================
   ตำแหน่งแต่ละคอลัมน์
========================================================= */

const COL = {
  itemNo: {
    left: 18,
    width: 11,
  },

  description: {
    left: 31,
    width: 83,
  },

  quantity: {
    left: 117,
    width: 13,
  },

  unitPrice: {
    left: 132,
    width: 25,
  },

  discount: {
    left: 160,
    width: 25,
  },

  amount: {
    left: 188,
    width: 30,
  },
};

/* =========================================================
   Format เงิน
========================================================= */

function formatMoney(value: unknown) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* =========================================================
   Format วันที่
========================================================= */

function formatDate(
  value: Date | string | null | undefined
) {
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

  const rounded =
    Math.round(number * 100) / 100;

  const baht = Math.floor(rounded);

  const satang = Math.round(
    (rounded - baht) * 100
  );

  function convertNumber(num: number): string {
    if (num === 0) {
      return "";
    }

    let result = "";

    /* ===================================================
       ล้าน
    =================================================== */

    if (num >= 1_000_000) {
      const millionPart =
        Math.floor(num / 1_000_000);

      result += convertNumber(millionPart);
      result += "ล้าน";

      num %= 1_000_000;
    }

    /* ===================================================
       หลักต่าง ๆ
    =================================================== */

    const digits = [
      {
        value: Math.floor(num / 100_000),
        unit: "แสน",
      },

      {
        value: Math.floor(
          (num % 100_000) / 10_000
        ),
        unit: "หมื่น",
      },

      {
        value: Math.floor(
          (num % 10_000) / 1_000
        ),
        unit: "พัน",
      },

      {
        value: Math.floor(
          (num % 1_000) / 100
        ),
        unit: "ร้อย",
      },

      {
        value: Math.floor(
          (num % 100) / 10
        ),
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
          result +=
            numbers[digit.value] + "สิบ";
        }

        continue;
      }

      /* หลักหน่วย */

      if (digit.unit === "") {
        if (
          digit.value === 1 &&
          num >= 10
        ) {
          result += "เอ็ด";
        } else {
          result += numbers[digit.value];
        }

        continue;
      }

      result +=
        numbers[digit.value] + digit.unit;
    }

    return result;
  }

  let result = "";

  /* บาท */

  if (baht === 0) {
    result = "ศูนย์บาท";
  } else {
    result =
      convertNumber(baht) + "บาท";
  }

  /* สตางค์ */

  if (satang === 0) {
    result += "ถ้วน";
  } else {
    result +=
      convertNumber(satang) +
      "สตางค์";
  }

  return result;
}

/* =========================================================
   Type สำหรับตำแหน่ง
========================================================= */

type Box = {
  left: number;
  top: number;
  width: number;
};

/* =========================================================
   ฟังก์ชันกำหนดตำแหน่ง
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
   Invoice Print Page
========================================================= */

export default async function InvoicePrintPage({
  params,
}: PageProps) {
  /* =====================================================
     ตรวจสอบ Login
  ===================================================== */

  const session =
    await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  /* =====================================================
     รับ ID
  ===================================================== */

  const { id } = await params;

  /* =====================================================
     ดึง Invoice
  ===================================================== */

  const invoice =
    await prisma.invoice.findUnique({
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

  /* =====================================================
     จำนวนเงินเป็นตัวหนังสือ
  ===================================================== */

  const amountInWords =
    numberToThaiText(
      Number(invoice.grandTotal)
    );

  return (
    <>
      <style>{`

        /* =================================================
           PAGE
        ================================================= */

        @page {
          size: 9in 11in;
          margin: 0;
        }

        /* =================================================
           RESET
        ================================================= */

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        html {
          margin: 0;
          padding: 0;

          width: 9in;
          min-width: 9in;

          height: 11in;
        }

        body {
          margin: 0;
          padding: 0;

          width: 9in;
          min-width: 9in;

          height: 11in;

          background: #e5e7eb;

          font-family:
            Arial,
            Tahoma,
            sans-serif;
        }

        /* =================================================
           TOOLBAR
        ================================================= */

        .print-toolbar {
          width: 100%;

          min-height: 60px;

          padding: 12px;

          background: white;

          border-bottom:
            1px solid #d1d5db;

          display: flex;

          align-items: center;

          justify-content: center;
        }

        /* =================================================
           PRINT PAGE
        ================================================= */

        .print-page {
          position: relative;

          width: 9in;
          height: 11in;

          min-width: 9in;
          min-height: 11in;

          margin: 20px auto;

          background: white;

          overflow: hidden;

          flex-shrink: 0;
        }

        /* =================================================
           FIELD
        ================================================= */

        .field {
          position: absolute;

          font-size: 10pt;

          line-height: 1.15;

          color: #000;

          white-space: nowrap;

          overflow: hidden;

          font-family:
            Arial,
            Tahoma,
            sans-serif;
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

        /* =================================================
           ITEM
        ================================================= */

        .item {
          position: absolute;

          font-size: 9.5pt;

          line-height: 1.15;

          color: #000;

          overflow: hidden;

          font-family:
            Arial,
            Tahoma,
            sans-serif;
        }

        /* =================================================
           AMOUNT IN WORDS
        ================================================= */

        .amount-in-words {
          position: absolute;

          font-size: 8.5pt;

          line-height: 6mm;

          font-weight: 500;

          color: #000;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: clip;

          font-family:
            Arial,
            Tahoma,
            sans-serif;
        }

        /* =================================================
           PRINT
        ================================================= */

        @media print {

          html {
            width: 9in !important;
            min-width: 9in !important;

            height: 11in !important;

            margin: 0 !important;
            padding: 0 !important;
          }

          body {
            width: 9in !important;
            min-width: 9in !important;

            height: 11in !important;

            margin: 0 !important;
            padding: 0 !important;

            background: white !important;
          }

          .print-toolbar {
            display: none !important;
          }

          .print-page {
            width: 9in !important;
            height: 11in !important;

            min-width: 9in !important;
            min-height: 11in !important;

            margin: 0 !important;

            background: white !important;

            overflow: hidden !important;

            page-break-after: always;

            page-break-inside: avoid;
          }
        }

      `}</style>

      {/* =====================================================
          PRINT BUTTON
      ===================================================== */}

      <div className="print-toolbar">
        <PrintButton />
      </div>

      {/* =====================================================
          กระดาษ
      ===================================================== */}

      <div className="print-page">

        {/* =================================================
            INVOICE NUMBER
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.invoiceNumber
          )}
        >
          {invoice.invoiceNumber}
        </div>

        {/* =================================================
            INVOICE DATE
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.invoiceDate
          )}
        >
          {formatDate(
            invoice.invoiceDate
          )}
        </div>

        {/* =================================================
            CUSTOMER CODE
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.customerCode
          )}
        >
          {invoice.customerCodeSnapshot ??
            ""}
        </div>

        {/* =================================================
            CUSTOMER NAME
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.customerName
          )}
        >
          {invoice.customerNameSnapshot}
        </div>

        {/* =================================================
            CUSTOMER ADDRESS
        ================================================= */}

        <div
          className="field wrap"
          style={pos(
            POS.customerAddress,
            {
              height: "16mm",

              lineHeight: "1.35",

              whiteSpace: "normal",
            }
          )}
        >
          {invoice.customerAddressSnapshot ??
            ""}
        </div>

        {/* =================================================
            SHIP TO
        ================================================= */}

        <div
          className="field wrap"
          style={pos(
            POS.shipTo,
            {
              height: "10mm",

              lineHeight: "1.15",
            }
          )}
        >
          {invoice.shipToSnapshot ??
            ""}
        </div>

        {/* =================================================
            DUE DATE ด้านบน
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.dueDateTop
          )}
        >
          {formatDate(
            invoice.dueDate
          )}
        </div>

        {/* =================================================
            PAYMENT TERM ด้านบน
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.paymentTermTop
          )}
        >
          {invoice.paymentTerm ??
            ""}
        </div>

        {/* =================================================
            SALE ORDER
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.saleOrder
          )}
        >
          {invoice.saleOrderNumber ??
            ""}
        </div>

        {/* =================================================
            PAYMENT TERM
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.paymentTerm
          )}
        >
          {invoice.paymentTerm ??
            ""}
        </div>

        {/* =================================================
            DUE DATE
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.dueDate
          )}
        >
          {formatDate(
            invoice.dueDate
          )}
        </div>

        {/* =================================================
            PURCHASE ORDER NUMBER
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.poNumber
          )}
        >
          {
            invoice.purchaseOrder
              .poNumber
          }
        </div>

        {/* =================================================
            SALE NAME
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.saleName
          )}
        >
          {invoice.saleName ??
            ""}
        </div>

        {/* =================================================
            ENTRY BY
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.entryBy
          )}
        >
          {invoice.entryBy ??
            ""}
        </div>

        {/* =================================================
            รายการสินค้า
        ================================================= */}

        {invoice.items.map(
          (item, index) => {
            const top =
              ITEM_START_TOP +
              index *
                ITEM_ROW_HEIGHT;

            const rowHeight =
              `${ITEM_ROW_HEIGHT - 0.5}mm`;

            return (
              <div key={item.id}>

                {/* ITEM NO. */}

                <div
                  className="item"
                  style={pos(
                    {
                      ...COL.itemNo,
                      top,
                    },
                    {
                      textAlign:
                        "center",

                      height:
                        rowHeight,
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
                      height:
                        rowHeight,

                      whiteSpace:
                        "normal",

                      lineHeight:
                        "1.15",
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
                      textAlign:
                        "right",

                      height:
                        rowHeight,
                    }
                  )}
                >
                  {Number(
                    item.quantity
                  ).toLocaleString(
                    "en-US"
                  )}
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
                      textAlign:
                        "right",

                      height:
                        rowHeight,
                    }
                  )}
                >
                  {formatMoney(
                    item.unitPrice
                  )}
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
                      textAlign:
                        "right",

                      height:
                        rowHeight,
                    }
                  )}
                >
                  {item.discountPercent
                    ? `${Number(
                        item.discountPercent
                      ).toLocaleString(
                        "en-US"
                      )}%`
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
                      textAlign:
                        "right",

                      height:
                        rowHeight,
                    }
                  )}
                >
                  {formatMoney(
                    item.amount
                  )}
                </div>

              </div>
            );
          }
        )}

        {/* =================================================
            AMOUNT IN WORDS
        ================================================= */}

        <div
          className="amount-in-words"
          style={pos(
            POS.amountInWords,
            {
              height: "6mm",

              lineHeight: "6mm",

              padding: 0,

              margin: 0,

              whiteSpace:
                "nowrap",
            }
          )}
        >
          {amountInWords}
        </div>

        {/* =================================================
            SUB TOTAL
        ================================================= */}

        <div
          className="field right"
          style={pos(
            POS.subtotal
          )}
        >
          {formatMoney(
            invoice.subtotal
          )}
        </div>

        {/* =================================================
            VAT
        ================================================= */}

        <div
          className="field right"
          style={pos(
            POS.vat
          )}
        >
          {formatMoney(
            invoice.vat
          )}
        </div>

        {/* =================================================
            GRAND TOTAL
        ================================================= */}

        <div
          className="field right"
          style={pos(
            POS.grandTotal
          )}
        >
          {formatMoney(
            invoice.grandTotal
          )}
        </div>

      </div>
    </>
  );
}