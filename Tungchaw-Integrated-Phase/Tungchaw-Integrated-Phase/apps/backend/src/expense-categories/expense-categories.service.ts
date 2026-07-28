import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { ExpenseCategoryQueryDto } from './dto/expense-category-query.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateExpenseCategoryDto) {
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.expenseCategory.findUnique({
      where: { businessId_code: { businessId, code } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Expense category code already exists in this business');

    try {
      return await this.prisma.expenseCategory.create({
        data: {
          businessId,
          name: dto.name.trim(),
          code,
          description: dto.description?.trim() || null,
        },
        select: this.select(),
      });
    } catch (error: unknown) {
      if (this.isUnique(error)) throw new ConflictException('Expense category code already exists in this business');
      throw new InternalServerErrorException('Unable to create expense category at this time');
    }
  }

  async findAll(businessId: string, query: ExpenseCategoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.ExpenseCategoryWhereInput = {
      businessId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.expenseCategory.findMany({ where, orderBy: [{ name: 'asc' }, { createdAt: 'asc' }], skip: (page - 1) * limit, take: limit, select: this.select() }),
      this.prisma.expenseCategory.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) } };
  }

  async findOne(businessId: string, id: string) {
    const item = await this.prisma.expenseCategory.findFirst({ where: { id, businessId }, select: this.select() });
    if (!item) throw new NotFoundException('Expense category not found');
    return item;
  }

  async update(businessId: string, id: string, dto: UpdateExpenseCategoryDto) {
    const current = await this.findOne(businessId, id);
    const code = dto.code !== undefined ? dto.code.trim().toUpperCase() : undefined;
    if (code && code !== current.code) {
      const duplicate = await this.prisma.expenseCategory.findFirst({ where: { businessId, code, id: { not: id } }, select: { id: true } });
      if (duplicate) throw new ConflictException('Expense category code already exists in this business');
    }
    try {
      return await this.prisma.expenseCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(code !== undefined ? { code } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        select: this.select(),
      });
    } catch (error: unknown) {
      if (this.isUnique(error)) throw new ConflictException('Expense category code already exists in this business');
      throw new InternalServerErrorException('Unable to update expense category at this time');
    }
  }

  async deactivate(businessId: string, id: string) {
    await this.findOne(businessId, id);
    const category = await this.prisma.expenseCategory.update({ where: { id }, data: { isActive: false }, select: this.select() });
    return { message: 'Expense category deactivated successfully', category };
  }

  private select() {
    return { id: true, businessId: true, name: true, code: true, description: true, isActive: true, createdAt: true, updatedAt: true } as const;
  }

  private isUnique(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
  }
}
