import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateUnitDto) {
    const name = dto.name.trim();
    const normalizedCode = dto.code.trim().toUpperCase();
    const symbol = dto.symbol.trim();
    const description = dto.description?.trim() || null;

    const existingUnit = await this.prisma.unit.findUnique({
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

    if (existingUnit) {
      throw new ConflictException('Unit code already exists in this business');
    }

    try {
      return await this.prisma.unit.create({
        data: {
          businessId,
          name,
          code: normalizedCode,
          symbol,
          description,
        },
        select: this.unitSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Unit code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create unit at this time',
      );
    }
  }

  async findAll(businessId: string, query: UnitQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.UnitWhereInput = {
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
              {
                symbol: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
        select: this.unitSelect(),
      }),
      this.prisma.unit.count({
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

  async findOne(businessId: string, unitId: string) {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        businessId,
      },
      select: this.unitSelect(),
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    return unit;
  }

  async update(businessId: string, unitId: string, dto: UpdateUnitDto) {
    await this.findOne(businessId, unitId);

    const normalizedCode = dto.code?.trim().toUpperCase();

    if (normalizedCode) {
      const conflictingUnit = await this.prisma.unit.findFirst({
        where: {
          businessId,
          code: normalizedCode,
          id: {
            not: unitId,
          },
        },
        select: {
          id: true,
        },
      });

      if (conflictingUnit) {
        throw new ConflictException(
          'Unit code already exists in this business',
        );
      }
    }

    try {
      return await this.prisma.unit.update({
        where: {
          id: unitId,
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
          ...(dto.symbol !== undefined
            ? {
                symbol: dto.symbol.trim(),
              }
            : {}),
          ...(dto.description !== undefined
            ? {
                description: dto.description.trim() || null,
              }
            : {}),
        },
        select: this.unitSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Unit code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to update unit at this time',
      );
    }
  }

  async deactivate(businessId: string, unitId: string) {
    const unit = await this.findOne(businessId, unitId);

    if (!unit.isActive) {
      return {
        message: 'Unit is already inactive',
        unit,
      };
    }

    const updatedUnit = await this.prisma.unit.update({
      where: {
        id: unitId,
      },
      data: {
        isActive: false,
      },
      select: this.unitSelect(),
    });

    return {
      message: 'Unit deactivated successfully',
      unit: updatedUnit,
    };
  }

  private unitSelect() {
    return {
      id: true,
      businessId: true,
      name: true,
      code: true,
      symbol: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UnitSelect;
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
