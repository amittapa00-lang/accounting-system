-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "plant" TEXT,
    "poDate" DATETIME NOT NULL,
    "deliveryDate" DATETIME,
    "deliveryPlace" TEXT,
    "billPlacement" TEXT,
    "paymentTerm" TEXT,
    "quotationNumber" TEXT,
    "quotationDate" DATETIME,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactMobile" TEXT,
    "acceptanceCondition" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
