import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DashboardDateRange,
  DashboardPeriodService,
} from './dashboard-period.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

type SalesSummaryRow = {
  salesAmount: Prisma.Decimal | number | string | null;
  grossProfit: Prisma.Decimal | number | string | null;
  costTotal: Prisma.Decimal | number | string | null;
  discountTotal: Prisma.Decimal | number | string | null;
  taxAmount: Prisma.Decimal | number | string | null;
  quantitySold: Prisma.Decimal | number | string | null;
  transactionCount: bigint | number | string;
  customerCount: bigint | number | string;
};

type RankedProductRow = {
  productId: string;
  productName: string;
  productCode: string;
  quantitySold: Prisma.Decimal | number | string | null;
  revenue: Prisma.Decimal | number | string | null;
  cost: Prisma.Decimal | number | string | null;
  profit: Prisma.Decimal | number | string | null;
  transactionCount: bigint | number | string;
};

type RankedGroupRow = {
  name: string;
  quantitySold: Prisma.Decimal | number | string | null;
  revenue: Prisma.Decimal | number | string | null;
  profit: Prisma.Decimal | number | string | null;
  transactionCount: bigint | number | string;
};

type PaymentMethodRow = {
  paymentMethod: string;
  amount: Prisma.Decimal | number | string | null;
  paymentCount: bigint | number | string;
};

type BranchPerformanceRow = {
  branchId: string;
  branchName: string;
  salesAmount: Prisma.Decimal | number | string | null;
  grossProfit: Prisma.Decimal | number | string | null;
  transactionCount: bigint | number | string;
  customerCount: bigint | number | string;
};

type RecentSaleRow = {
  id: string;
  saleNumber: string;
  saleDate: Date;
  completedAt: Date;
  totalAmount: Prisma.Decimal | number | string;
  grossProfit: Prisma.Decimal | number | string;
  paymentStatus: string;
  source: string;
  branchId: string;
  branchName: string;
  customerId: string | null;
  customerName: string | null;
  createdById: string;
  createdByName: string;
  itemCount: bigint | number | string;
  quantitySold: Prisma.Decimal | number | string | null;
};

