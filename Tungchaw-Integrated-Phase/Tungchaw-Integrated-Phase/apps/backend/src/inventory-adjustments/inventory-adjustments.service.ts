import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryAdjustmentReason,
  InventoryAdjustmentStatus,
  InventoryAdjustmentType,
  Prisma,
  StockMovementType,
} from '../generated/prisma/client';
import { InventoryTransactionService } from '../inventory-transactions/inventory-transaction.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelInventoryAdjustmentDto } from './dto/cancel-inventory-adjustment.dto';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { InventoryAdjustmentQueryDto } from './dto/inventory-adjustment-query.dto';

interface CalculatedInventoryAdjustmentItem {
  productId: string;
  lineNumber: number;
  productName: string;
  productCode: string;
  unitName: string;
  quantity: Prisma.Decimal;
  quantityBefore: Prisma.Decimal;
  quantityAfter: Prisma.Decimal;
  itemReason: string | null;
  notes: string | null;
}

@Injectable()
export class InventoryAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryTransactions: InventoryTransactionService,
  ) {}

  async create(
    businessId: string,
    userId: string,
    dto: CreateInventoryAdjustmentDto,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const branch = await tx.branch.findFirst({
            where: {
              id: dto.branchId,
              businessId,
              isActive: true,
            },
            select: {
              id: true,
            },
          });

          if (!branch) {
            throw new NotFoundException(
              'Active branch not found for this business',
            );
          }

          const requestedProductIds = dto.items.map((item) => item.productId);

          if (
            new Set(requestedProductIds).size !== requestedProductIds.length
          ) {
            throw new BadRequestException(
              'A product may appear only once in an inventory adjustment',
            );
          }

          const products = await tx.product.findMany({
            where: {
              businessId,
              id: {
                in: requestedProductIds,
              },
            },
            select: {
              id: true,
              name: true,
              code: true,
              trackStock: true,
              unit: {
                select: {
                  name: true,
                },
              },
            },
          });

          if (products.length !== requestedProductIds.length) {
            throw new BadRequestException(
              'One or more products do not belong to this business',
            );
          }

          const productMap = new Map(
            products.map((product) => [product.id, product]),
          );

          const stocks = await tx.branchStock.findMany({
            where: {
              branchId: branch.id,
              productId: {
                in: requestedProductIds,
              },
            },
            select: {
              productId: true,
              quantity: true,
            },
          });

          const stockMap = new Map(
            stocks.map((stock) => [stock.productId, stock.quantity]),
          );

          let totalQuantity = new Prisma.Decimal(0);

          const calculatedItems: CalculatedInventoryAdjustmentItem[] =
            dto.items.map((input, index) => {
              const product = productMap.get(input.productId);

              if (!product) {
                throw new BadRequestException(
                  'One or more products do not belong to this business',
                );
              }

              if (!product.trackStock) {
                throw new BadRequestException(
                  `Stock tracking is disabled for ${product.name}`,
                );
              }

              const quantity = this.quantity(input.quantity);
              const quantityBefore =
                stockMap.get(product.id) ?? new Prisma.Decimal(0);

              if (
                dto.type === InventoryAdjustmentType.DECREASE &&
                quantity.greaterThan(quantityBefore)
              ) {
                throw new BadRequestException(
                  `Insufficient stock for ${product.name}. Available quantity is ${quantityBefore.toFixed(3)}`,
                );
              }

              const quantityAfter =
                dto.type === InventoryAdjustmentType.INCREASE
                  ? quantityBefore.plus(quantity)
                  : quantityBefore.minus(quantity);

              totalQuantity = totalQuantity.plus(quantity);

              return {
                productId: product.id,
                lineNumber: index + 1,
                productName: product.name,
                productCode: product.code,
                unitName: product.unit.name,
                quantity,
                quantityBefore,
                quantityAfter,
                itemReason: input.itemReason?.trim() || null,
                notes: input.notes?.trim() || null,
              };
            });

          const adjustmentDate = new Date();
          const adjustmentNumber = await this.generateAdjustmentNumber(
            tx,
            businessId,
            adjustmentDate,
          );

          const adjustment = await tx.inventoryAdjustment.create({
            data: {
              businessId,
              branchId: branch.id,
              createdById: userId,
              adjustmentNumber,
              adjustmentDate,
              type: dto.type,
              reason: dto.reason,
              totalQuantity: totalQuantity.toDecimalPlaces(3),
              referenceNumber: dto.referenceNumber?.trim() || null,
              notes: dto.notes?.trim() || null,
              items: {
                create: calculatedItems,
              },
            },
            select: {
              id: true,
            },
          });

          const movementType = this.movementType(dto.type, dto.reason);

          for (const item of calculatedItems) {
            const input = {
              businessId,
              branchId: branch.id,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              movementType,
              referenceType: 'INVENTORY_ADJUSTMENT',
              referenceId: adjustment.id,
              reason: this.adjustmentReasonText(adjustmentNumber, dto.reason),
              notes:
                [item.itemReason, item.notes].filter(Boolean).join(' | ') ||
                null,
              createdById: userId,
              allowInactiveProduct: true,
            };

            if (dto.type === InventoryAdjustmentType.INCREASE) {
              await this.inventoryTransactions.increaseStock(tx, input);
            } else {
              await this.inventoryTransactions.decreaseStock(tx, input);
            }
          }

          return tx.inventoryAdjustment.findUniqueOrThrow({
            where: {
              id: adjustment.id,
            },
            select: this.detailsSelect(),
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Unable to generate a unique inventory adjustment number. Please retry.',
        );
      }

      throw error;
    }
  }

  async cancel(
    businessId: string,
    adjustmentId: string,
    userId: string,
    dto: CancelInventoryAdjustmentDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const adjustment = await tx.inventoryAdjustment.findFirst({
          where: {
            id: adjustmentId,
            businessId,
          },
          include: {
            items: true,
          },
        });

        if (!adjustment) {
          throw new NotFoundException('Inventory adjustment not found');
        }

        if (adjustment.status !== InventoryAdjustmentStatus.COMPLETED) {
          throw new BadRequestException(
            'Only completed inventory adjustments can be cancelled',
          );
        }

        const oppositeType =
          adjustment.type === InventoryAdjustmentType.INCREASE
            ? InventoryAdjustmentType.DECREASE
            : InventoryAdjustmentType.INCREASE;

        for (const item of adjustment.items) {
          const input = {
            businessId,
            branchId: adjustment.branchId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            movementType:
              oppositeType === InventoryAdjustmentType.INCREASE
                ? StockMovementType.ADJUSTMENT_IN
                : StockMovementType.ADJUSTMENT_OUT,
            referenceType: 'INVENTORY_ADJUSTMENT_CANCELLATION',
            referenceId: adjustment.id,
            reason: `Inventory adjustment cancelled: ${dto.reason.trim()}`,
            createdById: userId,
            allowInactiveProduct: true,
          };

          if (oppositeType === InventoryAdjustmentType.INCREASE) {
            await this.inventoryTransactions.increaseStock(tx, input);
          } else {
            await this.inventoryTransactions.decreaseStock(tx, input);
          }
        }

        return tx.inventoryAdjustment.update({
          where: {
            id: adjustment.id,
          },
          data: {
            status: InventoryAdjustmentStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledById: userId,
            cancellationReason: dto.reason.trim(),
          },
          select: this.detailsSelect(),
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async findAll(businessId: string, query: InventoryAdjustmentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (
      query.dateFrom &&
      query.dateTo &&
      new Date(query.dateFrom) > new Date(query.dateTo)
    ) {
      throw new BadRequestException('dateFrom cannot be after dateTo');
    }

    const date: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      date.gte = this.startOfDay(query.dateFrom);
    }

    if (query.dateTo) {
      date.lte = this.endOfDay(query.dateTo);
    }

    const search = query.search?.trim();

    const where: Prisma.InventoryAdjustmentWhereInput = {
      businessId,

      ...(query.branchId
        ? {
            branchId: query.branchId,
          }
        : {}),

      ...(query.type
        ? {
            type: query.type,
          }
        : {}),

      ...(query.reason
        ? {
            reason: query.reason,
          }
        : {}),

      ...(query.status
        ? {
            status: query.status,
          }
        : {}),

      ...(query.dateFrom || query.dateTo
        ? {
            adjustmentDate: date,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                adjustmentNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                referenceNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                items: {
                  some: {
                    OR: [
                      {
                        productName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        productCode: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryAdjustment.findMany({
        where,
        orderBy: [
          {
            adjustmentDate: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: this.listSelect(),
      }),
      this.prisma.inventoryAdjustment.count({
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

  async findOne(businessId: string, adjustmentId: string) {
    const adjustment = await this.prisma.inventoryAdjustment.findFirst({
      where: {
        id: adjustmentId,
        businessId,
      },
      select: this.detailsSelect(),
    });

    if (!adjustment) {
      throw new NotFoundException('Inventory adjustment not found');
    }

    return adjustment;
  }

  private async generateAdjustmentNumber(
    tx: Prisma.TransactionClient,
    businessId: string,
    adjustmentDate: Date,
  ): Promise<string> {
    const datePart = [
      adjustmentDate.getUTCFullYear(),
      String(adjustmentDate.getUTCMonth() + 1).padStart(2, '0'),
      String(adjustmentDate.getUTCDate()).padStart(2, '0'),
    ].join('');

    const prefix = `ADJ-${datePart}-`;

    const latest = await tx.inventoryAdjustment.findFirst({
      where: {
        businessId,
        adjustmentNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        adjustmentNumber: 'desc',
      },
      select: {
        adjustmentNumber: true,
      },
    });

    const previous = latest
      ? Number.parseInt(latest.adjustmentNumber.slice(prefix.length), 10)
      : 0;

    return `${prefix}${String(
      Number.isFinite(previous) ? previous + 1 : 1,
    ).padStart(5, '0')}`;
  }

  private listSelect() {
    return {
      id: true,
      adjustmentNumber: true,
      adjustmentDate: true,
      type: true,
      reason: true,
      status: true,
      totalQuantity: true,
      referenceNumber: true,
      createdAt: true,

      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },

      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },

      _count: {
        select: {
          items: true,
        },
      },
    } satisfies Prisma.InventoryAdjustmentSelect;
  }

  private detailsSelect() {
    return {
      ...this.listSelect(),

      notes: true,
      cancelledAt: true,
      cancellationReason: true,
      updatedAt: true,

      items: {
        orderBy: {
          lineNumber: 'asc' as const,
        },
      },

      cancelledBy: {
        select: {
          id: true,
          name: true,
        },
      },
    } satisfies Prisma.InventoryAdjustmentSelect;
  }

  private movementType(
    type: InventoryAdjustmentType,
    reason: InventoryAdjustmentReason,
  ): StockMovementType {
    if (type === InventoryAdjustmentType.INCREASE) {
      return StockMovementType.ADJUSTMENT_IN;
    }

    switch (reason) {
      case InventoryAdjustmentReason.DAMAGE:
        return StockMovementType.DAMAGE;
      case InventoryAdjustmentReason.EXPIRED:
        return StockMovementType.EXPIRED;
      case InventoryAdjustmentReason.THEFT:
        return StockMovementType.THEFT;
      default:
        return StockMovementType.ADJUSTMENT_OUT;
    }
  }

  private adjustmentReasonText(
    adjustmentNumber: string,
    reason: InventoryAdjustmentReason,
  ): string {
    return `Inventory adjustment ${adjustmentNumber}: ${reason.replaceAll('_', ' ').toLowerCase()}`;
  }

  private quantity(value: Prisma.Decimal | string | number): Prisma.Decimal {
    const quantity = new Prisma.Decimal(value).toDecimalPlaces(3);

    if (!quantity.isFinite() || quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Inventory adjustment quantity must be greater than zero',
      );
    }

    return quantity;
  }

  private startOfDay(value: string): Date {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: string): Date {
    const date = new Date(value);
    date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
