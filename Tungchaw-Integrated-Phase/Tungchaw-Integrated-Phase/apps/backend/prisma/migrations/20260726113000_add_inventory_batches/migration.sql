CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourcePurchaseItemId" TEXT,
    "batchNumber" TEXT,
    "manufacturedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "receivedQuantity" DECIMAL(18,3) NOT NULL,
    "currentQuantity" DECIMAL(18,3) NOT NULL,
    "reservedQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBatchAllocation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryBatchAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryBatch_branchId_sourcePurchaseItemId_key" ON "InventoryBatch"("branchId", "sourcePurchaseItemId");
CREATE INDEX "InventoryBatch_businessId_idx" ON "InventoryBatch"("businessId");
CREATE INDEX "InventoryBatch_branchId_idx" ON "InventoryBatch"("branchId");
CREATE INDEX "InventoryBatch_productId_idx" ON "InventoryBatch"("productId");
CREATE INDEX "InventoryBatch_sourcePurchaseItemId_idx" ON "InventoryBatch"("sourcePurchaseItemId");
CREATE INDEX "InventoryBatch_businessId_branchId_productId_idx" ON "InventoryBatch"("businessId", "branchId", "productId");
CREATE INDEX "InventoryBatch_businessId_expiryDate_idx" ON "InventoryBatch"("businessId", "expiryDate");
CREATE INDEX "InventoryBatch_branchId_productId_expiryDate_idx" ON "InventoryBatch"("branchId", "productId", "expiryDate");
CREATE INDEX "InventoryBatch_batchNumber_idx" ON "InventoryBatch"("batchNumber");
CREATE INDEX "InventoryBatch_currentQuantity_idx" ON "InventoryBatch"("currentQuantity");
CREATE UNIQUE INDEX "InventoryBatchAllocation_batchId_saleItemId_key" ON "InventoryBatchAllocation"("batchId", "saleItemId");
CREATE INDEX "InventoryBatchAllocation_batchId_idx" ON "InventoryBatchAllocation"("batchId");
CREATE INDEX "InventoryBatchAllocation_saleItemId_idx" ON "InventoryBatchAllocation"("saleItemId");

ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_sourcePurchaseItemId_fkey" FOREIGN KEY ("sourcePurchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryBatchAllocation" ADD CONSTRAINT "InventoryBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBatchAllocation" ADD CONSTRAINT "InventoryBatchAllocation_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing aggregate stock as non-expiring legacy batches.
-- This prevents existing installations from becoming unable to sell stock after the migration.
INSERT INTO "InventoryBatch" (
  "id", "businessId", "branchId", "productId", "sourcePurchaseItemId",
  "batchNumber", "receivedQuantity", "currentQuantity", "reservedQuantity",
  "unitCost", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, bs."businessId", bs."branchId", bs."productId", NULL,
  'LEGACY', bs."quantity", bs."quantity", 0, p."costPrice", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BranchStock" bs
JOIN "Product" p ON p."id" = bs."productId"
WHERE bs."quantity" > 0;
