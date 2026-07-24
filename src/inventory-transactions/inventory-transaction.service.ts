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

    const product = await this.findProduct(
      tx,
      input.businessId,
      input.productId,
      input.productName,
    );

    if (!product.trackStock) {
      return {
        tracked: false,
        quantityBefore: new Prisma.Decimal(0),
        quantityChange: new Prisma.Decimal(0),
        quantityAfter: new Prisma.Decimal(0),
      };
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

    await tx.stockMovement.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        type: input.movementType,
        quantityBefore,
        quantityChange: quantity,
        quantityAfter: stock.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        reason: input.reason.trim(),
        notes: input.notes?.trim() || null,
        createdById: input.createdById ?? null,
      },
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

    const product = await this.findProduct(
      tx,
      input.businessId,
      input.productId,
      input.productName,
    );

    if (!product.trackStock) {
      return {
        tracked: false,
        quantityBefore: new Prisma.Decimal(0),
        quantityChange: new Prisma.Decimal(0),
        quantityAfter: new Prisma.Decimal(0),
      };
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
      throw new ConflictException(`Not enough stock for ${input.productName}`);
    }

    const quantityBefore = existingStock.quantity;
    const quantityAfter = quantityBefore.minus(quantity);

    await tx.stockMovement.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        type: input.movementType,
        quantityBefore,
        quantityChange: quantity.negated(),
        quantityAfter,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        reason: input.reason.trim(),
        notes: input.notes?.trim() || null,
        createdById: input.createdById ?? null,
      },
    });

    return {
      tracked: true,
      quantityBefore,
      quantityChange: quantity.negated(),
      quantityAfter,
    };
  }

  private async findProduct(
    tx: Prisma.TransactionClient,
    businessId: string,
    productId: string,
    productName: string,
  ) {
    const product = await tx.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
      select: {
        id: true,
        isActive: true,
        trackStock: true,
      },
    });

    if (!product) {
      throw new ConflictException(`Product ${productName} no longer exists`);
    }

    if (!product.isActive) {
      throw new BadRequestException(`Product ${productName} is inactive`);
    }

    return product;
  }

  private assertPositiveQuantity(quantity: Prisma.Decimal): void {
    if (quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Inventory transaction quantity must be greater than zero',
      );
    }
  }

  private quantity(value: Prisma.Decimal | string | number): Prisma.Decimal {
    const quantity = new Prisma.Decimal(value).toDecimalPlaces(3);

    if (!quantity.isFinite()) {
      throw new BadRequestException(
        'Inventory transaction quantity is invalid',
      );
    }

    return quantity;
  }
}
