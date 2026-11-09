-- DropIndex
DROP INDEX "Invoice_invoiceNumber_key";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billDiscount" DECIMAL(14,4) NOT NULL DEFAULT 0,
ADD COLUMN     "billDiscountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "billDiscountType" TEXT NOT NULL DEFAULT 'AMOUNT',
ADD COLUMN     "note" TEXT,
ADD COLUMN     "subNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "lineType" TEXT NOT NULL DEFAULT 'ITEM',
ADD COLUMN     "purchaseOrderItemId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "lineType" TEXT NOT NULL DEFAULT 'ITEM';

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_subNumber_key" ON "Invoice"("invoiceNumber", "subNumber");

-- CreateIndex
CREATE INDEX "InvoiceItem_purchaseOrderItemId_idx" ON "InvoiceItem"("purchaseOrderItemId");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Link existing invoice lines to the PO lines they were copied from. Before this change an
-- invoice was a full copy of its PO, line by line, so itemNo matches. This makes the
-- "still to bill" quantities of older POs correct.
UPDATE "InvoiceItem" ii
SET "purchaseOrderItemId" = poi.id
FROM "Invoice" i
JOIN "PurchaseOrderItem" poi ON poi."purchaseOrderId" = i."purchaseOrderId"
WHERE ii."invoiceId" = i.id
  AND poi."itemNo" = ii."itemNo"
  AND ii."purchaseOrderItemId" IS NULL;
