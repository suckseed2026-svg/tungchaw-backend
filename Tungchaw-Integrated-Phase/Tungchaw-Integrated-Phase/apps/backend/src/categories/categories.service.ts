import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const normalizedCode = dto.code.trim().toUpperCase();
    const description = dto.description?.trim() || null;

    const existingCategory = await this.prisma.category.findUnique({
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

    if (existingCategory) {
      throw new ConflictException(
        'Category code already exists in this business',
      );
    }

    try {
      return await this.prisma.category.create({
        data: {
          businessId,
          name,
          code: normalizedCode,
          description,
        },
        select: this.categorySelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Category code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create category at this time',
      );
    }
  }

  async findAll(businessId: string, query: CategoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.CategoryWhereInput = {
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
      this.prisma.category.findMany({
        where,
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
        select: this.categorySelect(),
      }),
      this.prisma.category.count({
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

  async findOne(businessId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        businessId,
      },
      select: this.categorySelect(),
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(businessId: string, categoryId: string, dto: UpdateCategoryDto) {
    await this.findOne(businessId, categoryId);

    const normalizedCode = dto.code?.trim().toUpperCase();

    if (normalizedCode) {
      const conflictingCategory = await this.prisma.category.findFirst({
        where: {
          businessId,
          code: normalizedCode,
          id: {
            not: categoryId,
          },
        },
        select: {
          id: true,
        },
      });

      if (conflictingCategory) {
        throw new ConflictException(
          'Category code already exists in this business',
        );
      }
    }

    try {
      return await this.prisma.category.update({
        where: {
          id: categoryId,
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
        select: this.categorySelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Category code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to update category at this time',
      );
    }
  }

  async deactivate(businessId: string, categoryId: string) {
    const category = await this.findOne(businessId, categoryId);

    if (!category.isActive) {
      return {
        message: 'Category is already inactive',
        category,
      };
    }

    const updatedCategory = await this.prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        isActive: false,
      },
      select: this.categorySelect(),
    });

    return {
      message: 'Category deactivated successfully',
      category: updatedCategory,
    };
  }

  private categorySelect() {
    return {
      id: true,
      businessId: true,
      name: true,
      code: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.CategorySelect;
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
