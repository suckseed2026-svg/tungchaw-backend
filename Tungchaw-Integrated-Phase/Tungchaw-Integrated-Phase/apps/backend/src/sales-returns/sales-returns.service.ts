import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  SaleReturnItemCondition,
  SaleReturnStatus,
  SaleStatus,
  StockMovementType,
} from '../generated/prisma/client';
import { InventoryBatchesService } from '../inventory-batches/inventory-batches.service';
import { InventoryTransactionService } from '../inventory-transactions/inventory-transaction.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelSaleReturnDto } from './dto/cancel-sale-return.dto';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { SaleReturnQueryDto } from './dto/sale-return-query.dto';

interface CalculatedReturnItem {
  saleItemId: string;
  productId: string;
  lineNumber: number;
  productName: string;
  productCode: string;
  unitName: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  lineCost: Prisma.Decimal;
  profitImpact: Prisma.Decimal;
  condition: SaleReturnItemCondition;
  restock: boolean;
  itemReason: string | null;
}

@Injectable()
export class SalesReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryTransactions: InventoryTransactionService,
    private readonly inventoryBatches: InventoryBatchesService,
  ) {}

  async create(
    businessId: string,
    saleId: string,
    userId: string,
    dto: CreateSaleReturnDto,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const sale = await tx.sale.findFirst({
            where: {
              id: saleId,
              businessId,
            },
            include: {
              items: {
                orderBy: {
                  lineNumber: 'asc',
                },
              },
              returns: {
                where: {
                  status: SaleReturnStatus.COMPLETED,
                },
                include: {
                  items: true,
                },
              },
            },
          });

          if (!sale) {
            throw new NotFoundException('Sale not found');
          }

          if (sale.status !== SaleStatus.COMPLETED) {
            throw new BadRequestException(
              'Returns can only be created for completed sales',
            );
          }

          const requestedIds = dto.items.map((item) => item.saleItemId);

          if (new Set(requestedIds).size !== requestedIds.length) {
            throw new BadRequestException(
              'A sale item may appear only once in a return',
            );
          }

          const saleItemMap = new Map(
            sale.items.map((item) => [item.id, item]),
          );

          const previouslyReturned = new Map<string, Prisma.Decimal>();
          const previouslyRestocked = new Map<string, Prisma.Decimal>();

          for (const existingReturn of sale.returns) {
            for (const item of existingReturn.items) {
              previouslyReturned.set(
                item.saleItemId,
                (
                  previouslyReturned.get(item.saleItemId) ??
                  new Prisma.Decimal(0)
                ).plus(item.quantity),
              );

              if (item.restock) {
                previouslyRestocked.set(
                  item.saleItemId,
                  (
                    previouslyRestocked.get(item.saleItemId) ??
                    new Prisma.Decimal(0)
                  ).plus(item.quantity),
                );
              }
            }
          }

          let subtotal = new Prisma.Decimal(0);
          let discountAmount = new Prisma.Decimal(0);
          let taxAmount = new Prisma.Decimal(0);
          let totalAmount = new Prisma.Decimal(0);
          let costAmount = new Prisma.Decimal(0);
          let profitImpact = new Prisma.Decimal(0);

          const calculatedItems: CalculatedReturnItem[] = dto.items.map(
            (input, index) => {
              const saleItem = saleItemMap.get(input.saleItemId);

              if (!saleItem) {
                throw new BadRequestException(
                  'One or more return items do not belong to this sale',
                );
              }

              const quantity = this.quantity(input.quantity);
              const returned =
                previouslyReturned.get(saleItem.id) ?? new Prisma.Decimal(0);
              const available = saleItem.quantity.minus(returned);

              if (quantity.greaterThan(available)) {
                throw new BadRequestException(
                  `Return quantity for ${saleItem.productName} exceeds the remaining returnable quantity of ${available.toFixed(3)}`,
                );
              }

              const ratio = quantity.dividedBy(saleItem.quantity);

              const lineSubtotal = this.money(saleItem.lineSubtotal.mul(ratio));

              const itemDiscount = this.money(
                saleItem.discountAmount.mul(ratio),
              );

              const itemTax = this.money(saleItem.taxAmount.mul(ratio));

              const lineCost = this.money(saleItem.lineCost.mul(ratio));

              const allocatedBillDiscount = sale.totalAmount
                .plus(sale.billDiscount)
                .greaterThan(0)
                ? this.money(
                    sale.billDiscount
                      .mul(saleItem.lineTotal)
                      .dividedBy(sale.totalAmount.plus(sale.billDiscount))
                      .mul(ratio),
                  )
                : new Prisma.Decimal(0);

              const totalDiscount = itemDiscount.plus(allocatedBillDiscount);

              const lineTotal = this.money(
                lineSubtotal.minus(totalDiscount).plus(itemTax),
              );

              const itemProfitImpact = this.money(
                lineTotal.minus(itemTax).minus(lineCost),
              );

              const condition =
                input.condition ?? SaleReturnItemCondition.RESTOCKABLE;

              const restock =
                input.restock ??
                condition === SaleReturnItemCondition.RESTOCKABLE;

              if (
                restock &&
                condition !== SaleReturnItemCondition.RESTOCKABLE
              ) {
                throw new BadRequestException(
                  `Only RESTOCKABLE items can be restored to inventory (${saleItem.productName})`,
                );
              }

              subtotal = subtotal.plus(lineSubtotal);
              discountAmount = discountAmount.plus(totalDiscount);
              taxAmount = taxAmount.plus(itemTax);
              totalAmount = totalAmount.plus(lineTotal);
              costAmount = costAmount.plus(lineCost);
              profitImpact = profitImpact.plus(itemProfitImpact);

              return {
                saleItemId: saleItem.id,
                productId: saleItem.productId,
                lineNumber: index + 1,
                productName: saleItem.productName,
                productCode: saleItem.productCode,
                unitName: saleItem.unitName,
                quantity,
                unitCost: saleItem.unitCost,
                unitPrice: saleItem.finalUnitPrice,
                discountAmount: totalDiscount,
                taxAmount: itemTax,
                lineSubtotal,
                lineTotal,
                lineCost,
                profitImpact: itemProfitImpact,
                condition,
                restock,
                itemReason: input.itemReason?.trim() || null,
              };
            },
          );

          subtotal = this.money(subtotal);
          discountAmount = this.money(discountAmount);
          taxAmount = this.money(taxAmount);
          totalAmount = this.money(totalAmount);
          costAmount = this.money(costAmount);
          profitImpact = this.money(profitImpact);

          const refundAmount = this.money(dto.refundAmount ?? 0);

          const creditAdjustmentAmount = this.money(
            dto.creditAdjustmentAmount ?? 0,
          );

          if (!refundAmount.plus(creditAdjustmentAmount).equals(totalAmount)) {
            throw new BadRequestException(
              'Refund amount plus credit adjustment amount must exactly equal the return total',
            );
          }

          if (refundAmount.greaterThan(0) && !dto.refundMethod) {
            throw new BadRequestException(
              'Refund method is required when refund amount is greater than zero',
            );
          }

          if (refundAmount.equals(0) && dto.refundMethod) {
            throw new BadRequestException(
              'Refund method must be omitted when no refund is issued',
            );
          }

          if (dto.refundMethod === PaymentMethod.CREDIT_NOTE) {
            throw new BadRequestException(
              'Use creditAdjustmentAmount instead of CREDIT_NOTE refund method',
            );
          }

          if (creditAdjustmentAmount.greaterThan(0) && !sale.customerId) {
            throw new BadRequestException(
              'A customer is required for a credit adjustment',
            );
          }

          const previousFinancials = sale.returns.reduce(
            (accumulator, existingReturn) => ({
              refund: accumulator.refund.plus(existingReturn.refundAmount),
              credit: accumulator.credit.plus(
                existingReturn.creditAdjustmentAmount,
              ),
            }),
            {
              refund: new Prisma.Decimal(0),
              credit: new Prisma.Decimal(0),
            },
          );

          if (
            previousFinancials.refund
              .plus(refundAmount)
              .greaterThan(sale.paidAmount)
          ) {
            throw new BadRequestException(
              'Refund amount exceeds the remaining paid amount of the sale',
            );
          }

          if (
            previousFinancials.credit
              .plus(creditAdjustmentAmount)
              .greaterThan(sale.creditAmount)
          ) {
            throw new BadRequestException(
              'Credit adjustment exceeds the remaining credit amount of the sale',
            );
          }

          const returnDate = new Date();

          const returnNumber = await this.generateReturnNumber(
            tx,
            businessId,
            returnDate,
          );

          const saleReturn = await tx.saleReturn.create({
            data: {
              businessId,
              branchId: sale.branchId,
              saleId: sale.id,
              customerId: sale.customerId,
              createdById: userId,
              returnNumber,
              returnDate,
              subtotal,
              discountAmount,
              taxAmount,
              totalAmount,
              costAmount,
              profitImpact,
              refundAmount,
              creditAdjustmentAmount,
              refundMethod: dto.refundMethod ?? null,
              referenceNumber: dto.referenceNumber?.trim() || null,
              reason: dto.reason.trim(),
              notes: dto.notes?.trim() || null,
              items: {
                create: calculatedItems,
              },
            },
            select: {
              id: true,
            },
          });

          for (const item of calculatedItems) {
            if (!item.restock) {
              continue;
            }

            await this.inventoryTransactions.increaseStock(tx, {
              businessId,
              branchId: sale.branchId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              movementType: StockMovementType.SALE_RETURN,
              referenceType: 'SALE_RETURN',
              referenceId: saleReturn.id,
              reason: `Sale return ${returnNumber}`,
              notes: item.itemReason,
              createdById: userId,
              allowInactiveProduct: true,
            });

            await this.inventoryBatches.restoreFromSaleReturn(tx, {
              businessId,
              branchId: sale.branchId,
              saleItemId: item.saleItemId,
              productName: item.productName,
              quantity: item.quantity,
              previouslyRestoredQuantity:
                previouslyRestocked.get(item.saleItemId) ??
                new Prisma.Decimal(0),
            });
          }

          return tx.saleReturn.findUniqueOrThrow({
            where: {
              id: saleReturn.id,
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
          'Unable to generate a unique sale return number. Please retry.',
        );
      }

      throw error;
    }
  }

  async cancel(
    businessId: string,
    returnId: string,
    userId: string,
    dto: CancelSaleReturnDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const saleReturn = await tx.saleReturn.findFirst({
          where: {
            id: returnId,
            businessId,
          },
          include: {
            items: true,
          },
        });

        if (!saleReturn) {
          throw new NotFoundException('Sale return not found');
        }

        if (saleReturn.status !== SaleReturnStatus.COMPLETED) {
          throw new BadRequestException(
            'Only completed sale returns can be cancelled',
          );
        }

        for (const item of saleReturn.items) {
          if (!item.restock) {
            continue;
          }

          const newerRestockableReturn = await tx.saleReturnItem.findFirst({
            where: {
              saleItemId: item.saleItemId,
              restock: true,
              saleReturn: {
                businessId,
                status: SaleReturnStatus.COMPLETED,
                createdAt: {
                  gt: saleReturn.createdAt,
                },
              },
            },
            select: {
              id: true,
            },
          });

          if (newerRestockableReturn) {
            throw new BadRequestException(
              `This return cannot be cancelled because a newer restockable return exists for ${item.productName}`,
            );
          }

          const olderRestockedItems = await tx.saleReturnItem.findMany({
            where: {
              saleItemId: item.saleItemId,
              restock: true,
              saleReturnId: {
                not: saleReturn.id,
              },
              saleReturn: {
                businessId,
                status: SaleReturnStatus.COMPLETED,
                createdAt: {
                  lt: saleReturn.createdAt,
                },
              },
            },
            select: {
              quantity: true,
            },
          });

          const previouslyRestoredQuantity = olderRestockedItems.reduce(
            (total, previousItem) => total.plus(previousItem.quantity),
            new Prisma.Decimal(0),
          );

          await this.inventoryTransactions.decreaseStock(tx, {
            businessId,
            branchId: saleReturn.branchId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            movementType: StockMovementType.SALE,
            referenceType: 'SALE_RETURN_CANCELLATION',
            referenceId: saleReturn.id,
            reason: `Sale return cancelled: ${dto.reason.trim()}`,
            createdById: userId,
            allowInactiveProduct: true,
            insufficientStockMessage:
              `Cannot cancel return because available stock is lower than ` +
              `the restored quantity for ${item.productName}`,
          });

          await this.inventoryBatches.reverseSaleReturnRestoration(tx, {
            businessId,
            branchId: saleReturn.branchId,
            saleItemId: item.saleItemId,
            productName: item.productName,
            quantity: item.quantity,
            previouslyRestoredQuantity,
          });
        }

        return tx.saleReturn.update({
          where: {
            id: saleReturn.id,
          },
          data: {
            status: SaleReturnStatus.CANCELLED,
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

  async findAll(businessId: string, query: SaleReturnQueryDto) {
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

    const where: Prisma.SaleReturnWhereInput = {
      businessId,
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
      ...(query.branchId
        ? {
            branchId: query.branchId,
          }
        : {}),
      ...(query.customerId
        ? {
            customerId: query.customerId,
          }
        : {}),
      ...(query.saleId
        ? {
            saleId: query.saleId,
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            returnDate: date,
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                returnNumber: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                sale: {
                  saleNumber: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
              },
              {
                customer: {
                  name: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
              },
              {
                customer: {
                  phone: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.saleReturn.findMany({
        where,
        orderBy: [
          {
            returnDate: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: this.listSelect(),
      }),
      this.prisma.saleReturn.count({
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

  async findOne(businessId: string, returnId: string) {
    const saleReturn = await this.prisma.saleReturn.findFirst({
      where: {
        id: returnId,
        businessId,
      },
      select: this.detailsSelect(),
    });

    if (!saleReturn) {
      throw new NotFoundException('Sale return not found');
    }

    return saleReturn;
  }

  private async generateReturnNumber(
    tx: Prisma.TransactionClient,
    businessId: string,
    returnDate: Date,
  ): Promise<string> {
    const datePart = [
      returnDate.getUTCFullYear(),
      String(returnDate.getUTCMonth() + 1).padStart(2, '0'),
      String(returnDate.getUTCDate()).padStart(2, '0'),
    ].join('');

    const prefix = `SRT-${datePart}-`;

    const latest = await tx.saleReturn.findFirst({
      where: {
        businessId,
        returnNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        returnNumber: 'desc',
      },
      select: {
        returnNumber: true,
      },
    });

    const previous = latest
      ? Number.parseInt(latest.returnNumber.slice(prefix.length), 10)
      : 0;

    const nextNumber = Number.isFinite(previous) ? previous + 1 : 1;

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  private listSelect() {
    return {
      id: true,
      returnNumber: true,
      returnDate: true,
      status: true,
      totalAmount: true,
      refundAmount: true,
      creditAdjustmentAmount: true,
      profitImpact: true,
      reason: true,
      createdAt: true,
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      sale: {
        select: {
          id: true,
          saleNumber: true,
          saleDate: true,
          totalAmount: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          code: true,
          phone: true,
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
    } satisfies Prisma.SaleReturnSelect;
  }

  private detailsSelect() {
    return {
      ...this.listSelect(),
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      costAmount: true,
      refundMethod: true,
      referenceNumber: true,
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
    } satisfies Prisma.SaleReturnSelect;
  }

  private money(value: Prisma.Decimal | string | number): Prisma.Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(2);
  }

  private quantity(value: Prisma.Decimal | string | number): Prisma.Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(3);
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
