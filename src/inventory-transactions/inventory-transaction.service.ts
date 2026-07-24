import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  InventoryTransactionInput,
  InventoryTransactionResult,
} from './inventory-transaction.types';

@Injectable()
export class InventoryTransactionService {
  async increaseStock(
    tx: Prisma.TransactionClient,
    input: InventoryTransactionInput,
  ): Promise<InventoryTransactionResult> {
    const quantity = this.quantity(input.quantity);

    this.assertPositiveQuantity(quantity);

    const product = await this.findProduct(tx, input);

    if (!product.trackStock) {
      return this.untrackedResult();
    }

    const existingStock = await tx.branchStock.findUnique({
      where: {
        branchId_productId: {
          branchId: input.branchId,
          productId: input.productId,
        },
      },
      select: {
        businessId: true,
        quantity: true,
      },
    });

    if (existingStock && existingStock.businessId !== input.businessId) {
      throw new ConflictException(
        `Stock record for ${input.productName} does not belong to the selected business`,
      );
    }

    const quantityBefore = existingStock?.quantity ?? new Prisma.Decimal(0);

    const stock = await tx.branchStock.upsert({
      where: {
        branchId_productId: {
          branchId: input.branchId,
          productId: input.productId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      create: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        quantity,
      },
      select: {
        quantity: true,
      },
    });

    await this.createMovement(tx, {
      input,
      quantityBefore,
      quantityChange: quantity,
      quantityAfter: stock.quantity,
    });

    return {
      tracked: true,
      quantityBefore,
      quantityChange: quantity,
      quantityAfter: stock.quantity,
    };
  }

  async decreaseStock(
    tx: Prisma.TransactionClient,
    input: InventoryTransactionInput,
  ): Promise<InventoryTransactionResult> {
    const quantity = this.quantity(input.quantity);

    this.assertPositiveQuantity(quantity);

    const product = await this.findProduct(tx, input);

    if (!product.trackStock) {
      return this.untrackedResult();
    }

    const existingStock = await tx.branchStock.findUnique({
      where: {
        branchId_productId: {
          branchId: input.branchId,
          productId: input.productId,
        },
      },
      select: {
        businessId: true,
        quantity: true,
      },
    });

    if (!existingStock) {
      throw new ConflictException(
        input.insufficientStockMessage ??
          `No stock record exists for ${input.productName}`,
      );
    }

    if (existingStock.businessId !== input.businessId) {
      throw new ConflictException(
        `Stock record for ${input.productName} does not belong to the selected business`,
      );
    }

    const updated = await tx.branchStock.updateMany({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        quantity: {
          gte: quantity,
        },
      },
      data: {
        quantity: {
          decrement: quantity,
        },
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException(
        input.insufficientStockMessage ??
          `Not enough stock for ${input.productName}`,
      );
    }

    const quantityBefore = existingStock.quantity;
    const quantityChange = quantity.negated();
    const quantityAfter = quantityBefore.minus(quantity);

    await this.createMovement(tx, {
      input,
      quantityBefore,
      quantityChange,
      quantityAfter,
    });

    return {
      tracked: true,
      quantityBefore,
      quantityChange,
      quantityAfter,
    };
  }

  private async findProduct(
    tx: Prisma.TransactionClient,
    input: InventoryTransactionInput,
  ) {
    const product = await tx.product.findFirst({
      where: {
        id: input.productId,
        businessId: input.businessId,
      },
      select: {
        id: true,
        isActive: true,
        trackStock: true,
      },
    });

    if (!product) {
      throw new ConflictException(
        `Product ${input.productName} no longer exists`,
      );
    }

    if (!product.isActive && !input.allowInactiveProduct) {
      throw new BadRequestException(`Product ${input.productName} is inactive`);
    }

    return product;
  }

  private async createMovement(
    tx: Prisma.TransactionClient,
    values: {
      input: InventoryTransactionInput;
      quantityBefore: Prisma.Decimal;
      quantityChange: Prisma.Decimal;
      quantityAfter: Prisma.Decimal;
    },
  ): Promise<void> {
    const { input, quantityBefore, quantityChange, quantityAfter } = values;

    await tx.stockMovement.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        type: input.movementType,
        quantityBefore,
        quantityChange,
        quantityAfter,
        referenceType: input.referenceType.trim(),
        referenceId: input.referenceId,
        reason: input.reason.trim(),
        notes: input.notes?.trim() || null,
        createdById: input.createdById ?? null,
      },
    });
  }

  private untrackedResult(): InventoryTransactionResult {
    const zero = new Prisma.Decimal(0);

    return {
      tracked: false,
      quantityBefore: zero,
      quantityChange: zero,
      quantityAfter: zero,
    };
  }

  private assertPositiveQuantity(quantity: Prisma.Decimal): void {
    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Inventory transaction quantity must be greater than zero',
      );
    }
  }

  private quantity(value: Prisma.Decimal | string | number): Prisma.Decimal {
    let quantity: Prisma.Decimal;

    try {
      quantity = new Prisma.Decimal(value).toDecimalPlaces(3);
    } catch {
      throw new BadRequestException(
        'Inventory transaction quantity is invalid',
      );
    }

    if (!quantity.isFinite()) {
      throw new BadRequestException(
        'Inventory transaction quantity is invalid',
      );
    }

    return quantity;
  }
}
