-- CreateEnum
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "returnNumber" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refundAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditAdjustmentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refundMethod" "PaymentMethod",
    "referenceNumber" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnItem" (
    "id" TEXT NOT NULL,
    "purchaseReturnId" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "itemReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseReturn_businessId_idx" ON "PurchaseReturn"("businessId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_branchId_idx" ON "PurchaseReturn"("branchId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_purchaseId_idx" ON "PurchaseReturn"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_supplierId_idx" ON "PurchaseReturn"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_createdById_idx" ON "PurchaseReturn"("createdById");

-- CreateIndex
CREATE INDEX "PurchaseReturn_cancelledById_idx" ON "PurchaseReturn"("cancelledById");

-- CreateIndex
CREATE INDEX "PurchaseReturn_businessId_status_idx" ON "PurchaseReturn"("businessId", "status");

-- CreateIndex
CREATE INDEX "PurchaseReturn_businessId_returnDate_idx" ON "PurchaseReturn"("businessId", "returnDate");

-- CreateIndex
CREATE INDEX "PurchaseReturn_businessId_branchId_returnDate_idx" ON "PurchaseReturn"("businessId", "branchId", "returnDate");

-- CreateIndex
CREATE INDEX "PurchaseReturn_businessId_supplierId_returnDate_idx" ON "PurchaseReturn"("businessId", "supplierId", "returnDate");

-- CreateIndex
CREATE INDEX "PurchaseReturn_purchaseId_status_idx" ON "PurchaseReturn"("purchaseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_businessId_returnNumber_key" ON "PurchaseReturn"("businessId", "returnNumber");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_purchaseReturnId_idx" ON "PurchaseReturnItem"("purchaseReturnId");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_purchaseItemId_idx" ON "PurchaseReturnItem"("purchaseItemId");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_productId_idx" ON "PurchaseReturnItem"("productId");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_purchaseReturnId_productId_idx" ON "PurchaseReturnItem"("purchaseReturnId", "productId");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_purchaseItemId_purchaseReturnId_idx" ON "PurchaseReturnItem"("purchaseItemId", "purchaseReturnId");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_batchNumber_idx" ON "PurchaseReturnItem"("batchNumber");

-- CreateIndex
CREATE INDEX "PurchaseReturnItem_expiryDate_idx" ON "PurchaseReturnItem"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturnItem_purchaseReturnId_lineNumber_key" ON "PurchaseReturnItem"("purchaseReturnId", "lineNumber");

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
