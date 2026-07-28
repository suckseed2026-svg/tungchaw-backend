import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateExpenseDto) {
    await this.validateRelations(businessId, dto.branchId, dto.expenseCategoryId);
    const expenseNumber = dto.expenseNumber.trim().toUpperCase();
    await this.ensureNumberAvailable(businessId, expenseNumber);
    try {
      return await this.prisma.expense.create({
        data: {
          businessId,
          branchId: dto.branchId,
          expenseCategoryId: dto.expenseCategoryId,
          expenseNumber,
          expenseDate: new Date(dto.expenseDate),
          amount: new Prisma.Decimal(dto.amount),
          paymentMethod: dto.paymentMethod?.trim().toUpperCase() || null,
          referenceNumber: dto.referenceNumber?.trim() || null,
          paidTo: dto.paidTo?.trim() || null,
          description: dto.description?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
        select: this.select(),
      });
    } catch (error: unknown) {
      if (this.isUnique(error)) throw new ConflictException('Expense number already exists in this business');
      throw new InternalServerErrorException('Unable to create expense at this time');
    }
  }

  async findAll(businessId: string, query: ExpenseQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.ExpenseWhereInput = {
      businessId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.expenseCategoryId ? { expenseCategoryId: query.expenseCategoryId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...((query.dateFrom || query.dateTo) ? { expenseDate: {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      } } : {}),
      ...(search ? { OR: [
        { expenseNumber: { contains: search, mode: 'insensitive' } },
        { paidTo: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({ where, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit, select: this.select() }),
      this.prisma.expense.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) } };
  }

  async findOne(businessId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, businessId }, select: this.select() });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(businessId: string, id: string, dto: UpdateExpenseDto) {
    const current = await this.findOne(businessId, id);
    const branchId = dto.branchId ?? current.branchId;
    const categoryId = dto.expenseCategoryId ?? current.expenseCategoryId;
    await this.validateRelations(businessId, branchId, categoryId);
    const expenseNumber = dto.expenseNumber !== undefined ? dto.expenseNumber.trim().toUpperCase() : undefined;
    if (expenseNumber) await this.ensureNumberAvailable(businessId, expenseNumber, id);
    try {
      return await this.prisma.expense.update({
        where: { id },
        data: {
          ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
          ...(dto.expenseCategoryId !== undefined ? { expenseCategoryId: dto.expenseCategoryId } : {}),
          ...(expenseNumber !== undefined ? { expenseNumber } : {}),
          ...(dto.expenseDate !== undefined ? { expenseDate: new Date(dto.expenseDate) } : {}),
          ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
          ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod.trim().toUpperCase() || null } : {}),
          ...(dto.referenceNumber !== undefined ? { referenceNumber: dto.referenceNumber.trim() || null } : {}),
          ...(dto.paidTo !== undefined ? { paidTo: dto.paidTo.trim() || null } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        select: this.select(),
      });
    } catch (error: unknown) {
      if (this.isUnique(error)) throw new ConflictException('Expense number already exists in this business');
      throw new InternalServerErrorException('Unable to update expense at this time');
    }
  }

  async deactivate(businessId: string, id: string) {
    await this.findOne(businessId, id);
    const expense = await this.prisma.expense.update({ where: { id }, data: { isActive: false }, select: this.select() });
    return { message: 'Expense deactivated successfully', expense };
  }

  private async validateRelations(businessId: string, branchId: string, categoryId: string) {
    const [branch, category] = await this.prisma.$transaction([
      this.prisma.branch.findFirst({ where: { id: branchId, businessId }, select: { id: true, isActive: true } }),
      this.prisma.expenseCategory.findFirst({ where: { id: categoryId, businessId }, select: { id: true, isActive: true } }),
    ]);
    if (!branch) throw new NotFoundException('Branch not found');
    if (!branch.isActive) throw new BadRequestException('Branch is inactive');
    if (!category) throw new NotFoundException('Expense category not found');
    if (!category.isActive) throw new BadRequestException('Expense category is inactive');
  }

  private async ensureNumberAvailable(businessId: string, expenseNumber: string, excludeId?: string) {
    const duplicate = await this.prisma.expense.findFirst({ where: { businessId, expenseNumber, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (duplicate) throw new ConflictException('Expense number already exists in this business');
  }

  private select() {
    return {
      id: true, businessId: true, branchId: true, expenseCategoryId: true, expenseNumber: true, expenseDate: true,
      amount: true, paymentMethod: true, referenceNumber: true, paidTo: true, description: true, notes: true, isActive: true,
      branch: { select: { id: true, name: true, code: true } },
      expenseCategory: { select: { id: true, name: true, code: true } },
      createdAt: true, updatedAt: true,
    } as const;
  }

  private isUnique(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2002';
  }
}
