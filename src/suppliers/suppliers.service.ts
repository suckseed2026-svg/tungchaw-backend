import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateSupplierDto) {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existingSupplier = await this.prisma.supplier.findUnique({
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

    if (existingSupplier) {
      throw new ConflictException(
        'Supplier code already exists in this business',
      );
    }

    try {
      return await this.prisma.supplier.create({
        data: {
          businessId,
          name: dto.name.trim(),
          code: normalizedCode,
          contactName: dto.contactName?.trim() || null,
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim().toLowerCase() || null,
          address: dto.address?.trim() || null,
          gstNumber: dto.gstNumber?.trim().toUpperCase() || null,
          notes: dto.notes?.trim() || null,
        },
        select: this.supplierSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Supplier code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create supplier at this time',
      );
    }
  }

  async findAll(businessId: string, query: SupplierQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.SupplierWhereInput = {
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
                contactName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
        select: this.supplierSelect(),
      }),
      this.prisma.supplier.count({
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

  async findOne(businessId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
      },
      select: this.supplierSelect(),
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(businessId: string, supplierId: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const normalizedCode =
      dto.code !== undefined ? dto.code.trim().toUpperCase() : undefined;

    if (normalizedCode !== undefined && normalizedCode !== supplier.code) {
      const duplicateSupplier = await this.prisma.supplier.findFirst({
        where: {
          businessId,
          code: normalizedCode,
          id: {
            not: supplierId,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicateSupplier) {
        throw new ConflictException(
          'Supplier code already exists in this business',
        );
      }
    }

    try {
      return await this.prisma.supplier.update({
        where: {
          id: supplierId,
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

          ...(dto.contactName !== undefined
            ? {
                contactName: dto.contactName.trim() || null,
              }
            : {}),

          ...(dto.phone !== undefined
            ? {
                phone: dto.phone.trim() || null,
              }
            : {}),

          ...(dto.email !== undefined
            ? {
                email: dto.email.trim().toLowerCase() || null,
              }
            : {}),

          ...(dto.address !== undefined
            ? {
                address: dto.address.trim() || null,
              }
            : {}),

          ...(dto.gstNumber !== undefined
            ? {
                gstNumber: dto.gstNumber.trim().toUpperCase() || null,
              }
            : {}),

          ...(dto.notes !== undefined
            ? {
                notes: dto.notes.trim() || null,
              }
            : {}),

          ...(dto.isActive !== undefined
            ? {
                isActive: dto.isActive,
              }
            : {}),
        },
        select: this.supplierSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Supplier code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to update supplier at this time',
      );
    }
  }

  async deactivate(businessId: string, supplierId: string) {
    const supplier = await this.findOne(businessId, supplierId);

    if (!supplier.isActive) {
      return {
        message: 'Supplier is already inactive',
        supplier,
      };
    }

    try {
      const updatedSupplier = await this.prisma.supplier.update({
        where: {
          id: supplierId,
        },
        data: {
          isActive: false,
        },
        select: this.supplierSelect(),
      });

      return {
        message: 'Supplier deactivated successfully',
        supplier: updatedSupplier,
      };
    } catch {
      throw new InternalServerErrorException(
        'Unable to deactivate supplier at this time',
      );
    }
  }

  private supplierSelect() {
    return {
      id: true,
      businessId: true,
      name: true,
      code: true,
      contactName: true,
      phone: true,
      email: true,
      address: true,
      gstNumber: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.SupplierSelect;
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