@Injectable()
export class DashboardSalesAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodService: DashboardPeriodService,
  ) {}

  async getSalesAnalysis(
    businessId: string,
    timezone: string,
    currency: string,
    query: DashboardQueryDto,
  ) {
    await this.validateBranch(businessId, query.branchId);

    const range = this.periodService.resolve(query, timezone);
    const limit = query.limit ?? 10;

    const [
      summaryRows,
      topProductsByRevenue,
      topProductsByProfit,
      topProductsByQuantity,
      topCategories,
      topBrands,
      paymentMethods,
      branchPerformance,
      recentSales,
    ] = await Promise.all([
      this.getSummary(businessId, query.branchId, range),
      this.getTopProducts(businessId, query.branchId, range, limit, 'REVENUE'),
      this.getTopProducts(businessId, query.branchId, range, limit, 'PROFIT'),
      this.getTopProducts(businessId, query.branchId, range, limit, 'QUANTITY'),
      this.getTopGroups(businessId, query.branchId, range, limit, 'CATEGORY'),
      this.getTopGroups(businessId, query.branchId, range, limit, 'BRAND'),
      this.getPaymentMethods(businessId, query.branchId, range),
      this.getBranchPerformance(businessId, query.branchId, range, limit),
      this.getRecentSales(businessId, query.branchId, range, limit),
    ]);

    const summary = summaryRows[0];
    const salesAmount = this.number(summary?.salesAmount);
    const grossProfit = this.number(summary?.grossProfit);
    const transactionCount = this.integer(summary?.transactionCount);

    return {
      generatedAt: new Date().toISOString(),
      currency,
      scope: this.scope(businessId, query.branchId, range),
      summary: {
        salesAmount: this.money(summary?.salesAmount),
        grossProfit: this.money(summary?.grossProfit),
        costOfGoods: this.money(summary?.costTotal),
        discountTotal: this.money(summary?.discountTotal),
        taxAmount: this.money(summary?.taxAmount),
        quantitySold: this.quantity(summary?.quantitySold),
        transactionCount,
        uniqueCustomers: this.integer(summary?.customerCount),
        averageSaleValue: this.money(
          transactionCount > 0 ? salesAmount / transactionCount : 0,
        ),
        grossMarginPercentage: this.percentage(grossProfit, salesAmount),
      },
      topProductsByRevenue: topProductsByRevenue.map((row) =>
        this.productResult(row),
      ),
      topProductsByProfit: topProductsByProfit.map((row) =>
        this.productResult(row),
      ),
      topProductsByQuantity: topProductsByQuantity.map((row) =>
        this.productResult(row),
      ),
      topCategories: topCategories.map((row) => this.groupResult(row)),
      topBrands: topBrands.map((row) => this.groupResult(row)),
      paymentMethods: paymentMethods.map((row) => ({
        paymentMethod: row.paymentMethod,
        amount: this.money(row.amount),
        paymentCount: this.integer(row.paymentCount),
        percentageOfPayments: this.percentage(
          this.number(row.amount),
          paymentMethods.reduce(
            (total, item) => total + this.number(item.amount),
            0,
          ),
        ),
      })),
      branchPerformance: branchPerformance.map((row) => ({
        branchId: row.branchId,
        branchName: row.branchName,
        salesAmount: this.money(row.salesAmount),
        grossProfit: this.money(row.grossProfit),
        transactionCount: this.integer(row.transactionCount),
        uniqueCustomers: this.integer(row.customerCount),
        averageSaleValue: this.money(
          this.integer(row.transactionCount) > 0
            ? this.number(row.salesAmount) / this.integer(row.transactionCount)
            : 0,
        ),
        grossMarginPercentage: this.percentage(
          this.number(row.grossProfit),
          this.number(row.salesAmount),
        ),
      })),
      recentSales: recentSales.map((row) => ({
        id: row.id,
        saleNumber: row.saleNumber,
        saleDate: row.saleDate,
        completedAt: row.completedAt,
        totalAmount: this.money(row.totalAmount),
        grossProfit: this.money(row.grossProfit),
        paymentStatus: row.paymentStatus,
        source: row.source,
        branch: {
          id: row.branchId,
          name: row.branchName,
        },
        customer: row.customerId
          ? {
              id: row.customerId,
              name: row.customerName,
            }
          : null,
        createdBy: {
          id: row.createdById,
          name: row.createdByName,
        },
        itemCount: this.integer(row.itemCount),
        quantitySold: this.quantity(row.quantitySold),
      })),
    };
  }

  private getSummary(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<SalesSummaryRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(s."totalAmount"), 0) AS "salesAmount",
        COALESCE(SUM(s."grossProfit"), 0) AS "grossProfit",
        COALESCE(SUM(s."costTotal"), 0) AS "costTotal",
        COALESCE(
          SUM(s."itemDiscountTotal" + s."billDiscount"),
          0
        ) AS "discountTotal",
        COALESCE(SUM(s."taxAmount"), 0) AS "taxAmount",
        COALESCE(
          (
            SELECT SUM(si.quantity)
            FROM "SaleItem" si
            INNER JOIN "Sale" item_sale
              ON item_sale.id = si."saleId"
            WHERE item_sale."businessId" = ${businessId}
              AND item_sale.status = 'COMPLETED'
              ${
                branchId
                  ? Prisma.sql`AND item_sale."branchId" = ${branchId}`
                  : Prisma.empty
              }
              AND item_sale."completedAt" >= ${range.from}
              AND item_sale."completedAt" < ${range.to}
          ),
          0
        ) AS "quantitySold",
        COUNT(*) AS "transactionCount",
        COUNT(DISTINCT s."customerId") FILTER (
          WHERE s."customerId" IS NOT NULL
        ) AS "customerCount"
      FROM "Sale" s
      WHERE s."businessId" = ${businessId}
        AND s.status = 'COMPLETED'
        ${branchFilter}
        AND s."completedAt" >= ${range.from}
        AND s."completedAt" < ${range.to}
    `);
  }

  private getTopProducts(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
    limit: number,
    sortBy: 'REVENUE' | 'PROFIT' | 'QUANTITY',
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.empty;

    const orderBy =
      sortBy === 'PROFIT'
        ? Prisma.sql`profit DESC`
        : sortBy === 'QUANTITY'
          ? Prisma.sql`"quantitySold" DESC`
          : Prisma.sql`revenue DESC`;

    return this.prisma.$queryRaw<RankedProductRow[]>(Prisma.sql`
      SELECT
        si."productId",
        MAX(si."productName") AS "productName",
        MAX(si."productCode") AS "productCode",
        COALESCE(SUM(si.quantity), 0) AS "quantitySold",
        COALESCE(SUM(si."lineTotal"), 0) AS revenue,
        COALESCE(SUM(si."lineCost"), 0) AS cost,
        COALESCE(SUM(si."lineProfit"), 0) AS profit,
        COUNT(DISTINCT si."saleId") AS "transactionCount"
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."businessId" = ${businessId}
        AND s.status = 'COMPLETED'
        ${branchFilter}
        AND s."completedAt" >= ${range.from}
        AND s."completedAt" < ${range.to}
      GROUP BY si."productId"
      ORDER BY ${orderBy}, "productName" ASC
      LIMIT ${limit}
    `);
  }

  private getTopGroups(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
    limit: number,
    groupType: 'CATEGORY' | 'BRAND',
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.empty;

    const groupExpression =
      groupType === 'CATEGORY'
        ? Prisma.sql`COALESCE(si."categoryName", 'Uncategorized')`
        : Prisma.sql`COALESCE(si."brandName", 'Unbranded')`;

    return this.prisma.$queryRaw<RankedGroupRow[]>(Prisma.sql`
      SELECT
        ${groupExpression} AS name,
        COALESCE(SUM(si.quantity), 0) AS "quantitySold",
        COALESCE(SUM(si."lineTotal"), 0) AS revenue,
        COALESCE(SUM(si."lineProfit"), 0) AS profit,
        COUNT(DISTINCT si."saleId") AS "transactionCount"
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."businessId" = ${businessId}
        AND s.status = 'COMPLETED'
        ${branchFilter}
        AND s."completedAt" >= ${range.from}
        AND s."completedAt" < ${range.to}
      GROUP BY ${groupExpression}
      ORDER BY revenue DESC, name ASC
      LIMIT ${limit}
    `);
  }

  private getPaymentMethods(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND sp."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<PaymentMethodRow[]>(Prisma.sql`
      SELECT
        sp."paymentMethod"::text AS "paymentMethod",
        COALESCE(SUM(sp.amount), 0) AS amount,
        COUNT(*) AS "paymentCount"
      FROM "SalePayment" sp
      WHERE sp."businessId" = ${businessId}
        ${branchFilter}
        AND sp."paymentDate" >= ${range.from}
        AND sp."paymentDate" < ${range.to}
      GROUP BY sp."paymentMethod"
      ORDER BY amount DESC, "paymentMethod" ASC
    `);
  }

  private getBranchPerformance(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
    limit: number,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<BranchPerformanceRow[]>(Prisma.sql`
      SELECT
        b.id AS "branchId",
        b.name AS "branchName",
        COALESCE(SUM(s."totalAmount"), 0) AS "salesAmount",
        COALESCE(SUM(s."grossProfit"), 0) AS "grossProfit",
        COUNT(s.id) AS "transactionCount",
        COUNT(DISTINCT s."customerId") FILTER (
          WHERE s."customerId" IS NOT NULL
        ) AS "customerCount"
      FROM "Sale" s
      INNER JOIN "Branch" b ON b.id = s."branchId"
      WHERE s."businessId" = ${businessId}
        AND s.status = 'COMPLETED'
        ${branchFilter}
        AND s."completedAt" >= ${range.from}
        AND s."completedAt" < ${range.to}
      GROUP BY b.id, b.name
      ORDER BY "salesAmount" DESC, b.name ASC
      LIMIT ${limit}
    `);
  }

  private getRecentSales(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
    limit: number,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<RecentSaleRow[]>(Prisma.sql`
      SELECT
        s.id,
        s."saleNumber",
        s."saleDate",
        s."completedAt",
        s."totalAmount",
        s."grossProfit",
        s."paymentStatus"::text AS "paymentStatus",
        s.source::text AS source,
        b.id AS "branchId",
        b.name AS "branchName",
        c.id AS "customerId",
        c.name AS "customerName",
        u.id AS "createdById",
        u.name AS "createdByName",
        COUNT(si.id) AS "itemCount",
        COALESCE(SUM(si.quantity), 0) AS "quantitySold"
      FROM "Sale" s
      INNER JOIN "Branch" b ON b.id = s."branchId"
      INNER JOIN "User" u ON u.id = s."createdById"
      LEFT JOIN "Customer" c ON c.id = s."customerId"
      LEFT JOIN "SaleItem" si ON si."saleId" = s.id
      WHERE s."businessId" = ${businessId}
        AND s.status = 'COMPLETED'
        ${branchFilter}
        AND s."completedAt" >= ${range.from}
        AND s."completedAt" < ${range.to}
      GROUP BY
        s.id,
        b.id,
        b.name,
        c.id,
        c.name,
        u.id,
        u.name
      ORDER BY s."completedAt" DESC
      LIMIT ${limit}
    `);
  }

  private productResult(row: RankedProductRow) {
    return {
      productId: row.productId,
      productName: row.productName,
      productCode: row.productCode,
      quantitySold: this.quantity(row.quantitySold),
      revenue: this.money(row.revenue),
      cost: this.money(row.cost),
      profit: this.money(row.profit),
      transactionCount: this.integer(row.transactionCount),
      grossMarginPercentage: this.percentage(
        this.number(row.profit),
        this.number(row.revenue),
      ),
    };
  }

  private groupResult(row: RankedGroupRow) {
    return {
      name: row.name,
      quantitySold: this.quantity(row.quantitySold),
      revenue: this.money(row.revenue),
      profit: this.money(row.profit),
      transactionCount: this.integer(row.transactionCount),
      grossMarginPercentage: this.percentage(
        this.number(row.profit),
        this.number(row.revenue),
      ),
    };
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
    };
  }

  private async validateBranch(
    businessId: string,
    branchId?: string,
  ): Promise<void> {
    if (!branchId) {
      return;
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        businessId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!branch) {
      throw new BadRequestException(
        'Branch does not exist, is inactive, or does not belong to this business',
      );
    }
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

  private quantity(value: unknown): string {
    return this.number(value).toFixed(3);
  }

  private percentage(part: number, total: number): string {
    if (total === 0) {
      return '0.00';
    }

    return ((part / total) * 100).toFixed(2);
  }
}
