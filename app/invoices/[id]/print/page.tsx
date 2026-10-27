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

function formatMoney(value: unknown) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";

  return new Date(value).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function InvoicePrintPage({
  params,
}: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

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

  return (
    <>
      <style>{`
        @page {
          size: 9in 11in;
          margin: 0;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        body {
          background: #e5e7eb;
          font-family: Arial, "Tahoma", sans-serif;
        }

        /* =========================================
           PRINT BUTTON
        ========================================= */

        .print-toolbar {
          width: 100%;
          padding: 16px;
          background: white;
          border-bottom: 1px solid #d1d5db;

          display: flex;
          justify-content: center;
        }

        /* =========================================
           9 x 11 INCH PAPER
        ========================================= */

        .print-page {
          position: relative;

          width: 9in;
          height: 11in;

          margin: 20px auto;

          background: white;

          overflow: hidden;
        }

        /* =========================================
           TEXT FIELD
        ========================================= */

        .field {
          position: absolute;

          font-size: 10pt;
          line-height: 1.2;

          color: #000;

          white-space: nowrap;
        }

        .field.wrap {
          white-space: normal;
        }

        .field.right {
          transform: translateX(-100%);
        }

        .field.center {
          transform: translateX(-50%);
        }

        /* =========================================
           ITEM
           รอบต่อไปเราจะจัดละเอียด
        ========================================= */

        .item {
          position: absolute;

          font-size: 9.5pt;
          line-height: 1.2;

          color: #000;
        }

        /* =========================================
           PRINT
        ========================================= */

        @media print {
          html,
          body {
            width: 9in;
            height: 11in;

            margin: 0;
            padding: 0;

            background: white;
          }

          .print-toolbar {
            display: none !important;
          }

          .print-page {
            width: 9in;
            height: 11in;

            margin: 0;

            background: white;

            page-break-after: always;
          }
        }
      `}</style>

      {/* =========================================
          PRINT BUTTON
      ========================================= */}

      <div className="print-toolbar">
        <PrintButton />
      </div>

      {/* =========================================
          PAPER
          9 x 11 INCH
      ========================================= */}

      <div className="print-page">

        {/* =====================================================
            1. INVOICE NUMBER
            ฟอร์มจริง: ช่องเลขที่ด้านขวาบน
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "157mm",
            top: "16mm",
          }}
        >
          {invoice.invoiceNumber}
        </div>

        {/* =====================================================
            2. INVOICE DATE
            ฟอร์มจริง: ใต้เลขที่
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "157mm",
            top: "24mm",
          }}
        >
          {formatDate(invoice.invoiceDate)}
        </div>

        {/* =====================================================
            3. CUSTOMER CODE
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "48mm",
            top: "53mm",
          }}
        >
          {invoice.customerCodeSnapshot ?? ""}
        </div>

        {/* =====================================================
            4. CUSTOMER NAME
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "57mm",
            top: "60mm",
            width: "105mm",
          }}
        >
          {invoice.customerNameSnapshot}
        </div>

        {/* =====================================================
            5. CUSTOMER ADDRESS
        ====================================================== */}

        <div
          className="field wrap"
          style={{
            left: "20mm",
            top: "67mm",
            width: "130mm",
          }}
        >
          {invoice.customerAddressSnapshot ?? ""}
        </div>

        {/* =====================================================
            6. SHIP TO
        ====================================================== */}

        <div
          className="field wrap"
          style={{
            left: "160mm",
            top: "53mm",
            width: "62mm",
          }}
        >
          {invoice.shipToSnapshot ?? ""}
        </div>

        {/* =====================================================
            7. DUE DATE
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "160mm",
            top: "66mm",
          }}
        >
          {formatDate(invoice.dueDate)}
        </div>

        {/* =====================================================
            8. TERM OF PAYMENT
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "160mm",
            top: "78mm",
          }}
        >
          {invoice.paymentTerm ?? ""}
        </div>

        {/* =====================================================
            9. PURCHASE ORDER NO.
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "113mm",
            top: "91mm",
          }}
        >
          {invoice.purchaseOrder.poNumber}
        </div>

        {/* =====================================================
            SALE ORDER NO.
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "23mm",
            top: "91mm",
            width: "38mm",
          }}
        >
          {invoice.saleOrderNumber ?? ""}
        </div>

        {/* =====================================================
            TERM OF PAYMENT
            ช่องตารางด้านล่าง
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "65mm",
            top: "91mm",
            width: "32mm",
          }}
        >
          {invoice.paymentTerm ?? ""}
        </div>

        {/* =====================================================
            DUE DATE
            ช่องตารางด้านล่าง
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "91mm",
            top: "91mm",
            width: "28mm",
          }}
        >
          {formatDate(invoice.dueDate)}
        </div>

        {/* =====================================================
            SALE NAME
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "158mm",
            top: "91mm",
            width: "30mm",
          }}
        >
          {invoice.saleName ?? ""}
        </div>

        {/* =====================================================
            ENTRY BY
        ====================================================== */}

        <div
          className="field"
          style={{
            left: "192mm",
            top: "91mm",
            width: "27mm",
          }}
        >
          {invoice.entryBy ?? ""}
        </div>

        {/* =====================================================
    ITEMS
    ตารางจริงของฟอร์ม
====================================================== */}

{invoice.items.map((item, index) => {
  /*
    จุดเริ่มต้นของแถวรายการ

    ฟอร์มจริง:
    - หัวตารางอยู่ประมาณ 100 mm
    - แต่ละรายการห่างกันประมาณ 8 mm

    ค่านี้เป็นค่าเริ่มต้น
    เดี๋ยวเราจะปรับจากกระดาษจริง
  */

  const topPosition = 103 + index * 8;

  return (
    <div key={item.id}>

      {/* ==========================================
          ITEM NO.
          คอลัมน์ ลำดับ
      ========================================== */}

      <div
        className="item"
        style={{
          left: "23mm",
          top: `${topPosition}mm`,
          width: "12mm",
          textAlign: "center",
        }}
      >
        {item.itemNo}
      </div>


      {/* ==========================================
          DESCRIPTION
          คอลัมน์ รายการ
      ========================================== */}

      <div
        className="item"
        style={{
          left: "37mm",
          top: `${topPosition}mm`,
          width: "88mm",
          whiteSpace: "normal",
          overflow: "hidden",
        }}
      >
        {item.description}
      </div>


      {/* ==========================================
          QTY
          คอลัมน์ จำนวน
      ========================================== */}

      <div
        className="item"
        style={{
          left: "128mm",
          top: `${topPosition}mm`,
          width: "17mm",
          textAlign: "right",
        }}
      >
        {Number(item.quantity).toLocaleString("en-US")}
      </div>


      {/* ==========================================
          UNIT PRICE
          คอลัมน์ ราคาต่อหน่วย
      ========================================== */}

      <div
        className="item"
        style={{
          left: "157mm",
          top: `${topPosition}mm`,
          width: "27mm",
          textAlign: "right",
        }}
      >
        {formatMoney(item.unitPrice)}
      </div>


      {/* ==========================================
          DISCOUNT
          คอลัมน์ ส่วนลด
      ========================================== */}

      <div
        className="item"
        style={{
          left: "190mm",
          top: `${topPosition}mm`,
          width: "28mm",
          textAlign: "right",
        }}
      >
        {item.discountPercent
          ? `${Number(item.discountPercent).toLocaleString(
              "en-US"
            )}%`
          : ""}
      </div>


      {/* ==========================================
          AMOUNT
          คอลัมน์ จำนวนเงิน
      ========================================== */}

      <div
        className="item"
        style={{
          left: "218mm",
          top: `${topPosition}mm`,
          width: "28mm",
          textAlign: "right",
        }}
      >
        {formatMoney(item.amount)}
      </div>

    </div>
  );
})}

       {/* =====================================================
    TOTALS
    Sub Total / V.A.T. / Grand Total
====================================================== */}

{/* =========================
    SUB TOTAL
========================= */}

<div
  className="field right"
  style={{
    left: "218mm",
    top: "247mm",
    width: "30mm",
    textAlign: "right",
  }}
>
  {formatMoney(invoice.subtotal)}
</div>


{/* =========================
    V.A.T.
========================= */}

<div
  className="field right"
  style={{
    left: "218mm",
    top: "255mm",
    width: "30mm",
    textAlign: "right",
  }}
>
  {formatMoney(invoice.vat)}
</div>


{/* =========================
    GRAND TOTAL
========================= */}

<div
  className="field right"
  style={{
    left: "218mm",
    top: "264mm",
    width: "30mm",
    textAlign: "right",
  }}
>
  {formatMoney(invoice.grandTotal)}
</div>
      </div>
    </>
  );
}