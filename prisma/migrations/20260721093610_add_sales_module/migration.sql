/*
  Warnings:

  - You are about to drop the column `city` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `gstNumber` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `photoUrl` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Customer` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalePaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "SaleSource" AS ENUM ('POS', 'MOBILE', 'WEB', 'PHONE_ORDER', 'WHATSAPP_ORDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SaleActivityType" AS ENUM ('CREATED', 'UPDATED', 'ITEM_ADDED', 'ITEM_REMOVED', 'CUSTOMER_SELECTED', 'CUSTOMER_REMOVED', 'DISCOUNT_APPLIED', 'DISCOUNT_APPROVED', 'PRICE_OVERRIDDEN', 'PRICE_OVERRIDE_APPROVED', 'PAYMENT_ADDED', 'COMPLETED', 'CANCELLED', 'RECEIPT_PRINTED', 'RECEIPT_SHARED');

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "gstNumber",
DROP COLUMN "photoUrl",
DROP COLUMN "state";

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "saleNumber" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "SalePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "source" "SaleSource" NOT NULL DEFAULT 'POS',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "itemDiscountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "billDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "changeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "barcode" TEXT,
    "unitName" TEXT NOT NULL,
    "brandName" TEXT,
    "categoryName" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "freeQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "originalUnitPrice" DECIMAL(18,2) NOT NULL,
    "finalUnitPrice" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "lineCost" DECIMAL(18,2) NOT NULL,
    "lineProfit" DECIMAL(18,2) NOT NULL,
    "priceOverrideReason" TEXT,
    "priceApprovedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "tenderedAmount" DECIMAL(18,2),
    "changeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleActivity" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "SaleActivityType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_businessId_idx" ON "Sale"("businessId");

-- CreateIndex
CREATE INDEX "Sale_branchId_idx" ON "Sale"("branchId");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_createdById_idx" ON "Sale"("createdById");

-- CreateIndex
CREATE INDEX "Sale_cancelledById_idx" ON "Sale"("cancelledById");

-- CreateIndex
CREATE INDEX "Sale_businessId_status_idx" ON "Sale"("businessId", "status");

-- CreateIndex
CREATE INDEX "Sale_businessId_paymentStatus_idx" ON "Sale"("businessId", "paymentStatus");

-- CreateIndex
CREATE INDEX "Sale_businessId_saleDate_idx" ON "Sale"("businessId", "saleDate");

-- CreateIndex
CREATE INDEX "Sale_businessId_branchId_saleDate_idx" ON "Sale"("businessId", "branchId", "saleDate");

-- CreateIndex
CREATE INDEX "Sale_businessId_customerId_saleDate_idx" ON "Sale"("businessId", "customerId", "saleDate");

-- CreateIndex
CREATE INDEX "Sale_businessId_createdById_saleDate_idx" ON "Sale"("businessId", "createdById", "saleDate");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_businessId_saleNumber_key" ON "Sale"("businessId", "saleNumber");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SaleItem_priceApprovedById_idx" ON "SaleItem"("priceApprovedById");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_productId_idx" ON "SaleItem"("saleId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_saleId_lineNumber_key" ON "SaleItem"("saleId", "lineNumber");

-- CreateIndex
CREATE INDEX "SalePayment_businessId_idx" ON "SalePayment"("businessId");

-- CreateIndex
CREATE INDEX "SalePayment_saleId_idx" ON "SalePayment"("saleId");

-- CreateIndex
CREATE INDEX "SalePayment_branchId_idx" ON "SalePayment"("branchId");

-- CreateIndex
CREATE INDEX "SalePayment_createdById_idx" ON "SalePayment"("createdById");

-- CreateIndex
CREATE INDEX "SalePayment_businessId_paymentDate_idx" ON "SalePayment"("businessId", "paymentDate");

-- CreateIndex
CREATE INDEX "SalePayment_businessId_branchId_paymentDate_idx" ON "SalePayment"("businessId", "branchId", "paymentDate");

-- CreateIndex
CREATE INDEX "SalePayment_businessId_saleId_idx" ON "SalePayment"("businessId", "saleId");

-- CreateIndex
CREATE INDEX "SalePayment_businessId_paymentMethod_paymentDate_idx" ON "SalePayment"("businessId", "paymentMethod", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalePayment_businessId_paymentNumber_key" ON "SalePayment"("businessId", "paymentNumber");

-- CreateIndex
CREATE INDEX "SaleActivity_businessId_idx" ON "SaleActivity"("businessId");

-- CreateIndex
CREATE INDEX "SaleActivity_saleId_idx" ON "SaleActivity"("saleId");

-- CreateIndex
CREATE INDEX "SaleActivity_actorId_idx" ON "SaleActivity"("actorId");

-- CreateIndex
CREATE INDEX "SaleActivity_saleId_createdAt_idx" ON "SaleActivity"("saleId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleActivity_businessId_type_createdAt_idx" ON "SaleActivity"("businessId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_priceApprovedById_fkey" FOREIGN KEY ("priceApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleActivity" ADD CONSTRAINT "SaleActivity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleActivity" ADD CONSTRAINT "SaleActivity_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleActivity" ADD CONSTRAINT "SaleActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
