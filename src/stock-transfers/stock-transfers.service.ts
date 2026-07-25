import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockMovementType,
  StockTransferStatus,
} from '../generated/prisma/client';
import { InventoryTransactionService } from '../inventory-transactions/inventory-transaction.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelStockTransferDto } from './dto/cancel-stock-transfer.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { StockTransferQueryDto } from './dto/stock-transfer-query.dto';

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryTransactions: InventoryTransactionService,
  ) {}

  async create(
    businessId: string,
    userId: string,
    dto: CreateStockTransferDto,
  ) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException(
        'Source and destination branches must be different',
      );
    }

    this.assertNoDuplicateProducts(dto.items.map((item) => item.productId));

    return this.prisma.$transaction(
      async (tx) => {
        const branches = await tx.branch.findMany({
          where: {
            businessId,
            id: {
              in: [dto.fromBranchId, dto.toBranchId],
            },
          },
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        });

        const fromBranch = branches.find(
          (branch) => branch.id === dto.fromBranchId,
        );
        const toBranch = branches.find(
          (branch) => branch.id === dto.toBranchId,
        );

        if (!fromBranch) {
          throw new NotFoundException(
            'Source branch was not found in this business',
          );
        }

        if (!toBranch) {
          throw new NotFoundException(
            'Destination branch was not found in this business',
          );
        }

        if (!fromBranch.isActive) {
          throw new BadRequestException('Source branch is inactive');
        }

        if (!toBranch.isActive) {
          throw new BadRequestException('Destination branch is inactive');
        }

        const products = await tx.product.findMany({
          where: {
            businessId,
            id: {
              in: dto.items.map((item) => item.productId),
            },
          },
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
            trackStock: true,
            unit: {
              select: {
                name: true,
              },
            },
          },
        });

        if (products.length !== dto.items.length) {
          const foundIds = new Set(products.map((product) => product.id));
          const missingItem = dto.items.find(
            (item) => !foundIds.has(item.productId),
          );

          throw new NotFoundException(
            missingItem
              ? `Product ${missingItem.productId} was not found in this business`
              : 'One or more products were not found in this business',
          );
        }

        for (const product of products) {
          if (!product.isActive) {
            throw new BadRequestException(
              `Product ${product.name} is inactive`,
            );
          }

          if (!product.trackStock) {
            throw new BadRequestException(
              `Product ${product.name} does not track stock and cannot be transferred`,
            );
          }
        }

        const transferNumber = await this.nextTransferNumber(tx, businessId);
        const transferDate = dto.transferDate
          ? new Date(dto.transferDate)
          : new Date();
        const totalQuantity = dto.items.reduce(
          (total, item) => total.plus(this.quantity(item.quantity)),
          new Prisma.Decimal(0),
        );

        const transfer = await tx.stockTransfer.create({
          data: {
            businessId,
            fromBranchId: dto.fromBranchId,
            toBranchId: dto.toBranchId,
            createdById: userId,
            transferNumber,
            transferDate,
            status: StockTransferStatus.COMPLETED,
            totalQuantity,
            referenceNumber: dto.referenceNumber?.trim() || null,
            notes: dto.notes?.trim() || null,
          },
          select: {
            id: true,
          },
        });

        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );

        for (const [index, input] of dto.items.entries()) {
          const product = productMap.get(input.productId);

          if (!product) {
            throw new NotFoundException(
              `Product ${input.productId} was not found`,
            );
          }

          const quantity = this.quantity(input.quantity);

          const sourceResult = await this.inventoryTransactions.decreaseStock(
            tx,
            {
              businessId,
              branchId: dto.fromBranchId,
              productId: product.id,
              productName: product.name,
              quantity,
              movementType: StockMovementType.TRANSFER_OUT,
              referenceType: 'STOCK_TRANSFER',
              referenceId: transfer.id,
              reason: `Transferred to ${toBranch.name}`,
              notes: input.notes,
              createdById: userId,
              insufficientStockMessage: `Not enough stock for ${product.name} at ${fromBranch.name}`,
            },
          );

          const destinationResult =
            await this.inventoryTransactions.increaseStock(tx, {
              businessId,
              branchId: dto.toBranchId,
              productId: product.id,
              productName: product.name,
              quantity,
              movementType: StockMovementType.TRANSFER_IN,
              referenceType: 'STOCK_TRANSFER',
              referenceId: transfer.id,
              reason: `Transferred from ${fromBranch.name}`,
              notes: input.notes,
              createdById: userId,
            });

          await tx.stockTransferItem.create({
            data: {
              stockTransferId: transfer.id,
              productId: product.id,
              lineNumber: index + 1,
              productName: product.name,
              productCode: product.code,
              unitName: product.unit.name,
              quantity,
              quantityBeforeSource: sourceResult.quantityBefore,
              quantityAfterSource: sourceResult.quantityAfter,
              quantityBeforeDestination: destinationResult.quantityBefore,
              quantityAfterDestination: destinationResult.quantityAfter,
              notes: input.notes?.trim() || null,
            },
          });
        }

        return tx.stockTransfer.findUniqueOrThrow({
          where: {
            id: transfer.id,
          },
          select: this.detailsSelect(),
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async findAll(businessId: string, query: StockTransferQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    if (
      query.dateFrom &&
      query.dateTo &&
      new Date(query.dateFrom) > new Date(query.dateTo)
    ) {
      throw new BadRequestException('dateFrom cannot be after dateTo');
    }

    const transferDate: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      transferDate.gte = this.startOfDay(query.dateFrom);
    }

    if (query.dateTo) {
      transferDate.lte = this.endOfDay(query.dateTo);
    }

    const search = query.search?.trim();

    const where: Prisma.StockTransferWhereInput = {
      businessId,
      ...(query.fromBranchId ? { fromBranchId: query.fromBranchId } : {}),
      ...(query.toBranchId ? { toBranchId: query.toBranchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo ? { transferDate } : {}),
      ...(search
        ? {
            OR: [
              {
                transferNumber: {
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
      this.prisma.stockTransfer.findMany({
        where,
        orderBy: [{ transferDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: this.listSelect(),
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(businessId: string, id: string) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: {
        id,
        businessId,
      },
      select: this.detailsSelect(),
    });

    if (!transfer) {
      throw new NotFoundException('Stock transfer not found');
    }

    return transfer;
  }

  async cancel(
    businessId: string,
    id: string,
    userId: string,
    dto: CancelStockTransferDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const transfer = await tx.stockTransfer.findFirst({
          where: {
            id,
            businessId,
          },
          select: {
            id: true,
            status: true,
            fromBranchId: true,
            toBranchId: true,
            fromBranch: {
              select: {
                name: true,
              },
            },
            toBranch: {
              select: {
                name: true,
              },
            },
            items: {
              orderBy: {
                lineNumber: 'asc',
              },
            },
          },
        });

        if (!transfer) {
          throw new NotFoundException('Stock transfer not found');
        }

        if (transfer.status === StockTransferStatus.CANCELLED) {
          throw new BadRequestException(
            'This stock transfer is already cancelled',
          );
        }

        const reason = dto.reason.trim();

        for (const item of transfer.items) {
          await this.inventoryTransactions.decreaseStock(tx, {
            businessId,
            branchId: transfer.toBranchId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            movementType: StockMovementType.TRANSFER_OUT,
            referenceType: 'STOCK_TRANSFER_CANCELLATION',
            referenceId: transfer.id,
            reason: `Stock transfer cancelled: ${reason}`,
            notes: item.notes,
            createdById: userId,
            allowInactiveProduct: true,
            insufficientStockMessage:
              `Cannot cancel transfer because ${transfer.toBranch.name} ` +
              `does not have enough ${item.productName}`,
          });

          await this.inventoryTransactions.increaseStock(tx, {
            businessId,
            branchId: transfer.fromBranchId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            movementType: StockMovementType.TRANSFER_IN,
            referenceType: 'STOCK_TRANSFER_CANCELLATION',
            referenceId: transfer.id,
            reason: `Stock transfer cancelled: ${reason}`,
            notes: item.notes,
            createdById: userId,
            allowInactiveProduct: true,
          });
        }

        return tx.stockTransfer.update({
          where: {
            id: transfer.id,
          },
          data: {
            status: StockTransferStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledById: userId,
            cancellationReason: reason,
          },
          select: this.detailsSelect(),
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private assertNoDuplicateProducts(productIds: string[]): void {
    const uniqueIds = new Set(productIds);

    if (uniqueIds.size !== productIds.length) {
      throw new BadRequestException(
        'A product may appear only once in a stock transfer',
      );
    }
  }

  private async nextTransferNumber(
    tx: Prisma.TransactionClient,
    businessId: string,
  ): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `ST-${year}-`;

    const latest = await tx.stockTransfer.findFirst({
      where: {
        businessId,
        transferNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        transferNumber: 'desc',
      },
      select: {
        transferNumber: true,
      },
    });

    const previous = latest
      ? Number.parseInt(latest.transferNumber.slice(prefix.length), 10)
      : 0;

    const next = Number.isFinite(previous) ? previous + 1 : 1;

    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private listSelect() {
    return {
      id: true,
      transferNumber: true,
      transferDate: true,
      status: true,
      totalQuantity: true,
      referenceNumber: true,
      createdAt: true,
      fromBranch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      toBranch: {
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
    } satisfies Prisma.StockTransferSelect;
  }

  private detailsSelect() {
    return {
      ...this.listSelect(),
      businessId: true,
      fromBranchId: true,
      toBranchId: true,
      createdById: true,
      cancelledById: true,
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
    } satisfies Prisma.StockTransferSelect;
  }

  private quantity(value: Prisma.Decimal | string | number): Prisma.Decimal {
    let quantity: Prisma.Decimal;

    try {
      quantity = new Prisma.Decimal(value).toDecimalPlaces(3);
    } catch {
      throw new BadRequestException('Transfer quantity is invalid');
    }

    if (!quantity.isFinite() || quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Transfer quantity must be greater than zero',
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
}
