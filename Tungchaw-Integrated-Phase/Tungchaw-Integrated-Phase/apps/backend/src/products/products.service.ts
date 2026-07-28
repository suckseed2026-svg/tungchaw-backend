import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateProductDto) {
    const name = dto.name.trim();
    const normalizedCode = dto.code.trim().toUpperCase();
    const normalizedBarcode = dto.barcode?.trim() || null;
    const description = dto.description?.trim() || null;

    const configuration = await this.prisma.businessConfiguration.findUnique({
      where: { businessId },
      select: {
        defaultTrackStock: true,
        defaultTrackBatch: true,
        defaultTrackExpiry: true,
        defaultRequireBatchOnPurchase: true,
        defaultRequireExpiryOnPurchase: true,
        defaultBlockExpiredSale: true,
        defaultUseFefo: true,
        defaultTrackSerialNumber: true,
      },
    });

    await this.validateRelatedRecords(
      businessId,
      dto.unitId,
      dto.categoryId,
      dto.brandId,
    );

    await this.ensureCodeIsAvailable(businessId, normalizedCode);

    if (normalizedBarcode) {
      await this.ensureBarcodeIsAvailable(businessId, normalizedBarcode);
    }

    try {
      return await this.prisma.product.create({
        data: {
          businessId,
          name,
          code: normalizedCode,
          barcode: normalizedBarcode,
          description,
          categoryId: dto.categoryId ?? null,
          unitId: dto.unitId,
          brandId: dto.brandId ?? null,
          costPrice: new Prisma.Decimal(dto.costPrice),
          sellingPrice: new Prisma.Decimal(dto.sellingPrice),
          trackStock: dto.trackStock ?? configuration?.defaultTrackStock ?? true,
          trackBatch: dto.trackBatch ?? configuration?.defaultTrackBatch ?? false,
          trackExpiry: dto.trackExpiry ?? configuration?.defaultTrackExpiry ?? false,
          requireBatchOnPurchase:
            dto.requireBatchOnPurchase ?? configuration?.defaultRequireBatchOnPurchase ?? false,
          requireExpiryOnPurchase:
            dto.requireExpiryOnPurchase ?? configuration?.defaultRequireExpiryOnPurchase ?? false,
          blockExpiredSale:
            dto.blockExpiredSale ?? configuration?.defaultBlockExpiredSale ?? false,
          useFefo: dto.useFefo ?? configuration?.defaultUseFefo ?? false,
          trackSerialNumber:
            dto.trackSerialNumber ?? configuration?.defaultTrackSerialNumber ?? false,
        },
        select: this.productSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Product code or barcode already exists in this business',
        );
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to create product at this time',
      );
    }
  }

  async findAll(businessId: string, query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.ProductWhereInput = {
      businessId,

      ...(query.categoryId
        ? {
            categoryId: query.categoryId,
          }
        : {}),

      ...(query.brandId
        ? {
            brandId: query.brandId,
          }
        : {}),

      ...(query.unitId
        ? {
            unitId: query.unitId,
          }
        : {}),

      ...(query.isActive !== undefined
        ? {
            isActive: query.isActive,
          }
        : {}),

      ...(query.trackStock !== undefined
        ? {
            trackStock: query.trackStock,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                code: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                barcode: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [
          {
            name: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
        skip,
        take: limit,
        select: this.productSelect(),
      }),

      this.prisma.product.count({
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

  async findOne(businessId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
      select: this.productSelect(),
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(businessId: string, productId: string, dto: UpdateProductDto) {
    const existingProduct = await this.findOne(businessId, productId);

    const normalizedCode =
      dto.code !== undefined ? dto.code.trim().toUpperCase() : undefined;

    const normalizedBarcode =
      dto.barcode !== undefined ? dto.barcode.trim() || null : undefined;

    const unitId = dto.unitId ?? existingProduct.unitId;

    const categoryId =
      dto.categoryId !== undefined
        ? dto.categoryId
        : (existingProduct.categoryId ?? undefined);

    const brandId =
      dto.brandId !== undefined
        ? dto.brandId
        : (existingProduct.brandId ?? undefined);

    await this.validateRelatedRecords(businessId, unitId, categoryId, brandId);

    if (normalizedCode) {
      await this.ensureCodeIsAvailable(businessId, normalizedCode, productId);
    }

    if (normalizedBarcode) {
      await this.ensureBarcodeIsAvailable(
        businessId,
        normalizedBarcode,
        productId,
      );
    }

    try {
      return await this.prisma.product.update({
        where: {
          id: productId,
        },
        data: {
          ...(dto.name !== undefined
            ? {
                name: dto.name.trim(),
              }
            : {}),

          ...(normalizedCode !== undefined
            ? {
                code: normalizedCode,
              }
            : {}),

          ...(normalizedBarcode !== undefined
            ? {
                barcode: normalizedBarcode,
              }
            : {}),

          ...(dto.description !== undefined
            ? {
                description: dto.description.trim() || null,
              }
            : {}),

          ...(dto.categoryId !== undefined
            ? {
                categoryId: dto.categoryId,
              }
            : {}),

          ...(dto.unitId !== undefined
            ? {
                unitId: dto.unitId,
              }
            : {}),

          ...(dto.brandId !== undefined
            ? {
                brandId: dto.brandId,
              }
            : {}),

          ...(dto.costPrice !== undefined
            ? {
                costPrice: new Prisma.Decimal(dto.costPrice),
              }
            : {}),

          ...(dto.sellingPrice !== undefined
            ? {
                sellingPrice: new Prisma.Decimal(dto.sellingPrice),
              }
            : {}),

          ...(dto.trackStock !== undefined
            ? {
                trackStock: dto.trackStock,
              }
            : {}),
          ...(dto.trackBatch !== undefined ? { trackBatch: dto.trackBatch } : {}),
          ...(dto.trackExpiry !== undefined ? { trackExpiry: dto.trackExpiry } : {}),
          ...(dto.requireBatchOnPurchase !== undefined
            ? { requireBatchOnPurchase: dto.requireBatchOnPurchase }
            : {}),
          ...(dto.requireExpiryOnPurchase !== undefined
            ? { requireExpiryOnPurchase: dto.requireExpiryOnPurchase }
            : {}),
          ...(dto.blockExpiredSale !== undefined
            ? { blockExpiredSale: dto.blockExpiredSale }
            : {}),
          ...(dto.useFefo !== undefined ? { useFefo: dto.useFefo } : {}),
          ...(dto.trackSerialNumber !== undefined
            ? { trackSerialNumber: dto.trackSerialNumber }
            : {}),
        },
        select: this.productSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Product code or barcode already exists in this business',
        );
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to update product at this time',
      );
    }
  }

  async deactivate(businessId: string, productId: string) {
    const product = await this.findOne(businessId, productId);

    if (!product.isActive) {
      return {
        message: 'Product is already inactive',
        product,
      };
    }

    const updatedProduct = await this.prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        isActive: false,
      },
      select: this.productSelect(),
    });

    return {
      message: 'Product deactivated successfully',
      product: updatedProduct,
    };
  }

  private async validateRelatedRecords(
    businessId: string,
    unitId: string,
    categoryId?: string,
    brandId?: string,
  ): Promise<void> {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        businessId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!unit) {
      throw new BadRequestException(
        'Unit does not exist, is inactive, or does not belong to the selected business',
      );
    }

    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: categoryId,
          businessId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!category) {
        throw new BadRequestException(
          'Category does not exist, is inactive, or does not belong to the selected business',
        );
      }
    }

    if (brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: {
          id: brandId,
          businessId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!brand) {
        throw new BadRequestException(
          'Brand does not exist, is inactive, or does not belong to the selected business',
        );
      }
    }
  }

  private async ensureCodeIsAvailable(
    businessId: string,
    code: string,
    excludedProductId?: string,
  ): Promise<void> {
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        businessId,
        code,
        ...(excludedProductId
          ? {
              id: {
                not: excludedProductId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingProduct) {
      throw new ConflictException(
        'Product code already exists in this business',
      );
    }
  }

  private async ensureBarcodeIsAvailable(
    businessId: string,
    barcode: string,
    excludedProductId?: string,
  ): Promise<void> {
    const existingProduct = await this.prisma.product.findFirst({
      where: {
        businessId,
        barcode,
        ...(excludedProductId
          ? {
              id: {
                not: excludedProductId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingProduct) {
      throw new ConflictException(
        'Product barcode already exists in this business',
      );
    }
  }

  private productSelect() {
    return {
      id: true,
      businessId: true,
      categoryId: true,
      unitId: true,
      brandId: true,
      name: true,
      code: true,
      barcode: true,
      description: true,
      costPrice: true,
      sellingPrice: true,
      trackStock: true,
      trackBatch: true,
      trackExpiry: true,
      requireBatchOnPurchase: true,
      requireExpiryOnPurchase: true,
      blockExpiredSale: true,
      useFefo: true,
      trackSerialNumber: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,

      category: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },

      unit: {
        select: {
          id: true,
          name: true,
          code: true,
          symbol: true,
          isActive: true,
        },
      },

      brand: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
    } satisfies Prisma.ProductSelect;
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
