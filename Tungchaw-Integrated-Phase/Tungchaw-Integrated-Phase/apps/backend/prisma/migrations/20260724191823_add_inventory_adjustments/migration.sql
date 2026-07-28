-- CreateEnum
CREATE TYPE "InventoryAdjustmentType" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentReason" AS ENUM ('DAMAGE', 'EXPIRED', 'LOST', 'THEFT', 'COUNT_CORRECTION', 'INITIAL_STOCK', 'INTERNAL_USE', 'SAMPLE', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "adjustmentNumber" TEXT NOT NULL,
    "adjustmentDate" TIMESTAMP(3) NOT NULL,
    "type" "InventoryAdjustmentType" NOT NULL,
    "reason" "InventoryAdjustmentReason" NOT NULL,
    "status" "InventoryAdjustmentStatus" NOT NULL DEFAULT 'COMPLETED',
    "totalQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAdjustmentItem" (
    "id" TEXT NOT NULL,
    "inventoryAdjustmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "quantityBefore" DECIMAL(18,3) NOT NULL,
    "quantityAfter" DECIMAL(18,3) NOT NULL,
    "itemReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAdjustmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryAdjustment_businessId_idx" ON "InventoryAdjustment"("businessId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_branchId_idx" ON "InventoryAdjustment"("branchId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_createdById_idx" ON "InventoryAdjustment"("createdById");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_cancelledById_idx" ON "InventoryAdjustment"("cancelledById");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_businessId_status_idx" ON "InventoryAdjustment"("businessId", "status");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_businessId_type_idx" ON "InventoryAdjustment"("businessId", "type");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_businessId_reason_idx" ON "InventoryAdjustment"("businessId", "reason");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_businessId_adjustmentDate_idx" ON "InventoryAdjustment"("businessId", "adjustmentDate");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_businessId_branchId_adjustmentDate_idx" ON "InventoryAdjustment"("businessId", "branchId", "adjustmentDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAdjustment_businessId_adjustmentNumber_key" ON "InventoryAdjustment"("businessId", "adjustmentNumber");

-- CreateIndex
CREATE INDEX "InventoryAdjustmentItem_inventoryAdjustmentId_idx" ON "InventoryAdjustmentItem"("inventoryAdjustmentId");

-- CreateIndex
CREATE INDEX "InventoryAdjustmentItem_productId_idx" ON "InventoryAdjustmentItem"("productId");

-- CreateIndex
CREATE INDEX "InventoryAdjustmentItem_inventoryAdjustmentId_productId_idx" ON "InventoryAdjustmentItem"("inventoryAdjustmentId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAdjustmentItem_inventoryAdjustmentId_lineNumber_key" ON "InventoryAdjustmentItem"("inventoryAdjustmentId", "lineNumber");

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustmentItem" ADD CONSTRAINT "InventoryAdjustmentItem_inventoryAdjustmentId_fkey" FOREIGN KEY ("inventoryAdjustmentId") REFERENCES "InventoryAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustmentItem" ADD CONSTRAINT "InventoryAdjustmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
