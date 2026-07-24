import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  PurchaseReturnStatus,
  PurchaseStatus,
  StockMovementType,
} from '../generated/prisma/client';
import { InventoryTransactionService } from '../inventory-transactions/inventory-transaction.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelPurchaseReturnDto } from './dto/cancel-purchase-return.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { PurchaseReturnQueryDto } from './dto/purchase-return-query.dto';

interface CalculatedPurchaseReturnItem {
  purchaseItemId: string;
  productId: string;
  lineNumber: number;
  productName: string;
  productCode: string;
  unitName: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  otherCharges: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  batchNumber: string | null;
  expiryDate: Date | null;
  itemReason: string | null;
}

@Injectable()
export class PurchaseReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryTransactions: InventoryTransactionService,
  ) {}

  async create(
    businessId: string,
    purchaseId: string,
    userId: string,
    dto: CreatePurchaseReturnDto,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const purchase = await tx.purchase.findFirst({
            where: { id: purchaseId, businessId },
            include: {
              items: {
                orderBy: { lineNumber: 'asc' },
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      unit: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
              returns: {
                where: {
                  status: PurchaseReturnStatus.COMPLETED,
                },
                include: {
                  items: true,
                },
              },
            },
          });

          if (!purchase) {
            throw new NotFoundException('Purchase not found');
          }

          if (purchase.status !== PurchaseStatus.RECEIVED) {
            throw new BadRequestException(
              'Returns can only be created for received purchases',
            );
          }

          const requestedIds = dto.items.map(
            (item) => item.purchaseItemId,
          );

          if (new Set(requestedIds).size !== requestedIds.length) {
            throw new BadRequestException(
              'A purchase item may appear only once in a return',
            );
          }

          const purchaseItemMap = new Map(
            purchase.items.map((item) => [item.id, item]),
          );

          const previouslyReturned = new Map<
            string,
            Prisma.Decimal
          >();

          for (const existingReturn of purchase.returns) {
            for (const item of existingReturn.items) {
              previouslyReturned.set(
                item.purchaseItemId,
                (
                  previouslyReturned.get(item.purchaseItemId) ??
                  new Prisma.Decimal(0)
                ).plus(item.quantity),
              );
            }
          }

          const purchaseItemsTotal = purchase.items.reduce(
            (total, item) => total.plus(item.lineTotal),
            new Prisma.Decimal(0),
          );

          let subtotal = new Prisma.Decimal(0);
          let discountAmount = new Prisma.Decimal(0);
          let taxAmount = new Prisma.Decimal(0);
          let otherCharges = new Prisma.Decimal(0);
          let totalAmount = new Prisma.Decimal(0);

          const calculatedItems: CalculatedPurchaseReturnItem[] =
            dto.items.map((input, index) => {
              const purchaseItem = purchaseItemMap.get(
                input.purchaseItemId,
              );

              if (!purchaseItem) {
                throw new BadRequestException(
                  'One or more return items do not belong to this purchase',
                );
              }

              const quantity = this.quantity(input.quantity);

              const returned =
                previouslyReturned.get(purchaseItem.id) ??
                new Prisma.Decimal(0);

              const available =
                purchaseItem.quantity.minus(returned);

              if (quantity.greaterThan(available)) {
                throw new BadRequestException(
                  `Return quantity for ${purchaseItem.product.name} exceeds the remaining returnable quantity of ${available.toFixed(3)}`,
                );
              }

              const ratio = quantity.dividedBy(
                purchaseItem.quantity,
              );

              const lineSubtotal = this.money(
                purchaseItem.unitCost.mul(quantity),
              );

              const itemDiscount = this.money(
                purchaseItem.discountAmount.mul(ratio),
              );

              const itemTax = this.money(
                purchaseItem.taxAmount.mul(ratio),
              );

              const allocatedOtherCharges =
                purchaseItemsTotal.greaterThan(0)
                  ? this.money(
                      purchase.otherCharges
                        .mul(purchaseItem.lineTotal)
                        .dividedBy(purchaseItemsTotal)
                        .mul(ratio),
                    )
                  : new Prisma.Decimal(0);

              const lineTotal = this.money(
                lineSubtotal
                  .minus(itemDiscount)
                  .plus(itemTax)
                  .plus(allocatedOtherCharges),
              );

              subtotal = subtotal.plus(lineSubtotal);
              discountAmount =
                discountAmount.plus(itemDiscount);
              taxAmount = taxAmount.plus(itemTax);
              otherCharges = otherCharges.plus(
                allocatedOtherCharges,
              );
              totalAmount = totalAmount.plus(lineTotal);

              return {
                purchaseItemId: purchaseItem.id,
                productId: purchaseItem.productId,
                lineNumber: index + 1,
                productName: purchaseItem.product.name,
                productCode: purchaseItem.product.code,
                unitName: purchaseItem.product.unit.name,
                quantity,
                unitCost: purchaseItem.unitCost,
                discountAmount: itemDiscount,
                taxAmount: itemTax,
                otherCharges: allocatedOtherCharges,
                lineSubtotal,
                lineTotal,
                batchNumber: purchaseItem.batchNumber,
                expiryDate: purchaseItem.expiryDate,
                itemReason:
                  input.itemReason?.trim() || null,
              };
            });

          subtotal = this.money(subtotal);
          discountAmount = this.money(discountAmount);
          taxAmount = this.money(taxAmount);
          otherCharges = this.money(otherCharges);
          totalAmount = this.money(totalAmount);

          const refundAmount = this.money(
            dto.refundAmount ?? 0,
          );

          const creditAdjustmentAmount = this.money(
            dto.creditAdjustmentAmount ?? 0,
          );

          if (
            !refundAmount
              .plus(creditAdjustmentAmount)
              .equals(totalAmount)
          ) {
            throw new BadRequestException(
              'Refund amount plus credit adjustment amount must exactly equal the return total',
            );
          }

          if (
            refundAmount.greaterThan(0) &&
            !dto.refundMethod
          ) {
            throw new BadRequestException(
              'Refund method is required when refund amount is greater than zero',
            );
          }

          if (
            refundAmount.equals(0) &&
            dto.refundMethod
          ) {
            throw new BadRequestException(
              'Refund method must be omitted when no refund is issued',
            );
          }

          if (
            dto.refundMethod === PaymentMethod.CREDIT_NOTE
          ) {
            throw new BadRequestException(
              'Use creditAdjustmentAmount instead of CREDIT_NOTE refund method',
            );
          }

          const returnDate = new Date();

          const returnNumber =
            await this.generateReturnNumber(
              tx,
              businessId,
              returnDate,
            );

          const purchaseReturn =
            await tx.purchaseReturn.create({
              data: {
                businessId,
                branchId: purchase.branchId,
                purchaseId: purchase.id,
                supplierId: purchase.supplierId,
                createdById: userId,
                returnNumber,
                returnDate,
                subtotal,
                discountAmount,
                taxAmount,
                otherCharges,
                totalAmount,
                refundAmount,
                creditAdjustmentAmount,
                refundMethod:
                  dto.refundMethod ?? null,
                referenceNumber:
                  dto.referenceNumber?.trim() || null,
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
            await this.inventoryTransactions.decreaseStock(
              tx,
              {
                businessId,
                branchId: purchase.branchId,
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                movementType:
                  StockMovementType.PURCHASE_RETURN,
                referenceType: 'PURCHASE_RETURN',
                referenceId: purchaseReturn.id,
                reason: `Purchase return ${returnNumber}`,
                notes: item.itemReason,
                createdById: userId,
                allowInactiveProduct: true,
              },
            );
          }

          return tx.purchaseReturn.findUniqueOrThrow({
            where: {
              id: purchaseReturn.id,
            },
            select: this.detailsSelect(),
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
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
          'Unable to generate a unique purchase return number. Please retry.',
        );
      }

      throw error;
    }
  }

  async cancel(
    businessId: string,
    returnId: string,
    userId: string,
    dto: CancelPurchaseReturnDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const purchaseReturn =
          await tx.purchaseReturn.findFirst({
            where: {
              id: returnId,
              businessId,
            },
            include: {
              items: true,
            },
          });

        if (!purchaseReturn) {
          throw new NotFoundException(
            'Purchase return not found',
          );
        }

        if (
          purchaseReturn.status !==
          PurchaseReturnStatus.COMPLETED
        ) {
          throw new BadRequestException(
            'Only completed purchase returns can be cancelled',
          );
        }

        for (const item of purchaseReturn.items) {
          await this.inventoryTransactions.increaseStock(
            tx,
            {
              businessId,
              branchId: purchaseReturn.branchId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              movementType: StockMovementType.PURCHASE,
              referenceType:
                'PURCHASE_RETURN_CANCELLATION',
              referenceId: purchaseReturn.id,
              reason: `Purchase return cancelled: ${dto.reason.trim()}`,
              createdById: userId,
              allowInactiveProduct: true,
            },
          );
        }

        return tx.purchaseReturn.update({
          where: {
            id: purchaseReturn.id,
          },
          data: {
            status: PurchaseReturnStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledById: userId,
            cancellationReason: dto.reason.trim(),
          },
          select: this.detailsSelect(),
        });
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async findAll(
    businessId: string,
    query: PurchaseReturnQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (
      query.dateFrom &&
      query.dateTo &&
      new Date(query.dateFrom) >
        new Date(query.dateTo)
    ) {
      throw new BadRequestException(
        'dateFrom cannot be after dateTo',
      );
    }

    const date: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      date.gte = this.startOfDay(query.dateFrom);
    }

    if (query.dateTo) {
      date.lte = this.endOfDay(query.dateTo);
    }

    const search = query.search?.trim();

    const where: Prisma.PurchaseReturnWhereInput = {
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

      ...(query.supplierId
        ? {
            supplierId: query.supplierId,
          }
        : {}),

      ...(query.purchaseId
        ? {
            purchaseId: query.purchaseId,
          }
        : {}),

      ...(query.dateFrom || query.dateTo
        ? {
            returnDate: date,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                returnNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                purchase: {
                  invoiceNumber: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                purchase: {
                  supplierInvoiceNumber: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                supplier: {
                  name: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                supplier: {
                  code: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                supplier: {
                  phone: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] =
      await this.prisma.$transaction([
        this.prisma.purchaseReturn.findMany({
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
        this.prisma.purchaseReturn.count({
          where,
        }),
      ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages:
          total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    businessId: string,
    returnId: string,
  ) {
    const purchaseReturn =
      await this.prisma.purchaseReturn.findFirst({
        where: {
          id: returnId,
          businessId,
        },
        select: this.detailsSelect(),
      });

    if (!purchaseReturn) {
      throw new NotFoundException(
        'Purchase return not found',
      );
    }

    return purchaseReturn;
  }

  private async generateReturnNumber(
    tx: Prisma.TransactionClient,
    businessId: string,
    returnDate: Date,
  ): Promise<string> {
    const datePart = [
      returnDate.getUTCFullYear(),
      String(returnDate.getUTCMonth() + 1).padStart(
        2,
        '0',
      ),
      String(returnDate.getUTCDate()).padStart(2, '0'),
    ].join('');

    const prefix = `PRT-${datePart}-`;

    const latest =
      await tx.purchaseReturn.findFirst({
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
      ? Number.parseInt(
          latest.returnNumber.slice(prefix.length),
          10,
        )
      : 0;

    return `${prefix}${String(
      Number.isFinite(previous) ? previous + 1 : 1,
    ).padStart(5, '0')}`;
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
      reason: true,
      createdAt: true,

      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },

      purchase: {
        select: {
          id: true,
          invoiceNumber: true,
          supplierInvoiceNumber: true,
          purchaseDate: true,
          totalAmount: true,
        },
      },

      supplier: {
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
    } satisfies Prisma.PurchaseReturnSelect;
  }

  private detailsSelect() {
    return {
      ...this.listSelect(),

      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      otherCharges: true,
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
    } satisfies Prisma.PurchaseReturnSelect;
  }

  private money(
    value: Prisma.Decimal | string | number,
  ): Prisma.Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(2);
  }

  private quantity(
    value: Prisma.Decimal | string | number,
  ): Prisma.Decimal {
    const quantity = new Prisma.Decimal(
      value,
    ).toDecimalPlaces(3);

    if (
      !quantity.isFinite() ||
      quantity.lessThanOrEqualTo(0)
    ) {
      throw new BadRequestException(
        'Purchase return quantity must be greater than zero',
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

  private isUniqueConstraintError(
    error: unknown,
  ): boolean {
    return (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}