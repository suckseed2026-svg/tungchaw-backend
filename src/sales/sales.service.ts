import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  SaleActivityType,
  SalePaymentStatus,
  SaleStatus,
  StockMovementType,
} from '../generated/prisma/client';
import { InventoryTransactionService } from '../inventory-transactions/inventory-transaction.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CompleteSaleDto } from './dto/complete-sale.dto';
import { CreateSaleDraftDto } from './dto/create-sale-draft.dto';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import { SaleQueryDto } from './dto/sale-query.dto';
import { UpdateSaleDraftDto } from './dto/update-sale-draft.dto';

interface CalculatedItem {
  lineNumber: number;
  productId: string;
  productName: string;
  productCode: string;
  barcode: string | null;
  unitName: string;
  brandName: string | null;
  categoryName: string | null;
  quantity: Prisma.Decimal;
  freeQuantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  originalUnitPrice: Prisma.Decimal;
  finalUnitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  lineCost: Prisma.Decimal;
  lineProfit: Prisma.Decimal;
  priceOverrideReason: string | null;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryTransactionService: InventoryTransactionService,
  ) {}

  async createDraft(
    businessId: string,
    userId: string,
    dto: CreateSaleDraftDto,
  ) {
    await this.validateBranch(businessId, dto.branchId);
    await this.validateCustomer(businessId, dto.customerId);

    const calculated = await this.calculateItems(businessId, dto.items);

    const saleNumber = await this.nextSaleNumber(businessId);

    return this.prisma.sale.create({
      data: {
        businessId,
        branchId: dto.branchId,
        customerId: dto.customerId ?? null,
        createdById: userId,
        saleNumber,
        saleDate: new Date(),
        source: dto.source,
        subtotal: calculated.subtotal,
        itemDiscountTotal: calculated.itemDiscountTotal,
        taxAmount: calculated.taxAmount,
        totalAmount: calculated.totalAmount,
        costTotal: calculated.costTotal,
        grossProfit: calculated.grossProfit,
        notes: dto.notes?.trim() || null,
        items: {
          create: calculated.items,
        },
        activities: {
          create: {
            businessId,
            actorId: userId,
            type: SaleActivityType.CREATED,
            description: 'Draft sale created',
          },
        },
      },
      select: this.detailsSelect(),
    });
  }

  async updateDraft(
    businessId: string,
    saleId: string,
    userId: string,
    dto: UpdateSaleDraftDto,
  ) {
    const existing = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId,
      },
      include: {
        items: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Sale not found');
    }

    if (existing.status !== SaleStatus.DRAFT) {
      throw new BadRequestException('Only draft sales can be updated');
    }

    const branchId = dto.branchId ?? existing.branchId;

    const customerId =
      dto.customerId === undefined ? existing.customerId : dto.customerId;

    await this.validateBranch(businessId, branchId);

    await this.validateCustomer(businessId, customerId ?? undefined);

    const effectiveItems: CreateSaleItemDto[] =
      dto.items ??
      existing.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: Number(item.finalUnitPrice),
        discountAmount: Number(item.discountAmount),
        taxAmount: Number(item.taxAmount),
        priceOverrideReason: item.priceOverrideReason ?? undefined,
      }));

    const calculated = await this.calculateItems(businessId, effectiveItems);

    return this.prisma.$transaction(async (tx) => {
      await tx.saleItem.deleteMany({
        where: {
          saleId,
        },
      });

      return tx.sale.update({
        where: {
          id: saleId,
        },
        data: {
          branchId,
          customerId: customerId ?? null,
          source: dto.source ?? existing.source,
          notes:
            dto.notes === undefined
              ? existing.notes
              : dto.notes?.trim() || null,
          subtotal: calculated.subtotal,
          itemDiscountTotal: calculated.itemDiscountTotal,
          taxAmount: calculated.taxAmount,
          totalAmount: calculated.totalAmount,
          costTotal: calculated.costTotal,
          grossProfit: calculated.grossProfit,
          items: {
            create: calculated.items,
          },
          activities: {
            create: {
              businessId,
              actorId: userId,
              type: SaleActivityType.UPDATED,
              description: 'Draft sale updated',
            },
          },
        },
        select: this.detailsSelect(),
      });
    });
  }

  async complete(
    businessId: string,
    saleId: string,
    userId: string,
    dto: CompleteSaleDto,
  ) {
    return this.prisma.$transaction(
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
            customer: true,
          },
        });

        if (!sale) {
          throw new NotFoundException('Sale not found');
        }

        if (sale.status !== SaleStatus.DRAFT) {
          throw new BadRequestException('Only draft sales can be completed');
        }

        if (sale.items.length === 0) {
          throw new BadRequestException('Sale has no items');
        }

        const billDiscount = this.money(dto.billDiscount ?? 0);

        if (billDiscount.greaterThan(sale.totalAmount)) {
          throw new BadRequestException(
            'Bill discount cannot exceed the sale total',
          );
        }

        const finalTotal = sale.totalAmount.minus(billDiscount);

        const creditAmount = this.money(dto.creditAmount ?? 0);

        if (creditAmount.greaterThan(0) && !sale.customerId) {
          throw new BadRequestException(
            'A customer is required for a credit sale',
          );
        }

        if (
          sale.customer &&
          creditAmount.greaterThan(sale.customer.creditLimit)
        ) {
          throw new BadRequestException(
            'Credit amount exceeds the customer credit limit',
          );
        }

        let paidAmount = new Prisma.Decimal(0);
        let totalChange = new Prisma.Decimal(0);

        for (const payment of dto.payments) {
          if (payment.paymentMethod === PaymentMethod.CREDIT_NOTE) {
            throw new BadRequestException(
              'CREDIT_NOTE is not supported for normal sale completion',
            );
          }

          const amount = this.money(payment.amount);

          paidAmount = paidAmount.plus(amount);

          if (
            payment.paymentMethod === PaymentMethod.CASH &&
            payment.tenderedAmount !== undefined
          ) {
            const tendered = this.money(payment.tenderedAmount);

            if (tendered.lessThan(amount)) {
              throw new BadRequestException(
                'Tendered cash cannot be less than payment amount',
              );
            }

            totalChange = totalChange.plus(tendered.minus(amount));
          }
        }

        if (!paidAmount.plus(creditAmount).equals(finalTotal)) {
          throw new BadRequestException(
            'Payments plus credit amount must exactly equal the sale total',
          );
        }

        for (const item of sale.items) {
          await this.inventoryTransactionService.decreaseStock(tx, {
            businessId,
            branchId: sale.branchId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity.plus(item.freeQuantity),
            movementType: StockMovementType.SALE,
            referenceType: 'SALE',
            referenceId: sale.id,
            reason: 'Sale completed',
            createdById: userId,
          });
        }

        const now = new Date();

        for (let index = 0; index < dto.payments.length; index += 1) {
          const payment = dto.payments[index];

          const amount = this.money(payment.amount);

          const tendered =
            payment.tenderedAmount === undefined
              ? null
              : this.money(payment.tenderedAmount);

          const change =
            payment.paymentMethod === PaymentMethod.CASH && tendered
              ? tendered.minus(amount)
              : new Prisma.Decimal(0);

          await tx.salePayment.create({
            data: {
              businessId,
              saleId: sale.id,
              branchId: sale.branchId,
              createdById: userId,
              paymentNumber: `${sale.saleNumber}-PAY-${String(
                index + 1,
              ).padStart(2, '0')}`,
              paymentDate: now,
              paymentMethod: payment.paymentMethod,
              amount,
              tenderedAmount: tendered,
              changeAmount: change,
              referenceNumber: payment.referenceNumber?.trim() || null,
              notes: payment.notes?.trim() || null,
            },
          });
        }

        const paymentStatus = paidAmount.equals(0)
          ? SalePaymentStatus.UNPAID
          : paidAmount.equals(finalTotal)
            ? SalePaymentStatus.PAID
            : SalePaymentStatus.PARTIALLY_PAID;

        return tx.sale.update({
          where: {
            id: sale.id,
          },
          data: {
            status: SaleStatus.COMPLETED,
            paymentStatus,
            billDiscount,
            totalAmount: finalTotal,
            paidAmount,
            creditAmount,
            changeAmount: totalChange,
            grossProfit: sale.grossProfit.minus(billDiscount),
            completedAt: now,
            activities: {
              create: {
                businessId,
                actorId: userId,
                type: SaleActivityType.COMPLETED,
                description: 'Sale completed',
                metadata: {
                  paidAmount: paidAmount.toString(),
                  creditAmount: creditAmount.toString(),
                },
              },
            },
          },
          select: this.detailsSelect(),
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async cancel(
    businessId: string,
    saleId: string,
    userId: string,
    dto: CancelSaleDto,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId,
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft sales can be cancelled in Sales V1',
      );
    }

    return this.prisma.sale.update({
      where: {
        id: saleId,
      },
      data: {
        status: SaleStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: userId,
        cancellationReason: dto.reason.trim(),
        activities: {
          create: {
            businessId,
            actorId: userId,
            type: SaleActivityType.CANCELLED,
            description: dto.reason.trim(),
          },
        },
      },
      select: this.detailsSelect(),
    });
  }

  async findOne(businessId: string, saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId,
      },
      select: this.detailsSelect(),
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return sale;
  }

  async findAll(businessId: string, query: SaleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const date: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      date.gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      const dateTo = new Date(query.dateTo);

      dateTo.setUTCHours(23, 59, 59, 999);

      date.lte = dateTo;
    }

    const where: Prisma.SaleWhereInput = {
      businessId,

      ...(query.status
        ? {
            status: query.status,
          }
        : {}),

      ...(query.paymentStatus
        ? {
            paymentStatus: query.paymentStatus,
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

      ...(query.dateFrom || query.dateTo
        ? {
            saleDate: date,
          }
        : {}),

      ...(query.search
        ? {
            OR: [
              {
                saleNumber: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
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
      this.prisma.sale.findMany({
        where,
        orderBy: [
          {
            saleDate: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: this.listSelect(),
      }),

      this.prisma.sale.count({
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

  private async calculateItems(businessId: string, items: CreateSaleItemDto[]) {
    const ids = [...new Set(items.map((item) => item.productId))];

    if (ids.length !== items.length) {
      throw new BadRequestException('A product may appear only once in a sale');
    }

    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        id: {
          in: ids,
        },
        isActive: true,
      },
      include: {
        unit: true,
        brand: true,
        category: true,
      },
    });

    if (products.length !== ids.length) {
      throw new BadRequestException(
        'One or more products are invalid or inactive',
      );
    }

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    let subtotal = new Prisma.Decimal(0);
    let discounts = new Prisma.Decimal(0);
    let taxes = new Prisma.Decimal(0);
    let total = new Prisma.Decimal(0);
    let cost = new Prisma.Decimal(0);
    let profit = new Prisma.Decimal(0);

    const calculated: CalculatedItem[] = items.map((item, index) => {
      const product = productMap.get(item.productId)!;

      const quantity = this.quantity(item.quantity);

      const original = this.money(product.sellingPrice);

      const finalPrice = this.money(item.unitPrice ?? product.sellingPrice);

      const discount = this.money(item.discountAmount ?? 0);

      const tax = this.money(item.taxAmount ?? 0);

      const lineSubtotal = finalPrice.mul(quantity).toDecimalPlaces(2);

      if (discount.greaterThan(lineSubtotal.plus(tax))) {
        throw new BadRequestException(
          `Discount is too large for ${product.name}`,
        );
      }

      const lineTotal = lineSubtotal
        .minus(discount)
        .plus(tax)
        .toDecimalPlaces(2);

      const lineCost = this.money(product.costPrice)
        .mul(quantity)
        .toDecimalPlaces(2);

      const lineProfit = lineTotal
        .minus(tax)
        .minus(lineCost)
        .toDecimalPlaces(2);

      subtotal = subtotal.plus(lineSubtotal);
      discounts = discounts.plus(discount);
      taxes = taxes.plus(tax);
      total = total.plus(lineTotal);
      cost = cost.plus(lineCost);
      profit = profit.plus(lineProfit);

      return {
        lineNumber: index + 1,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        barcode: product.barcode,
        unitName: product.unit.name,
        brandName: product.brand?.name ?? null,
        categoryName: product.category?.name ?? null,
        quantity,
        freeQuantity: new Prisma.Decimal(0),
        unitCost: this.money(product.costPrice),
        originalUnitPrice: original,
        finalUnitPrice: finalPrice,
        discountAmount: discount,
        taxAmount: tax,
        lineSubtotal,
        lineTotal,
        lineCost,
        lineProfit,
        priceOverrideReason: finalPrice.equals(original)
          ? null
          : item.priceOverrideReason?.trim() || 'Manual price override',
      };
    });

    return {
      items: calculated,
      subtotal,
      itemDiscountTotal: discounts,
      taxAmount: taxes,
      totalAmount: total,
      costTotal: cost,
      grossProfit: profit,
    };
  }

  private async validateBranch(businessId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        businessId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!branch) {
      throw new BadRequestException('Branch is invalid or inactive');
    }
  }

  private async validateCustomer(
    businessId: string,
    customerId?: string | null,
  ) {
    if (!customerId) {
      return;
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new BadRequestException('Customer is invalid or inactive');
    }
  }

  private async nextSaleNumber(businessId: string) {
    const today = new Date();

    const stamp = `${today.getUTCFullYear()}${String(
      today.getUTCMonth() + 1,
    ).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`;

    const startOfToday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const count = await this.prisma.sale.count({
      where: {
        businessId,
        saleDate: {
          gte: startOfToday,
        },
      },
    });

    return `SAL-${stamp}-${String(count + 1).padStart(5, '0')}`;
  }

  private money(value: Prisma.Decimal | string | number) {
    return new Prisma.Decimal(value).toDecimalPlaces(2);
  }

  private quantity(value: Prisma.Decimal | string | number) {
    return new Prisma.Decimal(value).toDecimalPlaces(3);
  }

  private listSelect() {
    return {
      id: true,
      saleNumber: true,
      saleDate: true,
      status: true,
      paymentStatus: true,
      source: true,
      totalAmount: true,
      paidAmount: true,
      creditAmount: true,
      grossProfit: true,
      createdAt: true,

      branch: {
        select: {
          id: true,
          name: true,
          code: true,
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
          payments: true,
        },
      },
    } satisfies Prisma.SaleSelect;
  }

  private detailsSelect() {
    return {
      ...this.listSelect(),

      subtotal: true,
      itemDiscountTotal: true,
      billDiscount: true,
      taxAmount: true,
      changeAmount: true,
      costTotal: true,
      notes: true,
      completedAt: true,
      cancelledAt: true,
      cancellationReason: true,
      updatedAt: true,

      items: {
        orderBy: {
          lineNumber: 'asc' as const,
        },
        include: {
          priceApprovedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },

      payments: {
        orderBy: {
          paymentDate: 'asc' as const,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },

      activities: {
        orderBy: {
          createdAt: 'asc' as const,
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },

      cancelledBy: {
        select: {
          id: true,
          name: true,
        },
      },
    } satisfies Prisma.SaleSelect;
  }
}
