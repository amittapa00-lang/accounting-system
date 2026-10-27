-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "customerCodeSnapshot" TEXT,
    "customerNameSnapshot" TEXT NOT NULL,
    "customerAddressSnapshot" TEXT,
    "customerTaxIdSnapshot" TEXT,
    "shipToSnapshot" TEXT,
    "dueDate" DATETIME,
    "paymentTerm" TEXT,
    "saleOrderNumber" TEXT,
    "saleName" TEXT,
    "entryBy" TEXT,
    "purchaseOrderId" TEXT NOT NULL,
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "vat" DECIMAL NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemNo" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL NOT NULL,
    "discountPercent" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
