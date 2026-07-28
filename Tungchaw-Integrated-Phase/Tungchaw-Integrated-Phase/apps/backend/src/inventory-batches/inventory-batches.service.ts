import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryBatchQueryDto } from './dto/inventory-batch-query.dto';

interface BatchQuantityChange {
  batchId: string;
  quantity: Prisma.Decimal;
}

@Injectable()
export class InventoryBatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromPurchaseItem(
    tx: Prisma.TransactionClient,
    input: {
      businessId: string;
      branchId: string;
      productId: string;
      purchaseItemId: string;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      batchNumber: string | null;
      manufacturedAt: Date | null;
      expiryDate: Date | null;
    },
  ) {
    if (input.quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Batch quantity must be greater than zero');
    }

    return tx.inventoryBatch.upsert({
      where: {
        branchId_sourcePurchaseItemId: {
          branchId: input.branchId,
          sourcePurchaseItemId: input.purchaseItemId,
        },
      },
      update: {
        receivedQuantity: input.quantity,
        currentQuantity: input.quantity,
        unitCost: input.unitCost,
        batchNumber: input.batchNumber?.trim() || null,
        manufacturedAt: input.manufacturedAt,
        expiryDate: input.expiryDate,
        isActive: true,
      },
      create: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        sourcePurchaseItemId: input.purchaseItemId,
        receivedQuantity: input.quantity,
        currentQuantity: input.quantity,
        unitCost: input.unitCost,
        batchNumber: input.batchNumber?.trim() || null,
        manufacturedAt: input.manufacturedAt,
        expiryDate: input.expiryDate,
      },
    });
  }

  async consumeFefo(
    tx: Prisma.TransactionClient,
    input: {
      businessId: string;
      branchId: string;
      productId: string;
      productName: string;
      saleItemId: string;
      quantity: Prisma.Decimal;
    },
  ) {
    let remaining = this.quantity(input.quantity);

    if (remaining.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Allocation quantity must be greater than zero',
      );
    }

    const product = await tx.product.findFirst({
      where: {
        id: input.productId,
        businessId: input.businessId,
      },
      select: {
        trackStock: true,
      },
    });

    if (!product) {
      throw new ConflictException(
        `Product ${input.productName} no longer exists`,
      );
    }

    if (!product.trackStock) {
      return [];
    }

    const startOfTodayUtc = this.startOfUtcDay(new Date());

    const batches = await tx.inventoryBatch.findMany({
      where: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        isActive: true,
        currentQuantity: {
          gt: 0,
        },
        OR: [
          {
            expiryDate: null,
          },
          {
            expiryDate: {
              gte: startOfTodayUtc,
            },
          },
        ],
      },
      orderBy: [
        {
          expiryDate: {
            sort: 'asc',
            nulls: 'last',
          },
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    const available = batches.reduce(
      (sum, batch) => sum.plus(batch.currentQuantity),
      new Prisma.Decimal(0),
    );

    if (available.lessThan(remaining)) {
      const allPositiveBatchStock = await tx.inventoryBatch.aggregate({
        where: {
          businessId: input.businessId,
          branchId: input.branchId,
          productId: input.productId,
          isActive: true,
          currentQuantity: {
            gt: 0,
          },
        },
        _sum: {
          currentQuantity: true,
        },
      });

      const totalPositiveStock = this.quantity(
        allPositiveBatchStock._sum.currentQuantity ?? 0,
      );
      const expiredStock = Prisma.Decimal.max(
        totalPositiveStock.minus(available),
        new Prisma.Decimal(0),
      );

      if (available.isZero() && expiredStock.greaterThan(0)) {
        throw new ConflictException(
          `Cannot sell ${input.productName}. No usable non-expired batch stock is available; ` +
            `${expiredStock.toFixed(3)} units are expired.`,
        );
      }

      if (expiredStock.greaterThan(0)) {
        throw new ConflictException(
          `Insufficient usable batch stock for ${input.productName}. ` +
            `Requested ${remaining.toFixed(3)}, usable ${available.toFixed(3)}, ` +
            `expired ${expiredStock.toFixed(3)}.`,
        );
      }

      throw new ConflictException(
        `Insufficient batch stock for ${input.productName}. ` +
          `Requested ${remaining.toFixed(3)}, available ${available.toFixed(3)}.`,
      );
    }

    const allocations: Array<{
      batchId: string;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
    }> = [];

    for (const batch of batches) {
      if (remaining.isZero()) {
        break;
      }

      const take = Prisma.Decimal.min(batch.currentQuantity, remaining);

      const updated = await tx.inventoryBatch.updateMany({
        where: {
          id: batch.id,
          businessId: input.businessId,
          branchId: input.branchId,
          currentQuantity: {
            gte: take,
          },
        },
        data: {
          currentQuantity: {
            decrement: take,
          },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'Batch stock changed during allocation; retry the sale',
        );
      }

      await tx.inventoryBatchAllocation.upsert({
        where: {
          batchId_saleItemId: {
            batchId: batch.id,
            saleItemId: input.saleItemId,
          },
        },
        update: {
          quantity: {
            increment: take,
          },
        },
        create: {
          batchId: batch.id,
          saleItemId: input.saleItemId,
          quantity: take,
          unitCost: batch.unitCost,
        },
      });

      allocations.push({
        batchId: batch.id,
        quantity: take,
        unitCost: batch.unitCost,
      });

      remaining = remaining.minus(take);
    }

    if (!remaining.isZero()) {
      throw new ConflictException(
        `Unable to allocate the complete batch quantity for ${input.productName}`,
      );
    }

    return allocations;
  }

  /**
   * Restores a returned quantity to the same inventory batches originally
   * consumed by the sale item.
   *
   * InventoryBatchAllocation remains unchanged because it represents the
   * original sale consumption and acts as the historical audit record.
   */
  async restoreFromSaleReturn(
    tx: Prisma.TransactionClient,
    input: {
      businessId: string;
      branchId: string;
      saleItemId: string;
      productName: string;
      quantity: Prisma.Decimal;
      previouslyRestoredQuantity?: Prisma.Decimal;
    },
  ): Promise<BatchQuantityChange[]> {
    let remaining = this.quantity(input.quantity);
    let restorationOffset = this.quantity(
      input.previouslyRestoredQuantity ?? 0,
    );

    if (remaining.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Batch restoration quantity must be greater than zero',
      );
    }

    if (restorationOffset.lessThan(0)) {
      throw new BadRequestException(
        'Previously restored quantity cannot be negative',
      );
    }

    const allocations = await this.getSaleItemAllocations(tx, {
      businessId: input.businessId,
      branchId: input.branchId,
      saleItemId: input.saleItemId,
    });

    if (allocations.length === 0) {
      throw new ConflictException(
        `No batch allocation was found for ${input.productName}`,
      );
    }

    const originallyAllocated = allocations.reduce(
      (total, allocation) => total.plus(allocation.quantity),
      new Prisma.Decimal(0),
    );

    if (restorationOffset.plus(remaining).greaterThan(originallyAllocated)) {
      throw new ConflictException(
        `Cannot restore more batch stock than was originally allocated for ${input.productName}`,
      );
    }

    const restored: BatchQuantityChange[] = [];

    for (const allocation of allocations) {
      if (remaining.isZero()) {
        break;
      }

      let availableInAllocation = new Prisma.Decimal(allocation.quantity);

      if (restorationOffset.greaterThanOrEqualTo(availableInAllocation)) {
        restorationOffset = restorationOffset.minus(availableInAllocation);
        continue;
      }

      if (restorationOffset.greaterThan(0)) {
        availableInAllocation = availableInAllocation.minus(restorationOffset);
        restorationOffset = new Prisma.Decimal(0);
      }

      const restoreQuantity = Prisma.Decimal.min(
        availableInAllocation,
        remaining,
      );

      const updated = await tx.inventoryBatch.updateMany({
        where: {
          id: allocation.batchId,
          businessId: input.businessId,
          branchId: input.branchId,
          productId: allocation.batch.productId,
        },
        data: {
          currentQuantity: {
            increment: restoreQuantity,
          },
          isActive: true,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          `The original inventory batch for ${input.productName} could not be restored`,
        );
      }

      restored.push({
        batchId: allocation.batchId,
        quantity: restoreQuantity,
      });

      remaining = remaining.minus(restoreQuantity);
    }

    if (!remaining.isZero()) {
      throw new ConflictException(
        `Unable to restore the complete returned quantity for ${input.productName}`,
      );
    }

    return restored;
  }

  /**
   * Reverses a previous sale-return batch restoration.
   *
   * The same allocation interval used during restoration is deducted.
   */
  async reverseSaleReturnRestoration(
    tx: Prisma.TransactionClient,
    input: {
      businessId: string;
      branchId: string;
      saleItemId: string;
      productName: string;
      quantity: Prisma.Decimal;
      previouslyRestoredQuantity?: Prisma.Decimal;
    },
  ): Promise<BatchQuantityChange[]> {
    let remaining = this.quantity(input.quantity);
    let restorationOffset = this.quantity(
      input.previouslyRestoredQuantity ?? 0,
    );

    if (remaining.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Batch reversal quantity must be greater than zero',
      );
    }

    if (restorationOffset.lessThan(0)) {
      throw new BadRequestException(
        'Previously restored quantity cannot be negative',
      );
    }

    const allocations = await this.getSaleItemAllocations(tx, {
      businessId: input.businessId,
      branchId: input.branchId,
      saleItemId: input.saleItemId,
    });

    if (allocations.length === 0) {
      throw new ConflictException(
        `No batch allocation was found for ${input.productName}`,
      );
    }

    const originallyAllocated = allocations.reduce(
      (total, allocation) => total.plus(allocation.quantity),
      new Prisma.Decimal(0),
    );

    if (restorationOffset.plus(remaining).greaterThan(originallyAllocated)) {
      throw new ConflictException(
        `The batch restoration reversal exceeds the original allocation for ${input.productName}`,
      );
    }

    const reversed: BatchQuantityChange[] = [];

    for (const allocation of allocations) {
      if (remaining.isZero()) {
        break;
      }

      let availableInAllocation = new Prisma.Decimal(allocation.quantity);

      if (restorationOffset.greaterThanOrEqualTo(availableInAllocation)) {
        restorationOffset = restorationOffset.minus(availableInAllocation);
        continue;
      }

      if (restorationOffset.greaterThan(0)) {
        availableInAllocation = availableInAllocation.minus(restorationOffset);
        restorationOffset = new Prisma.Decimal(0);
      }

      const reverseQuantity = Prisma.Decimal.min(
        availableInAllocation,
        remaining,
      );

      const updated = await tx.inventoryBatch.updateMany({
        where: {
          id: allocation.batchId,
          businessId: input.businessId,
          branchId: input.branchId,
          currentQuantity: {
            gte: reverseQuantity,
          },
        },
        data: {
          currentQuantity: {
            decrement: reverseQuantity,
          },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          `Cannot cancel the return because batch stock for ${input.productName} is insufficient`,
        );
      }

      reversed.push({
        batchId: allocation.batchId,
        quantity: reverseQuantity,
      });

      remaining = remaining.minus(reverseQuantity);
    }

    if (!remaining.isZero()) {
      throw new ConflictException(
        `Unable to reverse the complete batch restoration for ${input.productName}`,
      );
    }

    return reversed;
  }

  async findAll(businessId: string, query: InventoryBatchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.InventoryBatchWhereInput = {
      businessId,
      ...(query.branchId
        ? {
            branchId: query.branchId,
          }
        : {}),
      ...(query.productId
        ? {
            productId: query.productId,
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                batchNumber: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                product: {
                  name: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
              },
              {
                product: {
                  code: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.expiryFrom || query.expiryTo
        ? {
            expiryDate: {
              ...(query.expiryFrom
                ? {
                    gte: new Date(query.expiryFrom),
                  }
                : {}),
              ...(query.expiryTo
                ? {
                    lte: new Date(query.expiryTo),
                  }
                : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryBatch.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          {
            expiryDate: {
              sort: 'asc',
              nulls: 'last',
            },
          },
          {
            createdAt: 'asc',
          },
        ],
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              code: true,
              barcode: true,
            },
          },
          sourcePurchaseItem: {
            select: {
              purchase: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  supplier: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.inventoryBatch.count({
        where,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(businessId: string, batchId: string) {
    const batch = await this.prisma.inventoryBatch.findFirst({
      where: {
        id: batchId,
        businessId,
      },
      include: {
        branch: true,
        product: true,
        sourcePurchaseItem: {
          include: {
            purchase: {
              include: {
                supplier: true,
              },
            },
          },
        },
        allocations: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 50,
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Inventory batch not found');
    }

    return batch;
  }

  async expiring(businessId: string, days: number, branchId?: string) {
    if (!Number.isInteger(days) || days < 0 || days > 3650) {
      throw new BadRequestException(
        'days must be an integer between 0 and 3650',
      );
    }

    const startOfTodayUtc = this.startOfUtcDay(new Date());
    const upperExclusiveUtc = new Date(startOfTodayUtc);

    // Include today and every calendar day through the requested day.
    // Example: days=7 returns batches expiring today through 7 days from today.
    upperExclusiveUtc.setUTCDate(upperExclusiveUtc.getUTCDate() + days + 1);

    return this.prisma.inventoryBatch.findMany({
      where: {
        businessId,
        ...(branchId
          ? {
              branchId,
            }
          : {}),
        isActive: true,
        currentQuantity: {
          gt: 0,
        },
        expiryDate: {
          gte: startOfTodayUtc,
          lt: upperExclusiveUtc,
        },
      },
      orderBy: {
        expiryDate: 'asc',
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async expired(businessId: string, branchId?: string) {
    const startOfTodayUtc = this.startOfUtcDay(new Date());

    return this.prisma.inventoryBatch.findMany({
      where: {
        businessId,
        ...(branchId
          ? {
              branchId,
            }
          : {}),
        isActive: true,
        currentQuantity: {
          gt: 0,
        },
        expiryDate: {
          lt: startOfTodayUtc,
        },
      },
      orderBy: {
        expiryDate: 'asc',
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  private async getSaleItemAllocations(
    tx: Prisma.TransactionClient,
    input: {
      businessId: string;
      branchId: string;
      saleItemId: string;
    },
  ) {
    return tx.inventoryBatchAllocation.findMany({
      where: {
        saleItemId: input.saleItemId,
        batch: {
          businessId: input.businessId,
          branchId: input.branchId,
        },
      },
      orderBy: [
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      include: {
        batch: {
          select: {
            id: true,
            productId: true,
          },
        },
      },
    });
  }

  private startOfUtcDay(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private quantity(value: Prisma.Decimal | string | number): Prisma.Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(3);
  }
}
