/*
  Warnings:

  - You are about to alter the column `subtotal` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `vat` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `grandTotal` on the `Invoice` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - `InvoiceItem.discountPercent` is renamed to `discount` (hand-edited below, no data loss).
  - Casting to DECIMAL(14,2) rounds existing amounts to satang (half away from zero).
  - You are about to alter the column `quantity` on the `InvoiceItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - You are about to alter the column `unitPrice` on the `InvoiceItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - You are about to alter the column `amount` on the `InvoiceItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.
  - You are about to alter the column `quantity` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - You are about to alter the column `unitPrice` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - You are about to alter the column `discount` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,4)`.
  - You are about to alter the column `vat` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(5,2)`.
  - You are about to alter the column `amount` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(14,2)`.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "vat" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "grandTotal" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
-- Hand-edited: rename instead of drop + add so existing percentage discounts are kept.
-- Every existing row is a percentage discount (AMOUNT discounts used to be stored as 0).
ALTER TABLE "InvoiceItem" RENAME COLUMN "discountPercent" TO "discount";

ALTER TABLE "InvoiceItem" ALTER COLUMN "discount" SET DATA TYPE DECIMAL(14,4),
ADD COLUMN     "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "vat" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "Invoice_purchaseOrderId_idx" ON "Invoice"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_customerId_idx" ON "PurchaseOrder"("customerId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_poDate_idx" ON "PurchaseOrder"("poDate");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
