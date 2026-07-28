import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateCustomerDto) {
    const name = dto.name.trim();
    const normalizedCode = dto.code.trim().toUpperCase();
    const phone = dto.phone?.trim() || null;
    const email = dto.email?.trim().toLowerCase() || null;
    const address = dto.address?.trim() || null;
    const notes = dto.notes?.trim() || null;

    const duplicateCustomer = await this.prisma.customer.findFirst({
      where: {
        businessId,
        code: normalizedCode,
      },
      select: {
        id: true,
      },
    });

    if (duplicateCustomer) {
      throw new ConflictException(
        'Customer code already exists in this business',
      );
    }

    try {
      return await this.prisma.customer.create({
        data: {
          businessId,
          name,
          code: normalizedCode,
          phone,
          email,
          address,
          creditLimit: new Prisma.Decimal(dto.creditLimit ?? 0),
          openingBalance: new Prisma.Decimal(dto.openingBalance ?? 0),
          notes,
        },
        select: this.customerSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Customer code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create customer at this time',
      );
    }
  }

  async findAll(businessId: string, query: CustomerQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.CustomerWhereInput = {
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
      this.prisma.customer.findMany({
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
        select: this.customerSelect(),
      }),

      this.prisma.customer.count({
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

  async findOne(businessId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId,
      },
      select: this.customerSelect(),
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(businessId: string, customerId: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId,
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const normalizedCode =
      dto.code !== undefined ? dto.code.trim().toUpperCase() : undefined;

    if (normalizedCode !== undefined && normalizedCode !== customer.code) {
      const duplicateCustomer = await this.prisma.customer.findFirst({
        where: {
          businessId,
          code: normalizedCode,
          id: {
            not: customerId,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicateCustomer) {
        throw new ConflictException(
          'Customer code already exists in this business',
        );
      }
    }

    try {
      return await this.prisma.customer.update({
        where: {
          id: customerId,
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

          ...(dto.creditLimit !== undefined
            ? {
                creditLimit: new Prisma.Decimal(dto.creditLimit),
              }
            : {}),

          ...(dto.openingBalance !== undefined
            ? {
                openingBalance: new Prisma.Decimal(dto.openingBalance),
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
        select: this.customerSelect(),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Customer code already exists in this business',
        );
      }

      throw new InternalServerErrorException(
        'Unable to update customer at this time',
      );
    }
  }

  async deactivate(businessId: string, customerId: string) {
    const customer = await this.findOne(businessId, customerId);

    if (!customer.isActive) {
      return {
        message: 'Customer is already inactive',
        customer,
      };
    }

    try {
      const updatedCustomer = await this.prisma.customer.update({
        where: {
          id: customerId,
        },
        data: {
          isActive: false,
        },
        select: this.customerSelect(),
      });

      return {
        message: 'Customer deactivated successfully',
        customer: updatedCustomer,
      };
    } catch {
      throw new InternalServerErrorException(
        'Unable to deactivate customer at this time',
      );
    }
  }

  private customerSelect() {
    return {
      id: true,
      businessId: true,
      code: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      creditLimit: true,
      openingBalance: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.CustomerSelect;
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
