import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import authOptions from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";

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

export default async function CalibrationPage({
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
    },
  });

  if (!invoice) {
    notFound();
  }

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          background: #d1d5db;
          font-family: Arial, Tahoma, sans-serif;
        }

        .toolbar {
          position: sticky;
          top: 0;
          z-index: 100;

          padding: 12px 20px;

          background: #111827;
          color: white;

          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .toolbar-title {
          font-size: 16px;
          font-weight: 700;
        }

        .toolbar-info {
          font-size: 13px;
          opacity: 0.8;
        }

        .canvas {
          padding: 30px;
          overflow: auto;
        }

        .paper {
          position: relative;

          width: 9in;
          height: 5.5in;

          margin: 0 auto;

          background: white;

          overflow: hidden;

          border: 1px solid #999;

          box-shadow:
            0 10px 30px rgba(0, 0, 0, 0.2);

          /*
            PRINT OFFSET

            +2mm = เลื่อนไปทางขวา 2 mm
            -2mm = เลื่อนไปทางซ้าย 2 mm

            +2mm = เลื่อนลง 2 mm
            -2mm = เลื่อนขึ้น 2 mm
          */

          --offset-x: 0mm;
          --offset-y: 0mm;
        }

        /*
          แบบฟอร์มโรงพิมพ์
          ใช้สำหรับเทียบตำแหน่งเท่านั้น
        */

        .form-background {
          position: absolute;

          left: 0;
          top: 0;

          width: 100%;
          height: 100%;

          object-fit: contain;
          object-position: top center;

          pointer-events: none;

          opacity: 0.75;
        }

        /*
          ข้อมูลจากระบบ
        */

        .data {
          position: absolute;

          z-index: 10;

          color: red;

          font-size: 10pt;

          line-height: 1.2;

          white-space: nowrap;

          pointer-events: none;
        }

        .wrap {
          white-space: normal;
        }

        .right {
          text-align: right;
        }

        .center {
          text-align: center;
        }

        /*
          จุดเริ่มต้น
        */

        .origin {
          position: absolute;

          left: 0;
          top: 0;

          width: 10px;
          height: 10px;

          background: red;

          z-index: 50;
        }

        /*
          เส้นกลางแนวตั้ง
        */

        .center-line-x {
          position: absolute;

          left: 50%;
          top: 0;

          width: 1px;
          height: 100%;

          background: rgba(255, 0, 0, 0.25);

          z-index: 40;
        }

        /*
          Grid ทุก 10mm
        */

        .ruler-x {
          position: absolute;

          left: 0;
          top: 0;

          width: 100%;
          height: 100%;

          pointer-events: none;

          z-index: 35;

          background-image:
            linear-gradient(
              to right,
              rgba(255, 0, 0, 0.12) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(255, 0, 0, 0.12) 1px,
              transparent 1px
            );

          background-size:
            10mm 10mm;
        }

        /*
          เส้นกลางแนวนอน
        */

        .center-line-y {
          position: absolute;

          left: 0;
          top: 50%;

          width: 100%;
          height: 1px;

          background: rgba(255, 0, 0, 0.25);

          z-index: 40;
        }

        /*
          PRINT
        */

        @media print {
          .toolbar {
            display: none;
          }

          .form-background {
            display: none;
          }

          .origin,
          .ruler-x,
          .center-line-x,
          .center-line-y {
            display: none;
          }

          .data {
            color: black;
          }

          .paper {
            width: 9in;
            height: 5.5in;

            margin: 0;

            box-shadow: none;

            border: none;
          }

          .canvas {
            padding: 0;
          }

          @page {
            size: 9in 5.5in;
            margin: 0;
          }
        }
      `}</style>

      {/* =========================================
          TOOLBAR
      ========================================= */}

      <div className="toolbar">
        <div>
          <div className="toolbar-title">
            Invoice Print Calibration
          </div>

          <div className="toolbar-info">
            สีแดง = ข้อมูลจากระบบ
          </div>
        </div>

        <div>
          9 × 11 inch
        </div>
      </div>

      <div className="canvas">
        <div className="paper">

          {/* =========================================
              FORM BACKGROUND
          ========================================= */}

                    {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/forms/invoice-original.png"
            alt="Invoice Form"
            className="form-background"
          />

          {/* =========================================
              CALIBRATION GUIDES
          ========================================= */}

          <div className="origin" />

          <div className="ruler-x" />

          <div className="center-line-x" />

          <div className="center-line-y" />

          {/* =========================================
              INVOICE NUMBER
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(141.3mm + var(--offset-x))",
              top: "calc(8mm + var(--offset-y))",
            }}
          >
            {invoice.invoiceNumber}
          </div>

          {/* =========================================
              DATE
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(141.3mm + var(--offset-x))",
              top: "calc(12mm + var(--offset-y))",
            }}
          >
            {formatDate(invoice.invoiceDate)}
          </div>

          {/* =========================================
              CUSTOMER CODE
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(43.2mm + var(--offset-x))",
              top: "calc(26.5mm + var(--offset-y))",
            }}
          >
            {invoice.customerCodeSnapshot ?? ""}
          </div>

          {/* =========================================
              CUSTOMER NAME
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(51.3mm + var(--offset-x))",
              top: "calc(30mm + var(--offset-y))",
            }}
          >
            {invoice.customerNameSnapshot}
          </div>

          {/* =========================================
              CUSTOMER ADDRESS
          ========================================= */}

          <div
            className="data wrap"
            style={{
              left: "calc(18mm + var(--offset-x))",
              top: "calc(33.5mm + var(--offset-y))",
              width: "117mm",
            }}
          >
            {invoice.customerAddressSnapshot ?? ""}
          </div>

          {/* =========================================
              SHIP TO
          ========================================= */}

          <div
            className="data wrap"
            style={{
              left: "calc(144mm + var(--offset-x))",
              top: "calc(26.5mm + var(--offset-y))",
              width: "54mm",
            }}
          >
            {invoice.shipToSnapshot ?? ""}
          </div>

          {/* =========================================
              DUE DATE
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(144mm + var(--offset-x))",
              top: "calc(33mm + var(--offset-y))",
            }}
          >
            {formatDate(invoice.dueDate)}
          </div>

          {/* =========================================
              PAYMENT TERM
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(144mm + var(--offset-x))",
              top: "calc(39mm + var(--offset-y))",
            }}
          >
            {invoice.paymentTerm ?? ""}
          </div>

          {/* =========================================
              SALE ORDER
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(20.7mm + var(--offset-x))",
              top: "calc(45.5mm + var(--offset-y))",
            }}
          >
            {invoice.saleOrderNumber ?? ""}
          </div>

          {/* =========================================
              PURCHASE ORDER
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(101.7mm + var(--offset-x))",
              top: "calc(45.5mm + var(--offset-y))",
            }}
          >
            {invoice.purchaseOrder.poNumber}
          </div>

          {/* =========================================
              SALE NAME
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(142.2mm + var(--offset-x))",
              top: "calc(45.5mm + var(--offset-y))",
            }}
          >
            {invoice.saleName ?? ""}
          </div>

          {/* =========================================
              ENTRY BY
          ========================================= */}

          <div
            className="data"
            style={{
              left: "calc(172.8mm + var(--offset-x))",
              top: "calc(45.5mm + var(--offset-y))",
            }}
          >
            {invoice.entryBy ?? ""}
          </div>

          {/* =========================================
              ITEMS
          ========================================= */}

          {invoice.items.map((item, index) => {
            const top = 51.5 + index * 4;

            return (
              <div key={item.id}>

                {/* ITEM NO. */}

                <div
                  className="data center"
                  style={{
                    left: "calc(20.7mm + var(--offset-x))",
                    top: `calc(${top}mm + var(--offset-y))`,
                    width: "10.8mm",
                  }}
                >
                  {item.itemNo}
                </div>

                {/* DESCRIPTION */}

                <div
                  className="data wrap"
                  style={{
                    left: "calc(33.3mm + var(--offset-x))",
                    top: `calc(${top}mm + var(--offset-y))`,
                    width: "79.2mm",
                  }}
                >
                  {item.description}
                </div>

                {/* QUANTITY */}

                <div
                  className="data right"
                  style={{
                    left: "calc(115.2mm + var(--offset-x))",
                    top: `calc(${top}mm + var(--offset-y))`,
                    width: "15.3mm",
                  }}
                >
                  {Number(item.quantity).toLocaleString("en-US")}
                </div>

                {/* UNIT PRICE */}

                <div
                  className="data right"
                  style={{
                    left: "calc(141.3mm + var(--offset-x))",
                    top: `calc(${top}mm + var(--offset-y))`,
                    width: "24.3mm",
                  }}
                >
                  {formatMoney(item.unitPrice)}
                </div>

                {/* DISCOUNT */}

                <div
                  className="data right"
                  style={{
                    left: "calc(171mm + var(--offset-x))",
                    top: `calc(${top}mm + var(--offset-y))`,
                    width: "25.2mm",
                  }}
                >
                  {Number(item.discountPercent) > 0
                    ? `${Number(
                        item.discountPercent
                      ).toLocaleString("en-US")}%`
                    : ""}
                </div>

                {/* AMOUNT */}

                <div
                  className="data right"
                  style={{
                    left: "calc(196.2mm + var(--offset-x))",
                    top: `calc(${top}mm + var(--offset-y))`,
                    width: "25.2mm",
                  }}
                >
                  {formatMoney(item.amount)}
                </div>

              </div>
            );
          })}

          {/* =========================================
              SUB TOTAL
          ========================================= */}

          <div
  className="data right"
  style={{
    left: "calc(196.2mm + var(--offset-x))",
    top: "calc(127.5mm + var(--offset-y))",
    width: "27mm",
  }}
>
  {formatMoney(invoice.vat)}
</div>

          {/* =========================================
              VAT
          ========================================= */}

         <div
  className="data right"
  style={{
    left: "calc(196.2mm + var(--offset-x))",
    top: "calc(132mm + var(--offset-y))",
    width: "27mm",
  }}
>
  {formatMoney(invoice.grandTotal)}
</div>

          {/* =========================================
              GRAND TOTAL
          ========================================= */}

          <div
            className="data right"
            style={{
              left: "calc(196.2mm + var(--offset-x))",
              top: "calc(132mm + var(--offset-y))",
              width: "27mm",
            }}
          >
            {formatMoney(invoice.grandTotal)}
          </div>

        </div>
      </div>
    </>
  );
}
