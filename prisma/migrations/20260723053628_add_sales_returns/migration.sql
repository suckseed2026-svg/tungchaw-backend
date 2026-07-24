-- CreateEnum
CREATE TYPE "SaleReturnStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleReturnItemCondition" AS ENUM ('RESTOCKABLE', 'DAMAGED', 'EXPIRED', 'OTHER');

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "returnNumber" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "status" "SaleReturnStatus" NOT NULL DEFAULT 'COMPLETED',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "profitImpact" DECIMAL(18,2) NOT NULL DEFAULT 0,
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

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturnItem" (
    "id" TEXT NOT NULL,
    "saleReturnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "lineCost" DECIMAL(18,2) NOT NULL,
    "profitImpact" DECIMAL(18,2) NOT NULL,
    "condition" "SaleReturnItemCondition" NOT NULL DEFAULT 'RESTOCKABLE',
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "itemReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleReturn_businessId_idx" ON "SaleReturn"("businessId");

-- CreateIndex
CREATE INDEX "SaleReturn_branchId_idx" ON "SaleReturn"("branchId");

-- CreateIndex
CREATE INDEX "SaleReturn_saleId_idx" ON "SaleReturn"("saleId");

-- CreateIndex
CREATE INDEX "SaleReturn_customerId_idx" ON "SaleReturn"("customerId");

-- CreateIndex
CREATE INDEX "SaleReturn_createdById_idx" ON "SaleReturn"("createdById");

-- CreateIndex
CREATE INDEX "SaleReturn_cancelledById_idx" ON "SaleReturn"("cancelledById");

-- CreateIndex
CREATE INDEX "SaleReturn_businessId_status_idx" ON "SaleReturn"("businessId", "status");

-- CreateIndex
CREATE INDEX "SaleReturn_businessId_returnDate_idx" ON "SaleReturn"("businessId", "returnDate");

-- CreateIndex
CREATE INDEX "SaleReturn_businessId_branchId_returnDate_idx" ON "SaleReturn"("businessId", "branchId", "returnDate");

-- CreateIndex
CREATE INDEX "SaleReturn_businessId_customerId_returnDate_idx" ON "SaleReturn"("businessId", "customerId", "returnDate");

-- CreateIndex
CREATE INDEX "SaleReturn_saleId_status_idx" ON "SaleReturn"("saleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_businessId_returnNumber_key" ON "SaleReturn"("businessId", "returnNumber");

-- CreateIndex
CREATE INDEX "SaleReturnItem_saleReturnId_idx" ON "SaleReturnItem"("saleReturnId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_saleItemId_idx" ON "SaleReturnItem"("saleItemId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_productId_idx" ON "SaleReturnItem"("productId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_saleReturnId_productId_idx" ON "SaleReturnItem"("saleReturnId", "productId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_saleItemId_saleReturnId_idx" ON "SaleReturnItem"("saleItemId", "saleReturnId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturnItem_saleReturnId_lineNumber_key" ON "SaleReturnItem"("saleReturnId", "lineNumber");

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
