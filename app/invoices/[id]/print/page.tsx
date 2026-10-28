import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import authOptions from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import PrintButton from "./PrintButton";

export const instant = false;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

/* =========================================================
   ตัวปรับเลื่อนทั้งใบ

   ถ้าปริ้นแล้วทุกอย่าง...
   - ไปทางขวา → ลด OFFSET_X
   - ไปทางซ้าย → เพิ่ม OFFSET_X
   - ลงต่ำ → ลด OFFSET_Y
   - ขึ้นสูง → เพิ่ม OFFSET_Y

   แนะนำปรับทีละ 0.5 - 1 mm
========================================================= */

const OFFSET_X = 0;
const OFFSET_Y = 0;

/* =========================================================
   ตำแหน่งข้อมูลบนแบบฟอร์ม
   กระดาษ 9 x 11 นิ้ว
   = 228.6 x 279.4 mm
========================================================= */

const POS = {
  /* -----------------------------
     เลขที่เอกสาร / วันที่
  ----------------------------- */

  invoiceNumber: {
    left: 156,
    top: 17.5,
    width: 58,
  },

  invoiceDate: {
    left: 156,
    top: 24,
    width: 42,
  },

  /* -----------------------------
     Customer
  ----------------------------- */

  customerCode: {
    left: 57,
    top: 42.5,
    width: 40,
  },

  customerName: {
    left: 28,
    top: 53.5,
    width: 125,
  },

  customerAddress: {
    left: 28,
    top: 61,
    width: 120,
  },

  /* -----------------------------
     Ship To / Due Date / Payment
  ----------------------------- */

  shipTo: {
    left: 158,
    top: 45.5,
    width: 62,
  },

  dueDateTop: {
    left: 158,
    top: 57.5,
    width: 40,
  },

  paymentTermTop: {
    left: 158,
    top: 68,
    width: 40,
  },

  /* -----------------------------
     แถวข้อมูลใต้หัวตาราง
  ----------------------------- */

  saleOrder: {
    left: 29,
    top: 80.5,
    width: 36,
  },

  paymentTerm: {
    left: 67,
    top: 80.5,
    width: 26,
  },

  dueDate: {
    left: 88,
    top: 80.5,
    width: 26,
  },

  poNumber: {
    left: 117,
    top: 80.5,
    width: 40,
  },

  saleName: {
    left: 160,
    top: 80.5,
    width: 26,
  },

  entryBy: {
    left: 188,
    top: 80.5,
    width: 32,
  },

  /* -----------------------------
     ยอดรวม
  ----------------------------- */

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

  /* =====================================================
     GRAND TOTAL

     บรรทัดเดียวกับจำนวนเงินเป็นตัวหนังสือ
  ===================================================== */

  grandTotal: {
    left: 190,
    top: 226,
    width: 32,
  },

  /* =====================================================
     จำนวนเงินเป็นตัวหนังสือ

     สำคัญ:
     top ต้องเท่ากับ grandTotal = 226

     เพื่อให้อยู่ "บรรทัดเดียวกัน"
     กับยอดรวมทั้งสิ้น
  ===================================================== */

  amountInWords: {
    left: 28,
    top: 226,
    width: 158,
  },
};

/* =========================================================
   ตารางสินค้า
========================================================= */

