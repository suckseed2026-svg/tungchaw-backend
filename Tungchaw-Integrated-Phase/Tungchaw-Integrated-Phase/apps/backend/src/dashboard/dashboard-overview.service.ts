import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DashboardDateRange,
  DashboardPeriodService,
} from './dashboard-period.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

type AggregateRow = {
  amount: Prisma.Decimal | number | string | null;
  count: bigint | number | string;
};

type SalesAggregateRow = AggregateRow & {
  grossProfit: Prisma.Decimal | number | string | null;
  costTotal: Prisma.Decimal | number | string | null;
  creditAmount: Prisma.Decimal | number | string | null;
};

type OverviewMetric = {
  value: string;
  previousValue: string;
  changeAmount: string;
  changePercentage: string | null;
  direction: 'UP' | 'DOWN' | 'UNCHANGED';
};

@Injectable()
export class DashboardOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodService: DashboardPeriodService,
  ) {}

  async getOverview(
    businessId: string,
    timezone: string,
    currency: string,
    query: DashboardQueryDto,
  ) {
    const range = this.periodService.resolve(query, timezone);
    const branchId = query.branchId;

    const [
      currentSales,
      previousSales,
      currentPurchases,
      previousPurchases,
      currentSaleReturns,
      previousSaleReturns,
      currentPurchaseReturns,
      previousPurchaseReturns,
      currentSalePayments,
      previousSalePayments,
      currentCustomerPayments,
      previousCustomerPayments,
      currentPurchasePayments,
      previousPurchasePayments,
    ] = await Promise.all([
      this.getSalesAggregate(businessId, branchId, range.from, range.to),
      this.getSalesAggregate(
        businessId,
        branchId,
        range.previousFrom,
        range.previousTo,
      ),
      this.getPurchaseAggregate(businessId, branchId, range.from, range.to),
      this.getPurchaseAggregate(
        businessId,
        branchId,
        range.previousFrom,
        range.previousTo,
      ),
      this.getSaleReturnAggregate(businessId, branchId, range.from, range.to),
      this.getSaleReturnAggregate(
        businessId,
        branchId,
        range.previousFrom,
        range.previousTo,
      ),
      this.getPurchaseReturnAggregate(
        businessId,
        branchId,
        range.from,
        range.to,
      ),
      this.getPurchaseReturnAggregate(
        businessId,
        branchId,
        range.previousFrom,
        range.previousTo,
      ),
      this.getSalePaymentAggregate(businessId, branchId, range.from, range.to),
      this.getSalePaymentAggregate(
        businessId,
        branchId,
        range.previousFrom,
        range.previousTo,
      ),
      this.getCustomerPaymentAggregate(
        businessId,
        branchId,
        range.from,
        range.to,
      ),
      this.getCustomerPaymentAggregate(
        businessId,
        branchId,
        range.previousFrom,
        range.previousTo,
      ),
      this.getPurchasePaymentAggregate(
        businessId,
        branchId,
        range.from,
        range.to,
      ),
      this.getPurchasePaymentAggregate(
        businessId,
        branchId,
        range.previousFrom,
        range.previousTo,
      ),
    ]);

    const currentGrossSales = this.number(currentSales.amount);
    const previousGrossSales = this.number(previousSales.amount);

    const currentSaleReturnAmount = this.number(currentSaleReturns.amount);
    const previousSaleReturnAmount = this.number(previousSaleReturns.amount);

    const currentPurchaseReturnAmount = this.number(
      currentPurchaseReturns.amount,
    );
    const previousPurchaseReturnAmount = this.number(
      previousPurchaseReturns.amount,
    );

    const currentNetSales = currentGrossSales - currentSaleReturnAmount;
    const previousNetSales = previousGrossSales - previousSaleReturnAmount;

    const currentNetPurchases =
      this.number(currentPurchases.amount) - currentPurchaseReturnAmount;

    const previousNetPurchases =
      this.number(previousPurchases.amount) - previousPurchaseReturnAmount;

    const currentGrossProfit =
      this.number(currentSales.grossProfit) -
      this.number(currentSaleReturns.grossProfit);

    const previousGrossProfit =
      this.number(previousSales.grossProfit) -
      this.number(previousSaleReturns.grossProfit);

    const currentCashIn =
      this.number(currentSalePayments.amount) +
      this.number(currentCustomerPayments.amount);

    const previousCashIn =
      this.number(previousSalePayments.amount) +
      this.number(previousCustomerPayments.amount);

    const currentCashOut = this.number(currentPurchasePayments.amount);
    const previousCashOut = this.number(previousPurchasePayments.amount);

    const currentNetCashFlow = currentCashIn - currentCashOut;
    const previousNetCashFlow = previousCashIn - previousCashOut;

    return {
      generatedAt: new Date().toISOString(),
      scope: this.scope(businessId, branchId, range),
      currency,

      sales: {
        netSales: this.metric(currentNetSales, previousNetSales),
        grossSales: this.metric(currentGrossSales, previousGrossSales),
        returns: this.metric(currentSaleReturnAmount, previousSaleReturnAmount),
        grossProfit: this.metric(currentGrossProfit, previousGrossProfit),
        costOfGoods: this.metric(
          this.number(currentSales.costTotal),
          this.number(previousSales.costTotal),
        ),
        creditCreated: this.metric(
          this.number(currentSales.creditAmount),
          this.number(previousSales.creditAmount),
        ),
        transactionCount: this.countMetric(
          currentSales.count,
          previousSales.count,
        ),
        returnCount: this.countMetric(
          currentSaleReturns.count,
          previousSaleReturns.count,
        ),
        averageSaleValue: this.metric(
          this.average(currentNetSales, currentSales.count),
          this.average(previousNetSales, previousSales.count),
        ),
        grossMarginPercentage: this.percentageMetric(
          this.percentage(currentGrossProfit, currentNetSales),
          this.percentage(previousGrossProfit, previousNetSales),
        ),
      },

      purchases: {
        netPurchases: this.metric(currentNetPurchases, previousNetPurchases),
        grossPurchases: this.metric(
          this.number(currentPurchases.amount),
          this.number(previousPurchases.amount),
        ),
        returns: this.metric(
          currentPurchaseReturnAmount,
          previousPurchaseReturnAmount,
        ),
        transactionCount: this.countMetric(
          currentPurchases.count,
          previousPurchases.count,
        ),
        returnCount: this.countMetric(
          currentPurchaseReturns.count,
          previousPurchaseReturns.count,
        ),
      },

      payments: {
        salePaymentsReceived: this.metric(
          this.number(currentSalePayments.amount),
          this.number(previousSalePayments.amount),
        ),
        customerDebtPaymentsReceived: this.metric(
          this.number(currentCustomerPayments.amount),
          this.number(previousCustomerPayments.amount),
        ),
        supplierPaymentsMade: this.metric(currentCashOut, previousCashOut),
        totalCashIn: this.metric(currentCashIn, previousCashIn),
        totalCashOut: this.metric(currentCashOut, previousCashOut),
        netCashFlow: this.metric(currentNetCashFlow, previousNetCashFlow),
      },
    };
  }

  private getSalesAggregate(
    businessId: string,
    branchId: string | undefined,
    from: Date,
    to: Date,
  ): Promise<SalesAggregateRow> {
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma
      .$queryRaw<SalesAggregateRow[]>(
        Prisma.sql`
        SELECT
          COALESCE(SUM("totalAmount"), 0) AS amount,
          COALESCE(SUM("grossProfit"), 0) AS "grossProfit",
          COALESCE(SUM("costTotal"), 0) AS "costTotal",
          COALESCE(SUM("creditAmount"), 0) AS "creditAmount",
          COUNT(*) AS count
        FROM "Sale"
        WHERE "businessId" = ${businessId}
          AND status = 'COMPLETED'
          ${branchFilter}
          AND "completedAt" >= ${from}
          AND "completedAt" < ${to}
      `,
      )
      .then((rows) => this.salesRow(rows[0]));
  }

  private getPurchaseAggregate(
    businessId: string,
    branchId: string | undefined,
    from: Date,
    to: Date,
  ): Promise<AggregateRow> {
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma
      .$queryRaw<AggregateRow[]>(
        Prisma.sql`
        SELECT
          COALESCE(SUM("totalAmount"), 0) AS amount,
          COUNT(*) AS count
        FROM "Purchase"
        WHERE "businessId" = ${businessId}
          AND status = 'RECEIVED'
          ${branchFilter}
          AND "receivedAt" >= ${from}
          AND "receivedAt" < ${to}
      `,
      )
      .then((rows) => this.aggregateRow(rows[0]));
  }

  private getSaleReturnAggregate(
    businessId: string,
    branchId: string | undefined,
    from: Date,
    to: Date,
  ): Promise<SalesAggregateRow> {
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma
      .$queryRaw<SalesAggregateRow[]>(
        Prisma.sql`
        SELECT
          COALESCE(SUM("totalAmount"), 0) AS amount,
          COALESCE(SUM("profitImpact"), 0) AS "grossProfit",
          COALESCE(SUM("costAmount"), 0) AS "costTotal",
          COALESCE(SUM("creditAdjustmentAmount"), 0) AS "creditAmount",
          COUNT(*) AS count
        FROM "SaleReturn"
        WHERE "businessId" = ${businessId}
          AND status = 'COMPLETED'
          ${branchFilter}
          AND "returnDate" >= ${from}
          AND "returnDate" < ${to}
      `,
      )
      .then((rows) => this.salesRow(rows[0]));
  }

  private getPurchaseReturnAggregate(
    businessId: string,
    branchId: string | undefined,
    from: Date,
    to: Date,
  ): Promise<AggregateRow> {
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma
      .$queryRaw<AggregateRow[]>(
        Prisma.sql`
        SELECT
          COALESCE(SUM("totalAmount"), 0) AS amount,
          COUNT(*) AS count
        FROM "PurchaseReturn"
        WHERE "businessId" = ${businessId}
          AND status = 'COMPLETED'
          ${branchFilter}
          AND "returnDate" >= ${from}
          AND "returnDate" < ${to}
      `,
      )
      .then((rows) => this.aggregateRow(rows[0]));
  }

  private getSalePaymentAggregate(
    businessId: string,
    branchId: string | undefined,
    from: Date,
    to: Date,
  ): Promise<AggregateRow> {
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma
      .$queryRaw<AggregateRow[]>(
        Prisma.sql`
        SELECT
          COALESCE(SUM(amount), 0) AS amount,
          COUNT(*) AS count
        FROM "SalePayment"
        WHERE "businessId" = ${businessId}
          ${branchFilter}
          AND "paymentDate" >= ${from}
          AND "paymentDate" < ${to}
      `,
      )
      .then((rows) => this.aggregateRow(rows[0]));
  }

  private getCustomerPaymentAggregate(
    businessId: string,
    branchId: string | undefined,
    from: Date,
    to: Date,
  ): Promise<AggregateRow> {
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma
      .$queryRaw<AggregateRow[]>(
        Prisma.sql`
        SELECT
          COALESCE(SUM(amount), 0) AS amount,
          COUNT(*) AS count
        FROM "CustomerPayment"
        WHERE "businessId" = ${businessId}
          ${branchFilter}
          AND "paymentDate" >= ${from}
          AND "paymentDate" < ${to}
      `,
      )
      .then((rows) => this.aggregateRow(rows[0]));
  }

  private getPurchasePaymentAggregate(
    businessId: string,
    branchId: string | undefined,
    from: Date,
    to: Date,
  ): Promise<AggregateRow> {
    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma
      .$queryRaw<AggregateRow[]>(
        Prisma.sql`
        SELECT
          COALESCE(SUM(amount), 0) AS amount,
          COUNT(*) AS count
        FROM "PurchasePayment"
        WHERE "businessId" = ${businessId}
          ${branchFilter}
          AND "paymentDate" >= ${from}
          AND "paymentDate" < ${to}
      `,
      )
      .then((rows) => this.aggregateRow(rows[0]));
  }

  private scope(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
  ) {
    return {
      businessId,
      branchId: branchId ?? null,
      period: range.period,
      timezone: range.timezone,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      previousFrom: range.previousFrom.toISOString(),
      previousTo: range.previousTo.toISOString(),
    };
  }

  private metric(currentValue: number, previousValue: number): OverviewMetric {
    const difference = currentValue - previousValue;

    return {
      value: this.money(currentValue),
      previousValue: this.money(previousValue),
      changeAmount: this.money(difference),
      changePercentage: this.changePercentage(currentValue, previousValue),
      direction: this.direction(difference),
    };
  }

  private countMetric(currentValue: unknown, previousValue: unknown) {
    const current = this.integer(currentValue);
    const previous = this.integer(previousValue);
    const difference = current - previous;

    return {
      value: current,
      previousValue: previous,
      changeAmount: difference,
      changePercentage: this.changePercentage(current, previous),
      direction: this.direction(difference),
    };
  }

  private percentageMetric(currentValue: number, previousValue: number) {
    const difference = currentValue - previousValue;

    return {
      value: currentValue.toFixed(2),
      previousValue: previousValue.toFixed(2),
      changeAmount: difference.toFixed(2),
      changePercentage: this.changePercentage(currentValue, previousValue),
      direction: this.direction(difference),
    };
  }

  private changePercentage(
    currentValue: number,
    previousValue: number,
  ): string | null {
    if (previousValue === 0) {
      return currentValue === 0 ? '0.00' : null;
    }

    return (
      ((currentValue - previousValue) / Math.abs(previousValue)) *
      100
    ).toFixed(2);
  }

  private direction(difference: number): 'UP' | 'DOWN' | 'UNCHANGED' {
    if (difference > 0) {
      return 'UP';
    }

    if (difference < 0) {
      return 'DOWN';
    }

    return 'UNCHANGED';
  }

  private average(amount: number, count: unknown): number {
    const totalCount = this.integer(count);
    return totalCount > 0 ? amount / totalCount : 0;
  }

  private percentage(part: number, total: number): number {
    return total !== 0 ? (part / total) * 100 : 0;
  }

  private aggregateRow(row?: AggregateRow): AggregateRow {
    return {
      amount: row?.amount ?? 0,
      count: row?.count ?? 0,
    };
  }

  private salesRow(row?: SalesAggregateRow): SalesAggregateRow {
    return {
      amount: row?.amount ?? 0,
      count: row?.count ?? 0,
      grossProfit: row?.grossProfit ?? 0,
      costTotal: row?.costTotal ?? 0,
      creditAmount: row?.creditAmount ?? 0,
    };
  }

  private number(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private integer(value: unknown): number {
    return Math.trunc(this.number(value));
  }

  private money(value: unknown): string {
    return this.number(value).toFixed(2);
  }
}
