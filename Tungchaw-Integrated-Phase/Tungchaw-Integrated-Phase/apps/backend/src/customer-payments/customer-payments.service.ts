import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SaleReturnStatus,
  SaleStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';
import { CustomerPaymentQueryDto } from './dto/customer-payment-query.dto';

@Injectable()
export class CustomerPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    businessId: string,
    customerId: string,
    createdById: string,
    dto: CreateCustomerPaymentDto,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const customer = await tx.customer.findFirst({
            where: {
              id: customerId,
              businessId,
            },
            select: {
              id: true,
              code: true,
              name: true,
              isActive: true,
              creditLimit: true,
              openingBalance: true,
            },
          });

          if (!customer) {
            throw new NotFoundException('Customer not found');
          }

          if (!customer.isActive) {
            throw new BadRequestException(
              'Payments cannot be recorded for an inactive customer',
            );
          }

          if (dto.branchId) {
            const branch = await tx.branch.findFirst({
              where: {
                id: dto.branchId,
                businessId,
              },
              select: {
                id: true,
                isActive: true,
              },
            });

            if (!branch) {
              throw new NotFoundException('Branch not found');
            }

            if (!branch.isActive) {
              throw new BadRequestException(
                'Payments cannot be recorded against an inactive branch',
              );
            }
          }

          const amount = new Prisma.Decimal(dto.amount);

          if (amount.lessThanOrEqualTo(0)) {
            throw new BadRequestException(
              'Payment amount must be greater than zero',
            );
          }

          const balanceBefore = await this.calculateBalance(
            tx,
            businessId,
            customerId,
            customer.openingBalance,
            customer.creditLimit,
          );

          if (balanceBefore.outstandingBalance.lessThanOrEqualTo(0)) {
            throw new BadRequestException(
              'This customer has no outstanding balance',
            );
          }

          if (amount.greaterThan(balanceBefore.outstandingBalance)) {
            throw new BadRequestException(
              `Payment exceeds the outstanding balance of ${balanceBefore.outstandingBalance.toFixed(2)}`,
            );
          }

          const paymentDate = new Date(dto.paymentDate);

          const paymentNumber = await this.generatePaymentNumber(
            tx,
            businessId,
            paymentDate,
          );

          const payment = await tx.customerPayment.create({
            data: {
              businessId,
              customerId,
              branchId: dto.branchId ?? null,
              createdById,
              paymentNumber,
              paymentDate,
              amount,
              paymentMethod: dto.paymentMethod,
              referenceNumber: dto.referenceNumber?.trim() || null,
              notes: dto.notes?.trim() || null,
            },
            include: this.paymentInclude(),
          });

          const totalPayments = balanceBefore.totalPayments.plus(amount);

          const outstandingBalance = Prisma.Decimal.max(
            balanceBefore.openingBalance
              .plus(balanceBefore.creditSales)
              .minus(totalPayments)
              .minus(balanceBefore.totalCreditAdjustments),
            new Prisma.Decimal(0),
          );

          return {
            payment,
            balance: {
              openingBalance: balanceBefore.openingBalance,
              creditSales: balanceBefore.creditSales,
              totalPayments,
              totalCreditAdjustments: balanceBefore.totalCreditAdjustments,
              outstandingBalance,
              creditLimit: balanceBefore.creditLimit,
              availableCredit: Prisma.Decimal.max(
                balanceBefore.creditLimit.minus(outstandingBalance),
                new Prisma.Decimal(0),
              ),
            },
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Unable to generate a unique customer payment number. Please retry.',
        );
      }

      throw error;
    }
  }

  async findAll(
    businessId: string,
    customerId: string,
    query: CustomerPaymentQueryDto,
  ) {
    const customer = await this.findCustomerOrThrow(businessId, customerId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    if (
      query.dateFrom &&
      query.dateTo &&
      new Date(query.dateFrom) > new Date(query.dateTo)
    ) {
      throw new BadRequestException('dateFrom cannot be after dateTo');
    }

    const where: Prisma.CustomerPaymentWhereInput = {
      businessId,
      customerId,

      ...(query.paymentMethod
        ? {
            paymentMethod: query.paymentMethod,
          }
        : {}),

      ...(query.dateFrom || query.dateTo
        ? {
            paymentDate: {
              ...(query.dateFrom
                ? {
                    gte: this.startOfDay(query.dateFrom),
                  }
                : {}),

              ...(query.dateTo
                ? {
                    lte: this.endOfDay(query.dateTo),
                  }
                : {}),
            },
          }
        : {}),
    };

    const [payments, total, balance] = await Promise.all([
      this.prisma.customerPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            paymentDate: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
        include: this.paymentInclude(),
      }),

      this.prisma.customerPayment.count({
        where,
      }),

      this.getBalance(businessId, customerId),
    ]);

    return {
      customer,
      data: payments,
      balance,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(businessId: string, customerId: string, paymentId: string) {
    const payment = await this.prisma.customerPayment.findFirst({
      where: {
        id: paymentId,
        businessId,
        customerId,
      },
      include: this.paymentInclude(),
    });

    if (!payment) {
      throw new NotFoundException('Customer payment not found');
    }

    return payment;
  }

  async getBalance(businessId: string, customerId: string) {
    const customer = await this.findCustomerOrThrow(businessId, customerId);

    const balance = await this.calculateBalance(
      this.prisma,
      businessId,
      customerId,
      customer.openingBalance,
      customer.creditLimit,
    );

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.phone,
        isActive: customer.isActive,
      },
      ...balance,
    };
  }

  private async findCustomerOrThrow(businessId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        isActive: true,
        creditLimit: true,
        openingBalance: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async calculateBalance(
    client: Prisma.TransactionClient | PrismaService,
    businessId: string,
    customerId: string,
    openingBalance: Prisma.Decimal,
    creditLimit: Prisma.Decimal,
  ) {
    const [salesAggregate, paymentAggregate, saleReturnAggregate] =
      await Promise.all([
        client.sale.aggregate({
          where: {
            businessId,
            customerId,
            status: SaleStatus.COMPLETED,
          },
          _sum: {
            creditAmount: true,
          },
        }),

        client.customerPayment.aggregate({
          where: {
            businessId,
            customerId,
          },
          _sum: {
            amount: true,
          },
        }),

        client.saleReturn.aggregate({
          where: {
            businessId,
            customerId,
            status: SaleReturnStatus.COMPLETED,
          },
          _sum: {
            creditAdjustmentAmount: true,
          },
        }),
      ]);

    const creditSales =
      salesAggregate._sum.creditAmount ?? new Prisma.Decimal(0);

    const totalPayments = paymentAggregate._sum.amount ?? new Prisma.Decimal(0);

    const totalCreditAdjustments =
      saleReturnAggregate._sum.creditAdjustmentAmount ?? new Prisma.Decimal(0);

    const outstandingBalance = Prisma.Decimal.max(
      openingBalance
        .plus(creditSales)
        .minus(totalPayments)
        .minus(totalCreditAdjustments),
      new Prisma.Decimal(0),
    );

    return {
      openingBalance,
      creditSales,
      totalPayments,
      totalCreditAdjustments,
      outstandingBalance,
      creditLimit,
      availableCredit: Prisma.Decimal.max(
        creditLimit.minus(outstandingBalance),
        new Prisma.Decimal(0),
      ),
    };
  }

  private async generatePaymentNumber(
    tx: Prisma.TransactionClient,
    businessId: string,
    paymentDate: Date,
  ): Promise<string> {
    const datePart = [
      paymentDate.getUTCFullYear(),
      String(paymentDate.getUTCMonth() + 1).padStart(2, '0'),
      String(paymentDate.getUTCDate()).padStart(2, '0'),
    ].join('');

    const prefix = `CPAY-${datePart}-`;

    const latest = await tx.customerPayment.findFirst({
      where: {
        businessId,
        paymentNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        paymentNumber: 'desc',
      },
      select: {
        paymentNumber: true,
      },
    });

    const previousSequence = latest
      ? Number.parseInt(latest.paymentNumber.slice(prefix.length), 10)
      : 0;

    const nextSequence = Number.isFinite(previousSequence)
      ? previousSequence + 1
      : 1;

    return `${prefix}${String(nextSequence).padStart(5, '0')}`;
  }

  private paymentInclude() {
    return {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
        },
      },
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    } satisfies Prisma.CustomerPaymentInclude;
  }

  private startOfDay(value: string): Date {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);

    return date;
  }

  private endOfDay(value: string): Date {
    const date = new Date(value);
    date.setUTCHours(23, 59, 59, 999);

    return date;
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
