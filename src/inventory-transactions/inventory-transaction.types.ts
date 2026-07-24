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

  /**
   * Historical transactions may need to modify inventory even when the
   * product has since been marked inactive.
   *
   * Defaults to false.
   */
  allowInactiveProduct?: boolean;

  /**
   * Optional domain-specific error message when stock cannot be decreased.
   */
  insufficientStockMessage?: string;
}

export interface InventoryTransactionResult {
  tracked: boolean;
  quantityBefore: Prisma.Decimal;
  quantityChange: Prisma.Decimal;
  quantityAfter: Prisma.Decimal;
}
