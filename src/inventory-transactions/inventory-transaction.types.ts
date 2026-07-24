import { Prisma, StockMovementType } from '../generated/prisma/client';

export interface InventoryTransactionInput {
  businessId: string;
  branchId: string;
  productId: string;
  productName: string;

  quantity: Prisma.Decimal | string | number;

  movementType: StockMovementType;
  referenceType: string;
  referenceId: string;

  reason: string;
  notes?: string | null;
  createdById?: string | null;
}

export interface InventoryTransactionResult {
  tracked: boolean;
  quantityBefore: Prisma.Decimal;
  quantityChange: Prisma.Decimal;
  quantityAfter: Prisma.Decimal;
}
