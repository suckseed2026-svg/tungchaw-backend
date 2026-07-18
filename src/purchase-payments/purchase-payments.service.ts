import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchasePaymentDto } from './dto/create-purchase-payment.dto';

@Injectable()
export class PurchasePaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    businessId: string,
    purchaseId: string,
    createdById: string,
    dto: CreatePurchasePaymentDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const purchase = await tx.purchase.findFirst({
          where: {
            id: purchaseId,
            businessId,
          },
          select: {
            id: true,
            businessId: true,
            branchId: true,
            supplierId: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
          },
        });

        if (!purchase) {
          throw new NotFoundException('Purchase not found.');
        }

        if (purchase.status !== PurchaseStatus.RECEIVED) {
          throw new BadRequestException(
            'Payments can only be recorded for received purchases.',
          );
        }

        const amount = new Prisma.Decimal(dto.amount);

        if (amount.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'Payment amount must be greater than zero.',
          );
        }

        const paymentAggregate = await tx.purchasePayment.aggregate({
          where: {
            businessId,
            purchaseId,
          },
          _sum: {
            amount: true,
          },
        });

        const totalPaid = paymentAggregate._sum.amount ?? new Prisma.Decimal(0);
        const outstandingAmount = purchase.totalAmount.minus(totalPaid);

        if (outstandingAmount.lessThanOrEqualTo(0)) {
          throw new BadRequestException('This purchase is already fully paid.');
        }

        if (amount.greaterThan(outstandingAmount)) {
          throw new BadRequestException(
            `Payment exceeds the outstanding amount of ${outstandingAmount.toFixed(2)}.`,
          );
        }

        const payment = await tx.purchasePayment.create({
          data: {
            businessId,
            purchaseId,
            supplierId: purchase.supplierId,
            branchId: purchase.branchId,
            createdById,
            paymentDate: new Date(dto.paymentDate),
            amount,
            paymentMethod: dto.paymentMethod,
            referenceNumber: dto.referenceNumber?.trim() || null,
            notes: dto.notes?.trim() || null,
          },
          include: this.paymentInclude(),
        });

        return {
          payment,
          summary: this.buildSummary(
            purchase.totalAmount,
            totalPaid.plus(amount),
          ),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async findAll(businessId: string, purchaseId: string) {
    const purchase = await this.findPurchaseOrThrow(businessId, purchaseId);

    const payments = await this.prisma.purchasePayment.findMany({
      where: {
        businessId,
        purchaseId,
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      include: this.paymentInclude(),
    });

    const totalPaid = payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    );

    return {
      purchase: {
        id: purchase.id,
        invoiceNumber: purchase.invoiceNumber,
        totalAmount: purchase.totalAmount,
      },
      payments,
      summary: this.buildSummary(purchase.totalAmount, totalPaid),
    };
  }

  async findOne(
    businessId: string,
    purchaseId: string,
    paymentId: string,
  ) {
    const payment = await this.prisma.purchasePayment.findFirst({
      where: {
        id: paymentId,
        businessId,
        purchaseId,
      },
      include: this.paymentInclude(),
    });

    if (!payment) {
      throw new NotFoundException('Purchase payment not found.');
    }

    return payment;
  }

  private async findPurchaseOrThrow(
    businessId: string,
    purchaseId: string,
  ) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId,
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found.');
    }

    return purchase;
  }

  private buildSummary(
    totalAmount: Prisma.Decimal,
    totalPaid: Prisma.Decimal,
  ) {
    const outstandingAmount = Prisma.Decimal.max(
      totalAmount.minus(totalPaid),
      new Prisma.Decimal(0),
    );

    let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';

    if (totalPaid.greaterThanOrEqualTo(totalAmount)) {
      paymentStatus = 'PAID';
    } else if (totalPaid.greaterThan(0)) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    return {
      totalAmount,
      totalPaid,
      outstandingAmount,
      paymentStatus,
    };
  }

  private paymentInclude() {
    return {
      supplier: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    } satisfies Prisma.PurchasePaymentInclude;
  }
}
