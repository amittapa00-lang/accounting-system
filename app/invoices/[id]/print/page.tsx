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
   ตำแหน่งข้อมูล
========================================================= */

const POS = {
  /* =====================================================
     INVOICE NUMBER
  ===================================================== */

  invoiceNumber: {
    left: 165,
    top: 21,
    width: 45,
  },

  invoiceDate: {
    left: 165,
    top: 28,
    width: 40,
  },

  /* =====================================================
     CUSTOMER
  ===================================================== */

  customerCode: {
    left: 28,
    top: 65,
    width: 45,
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
     SHIP TO
  ===================================================== */

  shipTo: {
    left: 160,
    top: 51,
    width: 57,
  },

  dueDateTop: {
    left: 160,
    top: 63,
    width: 38,
  },

  paymentTermTop: {
    left: 160,
    top: 74,
    width: 38,
  },

  /* =====================================================
     ตารางข้อมูลใต้ Customer

     สำคัญ:
     แต่ละช่องแยกออกจากกันชัดเจน
  ===================================================== */

  saleOrder: {
    left: 19,
    top: 97,
    width: 36,
  },

  paymentTerm: {
    left: 57,
    top: 97,
    width: 27,
  },

  dueDate: {
    left: 86,
    top: 97,
    width: 27,
  },

  poNumber: {
    left: 116,
    top: 97,
    width: 38,
  },

  saleName: {
    left: 157,
    top: 97,
    width: 30,
  },

  entryBy: {
    left: 190,
    top: 97,
    width: 28,
  },

  /* =====================================================
     ยอดรวม
  ===================================================== */

  subtotal: {
    left: 188,
    top: 205.5,
    width: 34,
  },

  vat: {
    left: 188,
    top: 216.5,
    width: 34,
  },

  grandTotal: {
    left: 188,
    top: 226,
    width: 34,
  },

  /* =====================================================
     จำนวนเงินเป็นตัวหนังสือ
  ===================================================== */

  amountInWords: {
    left: 28,
    top: 226,
    width: 155,
  },
};

/* =========================================================
   ตารางสินค้า
========================================================= */

const ITEM_START_TOP = 120;

const ITEM_ROW_HEIGHT = 7;

/* =========================================================
   COLUMN
========================================================= */

const COL = {
  itemNo: {
    left: 18,
    width: 10,
  },

  description: {
    left: 31,
    width: 83,
  },

  quantity: {
    left: 116,
    width: 14,
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

    /* ล้าน */

    if (num >= 1_000_000) {
      const millionPart =
        Math.floor(num / 1_000_000);

      result += convertNumber(millionPart);
      result += "ล้าน";

      num %= 1_000_000;
    }

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
        numbers[digit.value] +
        digit.unit;
    }

    return result;
  }

  let result = "";

  if (baht === 0) {
    result = "ศูนย์บาท";
  } else {
    result =
      convertNumber(baht) +
      "บาท";
  }

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
   TYPE
========================================================= */

type Box = {
  left: number;
  top: number;
  width: number;
};

/* =========================================================
   POSITION
========================================================= */

function pos(
  p: Box,
  extra: React.CSSProperties = {}
): React.CSSProperties {
  return {
    position: "absolute",

    left:
      `${p.left + OFFSET_X}mm`,

    top:
      `${p.top + OFFSET_Y}mm`,

    width:
      `${p.width}mm`,

    ...extra,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default async function InvoicePrintPage({
  params,
}: PageProps) {

  /* =====================================================
     LOGIN
  ===================================================== */

  const session =
    await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  /* =====================================================
     ID
  ===================================================== */

  const { id } = await params;

  /* =====================================================
     INVOICE
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
     AMOUNT IN WORDS
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

          font-size: 9.5pt;

          line-height: 1.15;

          color: #000;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: clip;

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
           FIELD TABLE

           ป้องกันข้อความข้ามช่อง
        ================================================= */

        .table-field {
          position: absolute;

          font-size: 8.5pt;

          line-height: 1.1;

          color: #000;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: clip;

          font-family:
            Arial,
            Tahoma,
            sans-serif;

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
           AMOUNT WORDS
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
          PAPER
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
            POS.customerCode,
            {
              fontSize: "9pt",
            }
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
            POS.customerName,
            {
              fontSize: "9.5pt",
            }
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

              lineHeight: "1.3",

              whiteSpace: "normal",

              fontSize: "9pt",
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

              fontSize: "8.5pt",

              whiteSpace: "normal",
            }
          )}
        >
          {invoice.shipToSnapshot ??
            ""}
        </div>

        {/* =================================================
            DUE DATE TOP
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.dueDateTop,
            {
              fontSize: "8.5pt",
            }
          )}
        >
          {formatDate(
            invoice.dueDate
          )}
        </div>

        {/* =================================================
            PAYMENT TERM TOP
        ================================================= */}

        <div
          className="field"
          style={pos(
            POS.paymentTermTop,
            {
              fontSize: "8.5pt",
            }
          )}
        >
          {invoice.paymentTerm ??
            ""}
        </div>

        {/* =================================================
            SALE ORDER
        ================================================= */}

        <div
          className="table-field"
          style={pos(
            POS.saleOrder,
            {
              textAlign: "center",
              paddingLeft: "1mm",
              paddingRight: "1mm",
            }
          )}
        >
          {invoice.saleOrderNumber ??
            ""}
        </div>

        {/* =================================================
            PAYMENT TERM
        ================================================= */}

        <div
          className="table-field"
          style={pos(
            POS.paymentTerm,
            {
              textAlign: "center",
              paddingLeft: "1mm",
              paddingRight: "1mm",
            }
          )}
        >
          {invoice.paymentTerm ??
            ""}
        </div>

        {/* =================================================
            DUE DATE
        ================================================= */}

        <div
          className="table-field"
          style={pos(
            POS.dueDate,
            {
              textAlign: "center",
              paddingLeft: "1mm",
              paddingRight: "1mm",
            }
          )}
        >
          {formatDate(
            invoice.dueDate
          )}
        </div>

        {/* =================================================
            PO NUMBER
        ================================================= */}

        <div
          className="table-field"
          style={pos(
            POS.poNumber,
            {
              textAlign: "center",
              paddingLeft: "1mm",
              paddingRight: "1mm",
            }
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
          className="table-field"
          style={pos(
            POS.saleName,
            {
              textAlign: "center",
              paddingLeft: "1mm",
              paddingRight: "1mm",
            }
          )}
        >
          {invoice.saleName ??
            ""}
        </div>

        {/* =================================================
            ENTRY BY
        ================================================= */}

        <div
          className="table-field"
          style={pos(
            POS.entryBy,
            {
              textAlign: "center",
              paddingLeft: "1mm",
              paddingRight: "1mm",
            }
          )}
        >
          {invoice.entryBy ??
            ""}
        </div>

        {/* =================================================
            ITEMS
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

                {/* ITEM NO */}

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