const ITEM_START_TOP = 96.5;

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
  if (!value) return "";

  return new Date(value).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* =========================================================
   แปลงตัวเลขเป็นข้อความภาษาไทย

   ตัวอย่าง

   12
   = สิบสองบาทถ้วน

   100
   = หนึ่งร้อยบาทถ้วน

   1,250
   = หนึ่งพันสองร้อยห้าสิบบาทถ้วน

   100,899.79
   = หนึ่งแสนแปดร้อยเก้าสิบเก้าบาทเจ็ดสิบเก้าสตางค์
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

    /* -----------------------------
       หลักล้าน
    ----------------------------- */

    if (num >= 1_000_000) {
      const millionPart =
        Math.floor(num / 1_000_000);

      result += convertNumber(millionPart);
      result += "ล้าน";

      num %= 1_000_000;
    }

    /* -----------------------------
       ตัวเลขแต่ละหลัก
    ----------------------------- */

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

      /* -----------------------------
         หลักสิบ
      ----------------------------- */

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

      /* -----------------------------
         หลักหน่วย
      ----------------------------- */

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

  /* -----------------------------
     บาท
  ----------------------------- */

  if (baht === 0) {
    result = "ศูนย์บาท";
  } else {
    result =
      convertNumber(baht) + "บาท";
  }

  /* -----------------------------
     สตางค์
  ----------------------------- */

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
  /* ---------------------------------------
     ตรวจสอบ Login
  --------------------------------------- */

  const session =
    await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  /* ---------------------------------------
     รับ ID
  --------------------------------------- */

  const { id } = await params;

  /* ---------------------------------------
     ดึง Invoice
  --------------------------------------- */

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

  /* ---------------------------------------
     จำนวนเงินเป็นตัวหนังสือ
  --------------------------------------- */

  const amountInWords =
    numberToThaiText(
      Number(invoice.grandTotal)
    );

  return (
    <>
      <style>{`

        /* =================================================
           กำหนดกระดาษ
        ================================================= */

        @page {
          size: 9in 11in;
          margin: 0;
        }

        /* =================================================
           Reset
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
        }

        body {
          margin: 0;
          padding: 0;
          width: 9in;
          min-width: 9in;
          background: #e5e7eb;

          font-family:
            Arial,
            Tahoma,
            sans-serif;
        }

        /* =================================================
           Toolbar
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
           หน้ากระดาษ
           9 x 11 นิ้ว
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
           ข้อมูลทั่วไป
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

        /* ข้อความหลายบรรทัด */

        .field.wrap {
          white-space: normal;
        }

        /* ชิดขวา */

        .field.right {
          text-align: right;
        }

        /* กึ่งกลาง */

        .field.center {
          text-align: center;
        }

        /* =================================================
           รายการสินค้า
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
           จำนวนเงินเป็นตัวหนังสือ

           สำคัญ:
           อยู่บรรทัดเดียวกับ Grand Total

           top = 226mm
           เท่ากับ POS.grandTotal

           ไม่ให้ตัดบรรทัด
        ================================================= */

        .amount-in-words {
          position: absolute;

          font-size: 8.5pt;

          line-height: 1;

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
          ปุ่ม Print
      ===================================================== */}

      <div className="print-toolbar">
        <PrintButton />
      </div>

      {/* =====================================================
          กระดาษ 9 x 11 นิ้ว
      ===================================================== */}

      <div className="print-page">

        {/* =================================================
            เลขที่ Invoice
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
            วันที่ Invoice
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
            CUSTOMER
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

        <div
          className="field"
          style={pos(
            POS.customerName
          )}
        >
          {invoice.customerNameSnapshot}
        </div>

        <div
          className="field wrap"
          style={pos(
            POS.customerAddress,
            {
              height: "14mm",
              lineHeight: "1.15",
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
            Due Date ด้านบน
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
            Payment Term ด้านบน
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
            แถวข้อมูลใต้หัวตาราง
        ================================================= */}

        {/* Sale Order */}

        <div
          className="field"
          style={pos(
            POS.saleOrder
          )}
        >
          {invoice.saleOrderNumber ??
            ""}
        </div>

        {/* Payment Term */}

        <div
          className="field"
          style={pos(
            POS.paymentTerm
          )}
        >
          {invoice.paymentTerm ??
            ""}
        </div>

        {/* Due Date */}

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

        {/* PO Number */}

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

        {/* Sale Name */}

        <div
          className="field"
          style={pos(
            POS.saleName
          )}
        >
          {invoice.saleName ??
            ""}
        </div>

        {/* Entry By */}

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
              <div
                key={item.id}
              >

                {/* -----------------------------------------
                    Item No.
                ----------------------------------------- */}

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

                {/* -----------------------------------------
                    Description
                ----------------------------------------- */}

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

                {/* -----------------------------------------
                    Quantity
                ----------------------------------------- */}

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

                {/* -----------------------------------------
                    Unit Price
                ----------------------------------------- */}

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

                {/* -----------------------------------------
                    Discount
                ----------------------------------------- */}

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

                {/* -----------------------------------------
                    Amount
                ----------------------------------------- */}

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
            จำนวนเงินเป็นตัวหนังสือ

            อยู่บรรทัดเดียวกับ
            "รวมเงินทั้งสิ้น"

            top = 226
            ตรงกับ Grand Total
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
            SUBTOTAL
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