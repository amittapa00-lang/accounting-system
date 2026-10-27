-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemNo" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL NOT NULL,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
    "vat" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrderItem" ("amount", "createdAt", "description", "discount", "id", "itemNo", "purchaseOrderId", "quantity", "unit", "unitPrice", "updatedAt", "vat") SELECT "amount", "createdAt", "description", "discount", "id", "itemNo", "purchaseOrderId", "quantity", "unit", "unitPrice", "updatedAt", "vat" FROM "PurchaseOrderItem";
DROP TABLE "PurchaseOrderItem";
ALTER TABLE "new_PurchaseOrderItem" RENAME TO "PurchaseOrderItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
