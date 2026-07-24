import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseStatus,
  StockMovementType,
} from '../generated/prisma/client';
import { InventoryTransactionService } from '../inventory-transactions/inventory-transaction.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseItemDto } from './dto/create-purchase-item.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseQueryDto } from './dto/purchase-query.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

interface CalculatedPurchaseItem {
  lineNumber: number;
  productId: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  batchNumber: string | null;
  manufacturedAt: Date | null;
  expiryDate: Date | null;
}

interface CalculatedPurchaseTotals {
  items: CalculatedPurchaseItem[];
  subtotal: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryTransactions: InventoryTransactionService,
  ) {}

  async create(
    businessId: string,
    createdById: string,
    dto: CreatePurchaseDto,
  ) {
    const invoiceNumber = dto.invoiceNumber.trim().toUpperCase();
    const supplierInvoiceNumber = dto.supplierInvoiceNumber?.trim() || null;

    await this.validateBranch(businessId, dto.branchId);
    await this.validateSupplier(businessId, dto.supplierId);
    await this.validateProducts(businessId, dto.items);

    const existingPurchase = await this.prisma.purchase.findUnique({
      where: {
        businessId_invoiceNumber: {
          businessId,
          invoiceNumber,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingPurchase) {
      throw new ConflictException(
        'Purchase invoice number already exists in this business',
      );
    }

    const discountAmount = this.money(dto.discountAmount ?? 0);
    const taxAmount = this.money(dto.taxAmount ?? 0);
    const otherCharges = this.money(dto.otherCharges ?? 0);

    const calculated = this.calculatePurchase(
      dto.items,
      discountAmount,
      taxAmount,
      otherCharges,
    );

    try {
      return await this.prisma.purchase.create({
        data: {
          businessId,
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          createdById,
          invoiceNumber,
          supplierInvoiceNumber,
          purchaseDate: new Date(dto.purchaseDate),
          status: PurchaseStatus.DRAFT,
          subtotal: calculated.subtotal,
          discountAmount,
          taxAmount,
          otherCharges,
          totalAmount: calculated.totalAmount,
          notes: dto.notes?.trim() || null,
          items: {
            create: calculated.items,
          },
        },
        select: this.purchaseDetailsSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Purchase invoice number already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create purchase at this time',
      );
    }
  }

  async findAll(businessId: string, query: PurchaseQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const purchaseDateFilter: Prisma.DateTimeFilter = {};

    if (query.dateFrom) {
      purchaseDateFilter.gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      const dateTo = new Date(query.dateTo);
      dateTo.setUTCHours(23, 59, 59, 999);
      purchaseDateFilter.lte = dateTo;
    }

    const where: Prisma.PurchaseWhereInput = {
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

      ...(query.dateFrom || query.dateTo
        ? {
            purchaseDate: purchaseDateFilter,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                supplierInvoiceNumber: {
                  contains: search,
                  mode: 'insensitive',
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
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        where,
        orderBy: [
          {
            purchaseDate: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
        skip,
        take: limit,
        select: this.purchaseListSelect(),
      }),
      this.prisma.purchase.count({
        where,
      }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(businessId: string, purchaseId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId,
      },
      select: this.purchaseDetailsSelect(),
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  async update(businessId: string, purchaseId: string, dto: UpdatePurchaseDto) {
    const existingPurchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId,
      },
      include: {
        items: {
          orderBy: {
            lineNumber: 'asc',
          },
        },
      },
    });

    if (!existingPurchase) {
      throw new NotFoundException('Purchase not found');
    }

    if (existingPurchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Only draft purchases can be updated');
    }

    const branchId = dto.branchId ?? existingPurchase.branchId;
    const supplierId = dto.supplierId ?? existingPurchase.supplierId;

    await this.validateBranch(businessId, branchId);
    await this.validateSupplier(businessId, supplierId);

    const invoiceNumber =
      dto.invoiceNumber !== undefined
        ? dto.invoiceNumber.trim().toUpperCase()
        : existingPurchase.invoiceNumber;

    if (invoiceNumber !== existingPurchase.invoiceNumber) {
      const conflictingPurchase = await this.prisma.purchase.findFirst({
        where: {
          businessId,
          invoiceNumber,
          id: {
            not: purchaseId,
          },
        },
        select: {
          id: true,
        },
      });

      if (conflictingPurchase) {
        throw new ConflictException(
          'Purchase invoice number already exists in this business',
        );
      }
    }

    const effectiveItems: CreatePurchaseItemDto[] =
      dto.items !== undefined
        ? dto.items
        : existingPurchase.items.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
            discountAmount: Number(item.discountAmount),
            taxAmount: Number(item.taxAmount),
            batchNumber: item.batchNumber ?? undefined,
            manufacturedAt: item.manufacturedAt?.toISOString(),
            expiryDate: item.expiryDate?.toISOString(),
          }));

    await this.validateProducts(businessId, effectiveItems);

    const discountAmount =
      dto.discountAmount !== undefined
        ? this.money(dto.discountAmount)
        : existingPurchase.discountAmount;

    const taxAmount =
      dto.taxAmount !== undefined
        ? this.money(dto.taxAmount)
        : existingPurchase.taxAmount;

    const otherCharges =
      dto.otherCharges !== undefined
        ? this.money(dto.otherCharges)
        : existingPurchase.otherCharges;

    const calculated = this.calculatePurchase(
      effectiveItems,
      discountAmount,
      taxAmount,
      otherCharges,
    );

    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (dto.items !== undefined) {
          await transaction.purchaseItem.deleteMany({
            where: {
              purchaseId,
            },
          });
        }

        return transaction.purchase.update({
          where: {
            id: purchaseId,
          },
          data: {
            branchId,
            supplierId,
            invoiceNumber,

            ...(dto.supplierInvoiceNumber !== undefined
              ? {
                  supplierInvoiceNumber:
                    dto.supplierInvoiceNumber.trim() || null,
                }
              : {}),

            ...(dto.purchaseDate !== undefined
              ? {
                  purchaseDate: new Date(dto.purchaseDate),
                }
              : {}),

            subtotal: calculated.subtotal,
            discountAmount,
            taxAmount,
            otherCharges,
            totalAmount: calculated.totalAmount,

            ...(dto.notes !== undefined
              ? {
                  notes: dto.notes.trim() || null,
                }
              : {}),

            ...(dto.items !== undefined
              ? {
                  items: {
                    create: calculated.items,
                  },
                }
              : {}),
          },
          select: this.purchaseDetailsSelect(),
        });
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Purchase invoice number already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to update purchase at this time',
      );
    }
  }

  async receive(businessId: string, purchaseId: string, receivedById: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        const purchase = await transaction.purchase.findFirst({
          where: {
            id: purchaseId,
            businessId,
          },
          include: {
            branch: {
              select: {
                id: true,
                isActive: true,
              },
            },
            supplier: {
              select: {
                id: true,
                isActive: true,
              },
            },
            items: {
              orderBy: {
                lineNumber: 'asc',
              },
              include: {
                product: {
                  select: {
                    id: true,
                    businessId: true,
                    name: true,
                    isActive: true,
                    trackStock: true,
                  },
                },
              },
            },
          },
        });

        if (!purchase) {
          throw new NotFoundException('Purchase not found');
        }

        if (purchase.status === PurchaseStatus.RECEIVED) {
          throw new BadRequestException('Purchase has already been received');
        }

        if (purchase.status === PurchaseStatus.CANCELLED) {
          throw new BadRequestException(
            'Cancelled purchases cannot be received',
          );
        }

        if (!purchase.branch.isActive) {
          throw new BadRequestException('The selected branch is inactive');
        }

        if (!purchase.supplier.isActive) {
          throw new BadRequestException('The selected supplier is inactive');
        }

        if (purchase.items.length === 0) {
          throw new BadRequestException(
            'Purchase must contain at least one item',
          );
        }

        for (const item of purchase.items) {
          if (
            item.product.businessId !== businessId ||
            !item.product.isActive
          ) {
            throw new BadRequestException(
              `Product ${item.product.name} is inactive or does not belong to the selected business`,
            );
          }

          await this.inventoryTransactions.increaseStock(transaction, {
            businessId,
            branchId: purchase.branchId,
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            movementType: StockMovementType.PURCHASE,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            reason: `Purchase ${purchase.invoiceNumber} received`,
            notes: purchase.notes,
            createdById: receivedById,
          });
        }

        return transaction.purchase.update({
          where: {
            id: purchase.id,
          },
          data: {
            status: PurchaseStatus.RECEIVED,
            receivedAt: new Date(),
          },
          select: this.purchaseDetailsSelect(),
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async cancel(businessId: string, purchaseId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    if (purchase.status === PurchaseStatus.RECEIVED) {
      throw new BadRequestException(
        'Received purchases cannot be cancelled through this endpoint',
      );
    }

    if (purchase.status === PurchaseStatus.CANCELLED) {
      return this.findOne(businessId, purchaseId);
    }

    return this.prisma.purchase.update({
      where: {
        id: purchaseId,
      },
      data: {
        status: PurchaseStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      select: this.purchaseDetailsSelect(),
    });
  }

  private async validateBranch(
    businessId: string,
    branchId: string,
  ): Promise<void> {
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
      throw new BadRequestException(
        'Branch does not exist, is inactive, or does not belong to the selected business',
      );
    }
  }

  private async validateSupplier(
    businessId: string,
    supplierId: string,
  ): Promise<void> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!supplier) {
      throw new BadRequestException(
        'Supplier does not exist, is inactive, or does not belong to the selected business',
      );
    }
  }

  private async validateProducts(
    businessId: string,
    items: CreatePurchaseItemDto[],
  ): Promise<void> {
    const productIds = [...new Set(items.map((item) => item.productId))];

    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        businessId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    const foundProductIds = new Set(products.map((product) => product.id));

    const invalidProductId = productIds.find(
      (productId) => !foundProductIds.has(productId),
    );

    if (invalidProductId) {
      throw new BadRequestException(
        `Product ${invalidProductId} does not exist, is inactive, or does not belong to the selected business`,
      );
    }
  }

  private calculatePurchase(
    items: CreatePurchaseItemDto[],
    invoiceDiscountAmount: Prisma.Decimal,
    invoiceTaxAmount: Prisma.Decimal,
    otherCharges: Prisma.Decimal,
  ): CalculatedPurchaseTotals {
    let subtotal = new Prisma.Decimal(0);
    let itemDiscountTotal = new Prisma.Decimal(0);
    let itemTaxTotal = new Prisma.Decimal(0);

    const calculatedItems = items.map((item, index) => {
      const quantity = this.quantity(item.quantity);
      const unitCost = this.money(item.unitCost);
      const discountAmount = this.money(item.discountAmount ?? 0);
      const taxAmount = this.money(item.taxAmount ?? 0);

      const baseAmount = quantity.mul(unitCost);
      const lineTotal = baseAmount.sub(discountAmount).add(taxAmount);

      if (lineTotal.isNegative()) {
        throw new BadRequestException(
          `Purchase item ${index + 1} has a negative line total`,
        );
      }

      subtotal = subtotal.add(baseAmount);
      itemDiscountTotal = itemDiscountTotal.add(discountAmount);
      itemTaxTotal = itemTaxTotal.add(taxAmount);

      return {
        lineNumber: index + 1,
        productId: item.productId,
        quantity,
        unitCost,
        discountAmount,
        taxAmount,
        lineTotal,
        batchNumber: item.batchNumber?.trim() || null,
        manufacturedAt: item.manufacturedAt
          ? new Date(item.manufacturedAt)
          : null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      };
    });

    const totalAmount = subtotal
      .sub(itemDiscountTotal)
      .add(itemTaxTotal)
      .sub(invoiceDiscountAmount)
      .add(invoiceTaxAmount)
      .add(otherCharges);

    if (totalAmount.isNegative()) {
      throw new BadRequestException('Purchase total amount cannot be negative');
    }

    return {
      items: calculatedItems,
      subtotal,
      totalAmount,
    };
  }

  private money(value: number | string | Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(2);
  }

  private quantity(value: number | string | Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(3);
  }

  private purchaseListSelect() {
    return {
      id: true,
      businessId: true,
      branchId: true,
      supplierId: true,
      invoiceNumber: true,
      supplierInvoiceNumber: true,
      purchaseDate: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      otherCharges: true,
      totalAmount: true,
      receivedAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    } satisfies Prisma.PurchaseSelect;
  }

  private purchaseDetailsSelect() {
    return {
      ...this.purchaseListSelect(),
      createdById: true,
      notes: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      items: {
        orderBy: {
          lineNumber: 'asc' as const,
        },
        select: {
          id: true,
          purchaseId: true,
          productId: true,
          lineNumber: true,
          quantity: true,
          unitCost: true,
          discountAmount: true,
          taxAmount: true,
          lineTotal: true,
          batchNumber: true,
          manufacturedAt: true,
          expiryDate: true,
          createdAt: true,
          updatedAt: true,
          product: {
            select: {
              id: true,
              name: true,
              code: true,
              barcode: true,
              isActive: true,
              trackStock: true,
              unit: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  symbol: true,
                },
              },
            },
          },
        },
      },
    } satisfies Prisma.PurchaseSelect;
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
