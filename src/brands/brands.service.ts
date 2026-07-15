import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BrandQueryDto } from './dto/brand-query.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateBrandDto) {
    const name = dto.name.trim();
    const normalizedCode = dto.code.trim().toUpperCase();
    const description = dto.description?.trim() || null;

    const existingBrand = await this.prisma.brand.findUnique({
      where: {
        businessId_code: {
          businessId,
          code: normalizedCode,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingBrand) {
      throw new ConflictException('Brand code already exists in this business');
    }

    try {
      return await this.prisma.brand.create({
        data: {
          businessId,
          name,
          code: normalizedCode,
          description,
        },
        select: this.brandSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Brand code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create brand at this time',
      );
    }
  }

  async findAll(businessId: string, query: BrandQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.BrandWhereInput = {
      businessId,
      ...(query.isActive !== undefined
        ? {
            isActive: query.isActive,
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
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
        select: this.brandSelect(),
      }),
      this.prisma.brand.count({
        where,
      }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(businessId: string, brandId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        businessId,
      },
      select: this.brandSelect(),
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  async update(businessId: string, brandId: string, dto: UpdateBrandDto) {
    await this.findOne(businessId, brandId);

    const normalizedCode = dto.code?.trim().toUpperCase();

    if (normalizedCode) {
      const conflictingBrand = await this.prisma.brand.findFirst({
        where: {
          businessId,
          code: normalizedCode,
          id: {
            not: brandId,
          },
        },
        select: {
          id: true,
        },
      });

      if (conflictingBrand) {
        throw new ConflictException(
          'Brand code already exists in this business',
        );
      }
    }

    try {
      return await this.prisma.brand.update({
        where: {
          id: brandId,
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
          ...(dto.description !== undefined
            ? {
                description: dto.description.trim() || null,
              }
            : {}),
        },
        select: this.brandSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Brand code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to update brand at this time',
      );
    }
  }

  async deactivate(businessId: string, brandId: string) {
    const brand = await this.findOne(businessId, brandId);

    if (!brand.isActive) {
      return {
        message: 'Brand is already inactive',
        brand,
      };
    }

    const updatedBrand = await this.prisma.brand.update({
      where: {
        id: brandId,
      },
      data: {
        isActive: false,
      },
      select: this.brandSelect(),
    });

    return {
      message: 'Brand deactivated successfully',
      brand: updatedBrand,
    };
  }

  private brandSelect() {
    return {
      id: true,
      businessId: true,
      name: true,
      code: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.BrandSelect;
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
