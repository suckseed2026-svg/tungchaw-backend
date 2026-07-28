-- CreateEnum
CREATE TYPE "BusinessIndustry" AS ENUM ('PHARMACY', 'GROCERY', 'HARDWARE', 'MOBILE_ELECTRONICS', 'CLOTHING', 'COSMETICS', 'RESTAURANT', 'GENERAL_RETAIL', 'MIXED_RETAIL', 'OTHER');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN "industry" "BusinessIndustry" NOT NULL DEFAULT 'GENERAL_RETAIL';

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "trackBatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requireBatchOnPurchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requireExpiryOnPurchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "blockExpiredSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "useFefo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trackSerialNumber" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BusinessConfiguration" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "defaultTrackStock" BOOLEAN NOT NULL DEFAULT true,
    "defaultTrackBatch" BOOLEAN NOT NULL DEFAULT false,
    "defaultTrackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "defaultRequireBatchOnPurchase" BOOLEAN NOT NULL DEFAULT false,
    "defaultRequireExpiryOnPurchase" BOOLEAN NOT NULL DEFAULT false,
    "defaultBlockExpiredSale" BOOLEAN NOT NULL DEFAULT false,
    "defaultUseFefo" BOOLEAN NOT NULL DEFAULT false,
    "defaultTrackSerialNumber" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessConfiguration_pkey" PRIMARY KEY ("id")
);

-- Backfill configuration for existing businesses.
INSERT INTO "BusinessConfiguration" (
  "id", "businessId", "defaultTrackStock", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, "id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business";

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "expenseCategoryId" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "paidTo" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessConfiguration_businessId_key" ON "BusinessConfiguration"("businessId");
CREATE INDEX "BusinessConfiguration_businessId_idx" ON "BusinessConfiguration"("businessId");
CREATE UNIQUE INDEX "ExpenseCategory_businessId_code_key" ON "ExpenseCategory"("businessId", "code");
CREATE INDEX "ExpenseCategory_businessId_idx" ON "ExpenseCategory"("businessId");
CREATE INDEX "ExpenseCategory_businessId_name_idx" ON "ExpenseCategory"("businessId", "name");
CREATE INDEX "ExpenseCategory_businessId_isActive_idx" ON "ExpenseCategory"("businessId", "isActive");
CREATE UNIQUE INDEX "Expense_businessId_expenseNumber_key" ON "Expense"("businessId", "expenseNumber");
CREATE INDEX "Expense_businessId_idx" ON "Expense"("businessId");
CREATE INDEX "Expense_businessId_branchId_idx" ON "Expense"("businessId", "branchId");
CREATE INDEX "Expense_businessId_expenseCategoryId_idx" ON "Expense"("businessId", "expenseCategoryId");
CREATE INDEX "Expense_businessId_expenseDate_idx" ON "Expense"("businessId", "expenseDate");
CREATE INDEX "Expense_businessId_isActive_idx" ON "Expense"("businessId", "isActive");

-- AddForeignKey
ALTER TABLE "BusinessConfiguration" ADD CONSTRAINT "BusinessConfiguration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
