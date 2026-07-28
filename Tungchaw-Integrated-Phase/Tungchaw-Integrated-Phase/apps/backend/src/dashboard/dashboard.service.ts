import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type MoneyRow = {
  total: Prisma.Decimal | number | string | null;
  count: bigint | number | string;
};

type SummaryCountsRow = {
  branches: bigint | number | string;
  products: bigint | number | string;
  customers: bigint | number | string;
  suppliers: bigint | number | string;
};

type InventoryTotalsRow = {
  inventoryValue: Prisma.Decimal | number | string | null;
  retailValue: Prisma.Decimal | number | string | null;
  totalQuantity: Prisma.Decimal | number | string | null;
  stockRows: bigint | number | string;
  lowStockRows: bigint | number | string;
  outOfStockRows: bigint | number | string;
};

type TrendRow = {
  day: Date | string;
  total: Prisma.Decimal | number | string | null;
  count: bigint | number | string;
  grossProfit: Prisma.Decimal | number | string | null;
};

type RecentSaleRow = {
  id: string;
  saleNumber: string;
  saleDate: Date;
  totalAmount: Prisma.Decimal | number | string;
  paymentStatus: string;
  branchName: string;
  customerName: string | null;
};

type LowStockRow = {
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: Prisma.Decimal | number | string;
  reorderLevel: Prisma.Decimal | number | string;
};

type ActivityRow = {
  id: string;
  activityType: string;
  title: string;
  description: string | null;
  branchName: string | null;
  occurredAt: Date;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    businessId: string,
    timezone: string,
    currency: string,
    branchId?: string,
  ) {
    await this.validateBranch(businessId, branchId);

    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    const [salesRows, purchaseRows, countsRows, inventoryRows, creditRows] =
      await Promise.all([
        this.prisma.$queryRaw<MoneyRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM("totalAmount"), 0) AS total,
            COUNT(*) AS count
          FROM "Sale"
          WHERE "businessId" = ${businessId}
            AND status = 'COMPLETED'
            ${branchFilter}
            AND ("completedAt" AT TIME ZONE ${timezone})::date =
                (NOW() AT TIME ZONE ${timezone})::date
        `),
        this.prisma.$queryRaw<MoneyRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM("totalAmount"), 0) AS total,
            COUNT(*) AS count
          FROM "Purchase"
          WHERE "businessId" = ${businessId}
            AND status = 'RECEIVED'
            ${branchFilter}
            AND ("receivedAt" AT TIME ZONE ${timezone})::date =
                (NOW() AT TIME ZONE ${timezone})::date
        `),
        this.prisma.$queryRaw<SummaryCountsRow[]>(Prisma.sql`
          SELECT
            (
              SELECT COUNT(*)
              FROM "Branch"
              WHERE "businessId" = ${businessId}
                AND "isActive" = true
                ${branchId ? Prisma.sql`AND id = ${branchId}` : Prisma.empty}
            ) AS branches,
            (
              SELECT COUNT(*)
              FROM "Product"
              WHERE "businessId" = ${businessId}
                AND "isActive" = true
            ) AS products,
            (
              SELECT COUNT(*)
              FROM "Customer"
              WHERE "businessId" = ${businessId}
                AND "isActive" = true
            ) AS customers,
            (
              SELECT COUNT(*)
              FROM "Supplier"
              WHERE "businessId" = ${businessId}
                AND "isActive" = true
            ) AS suppliers
        `),
        this.getInventoryTotals(businessId, branchId),
        this.prisma.$queryRaw<MoneyRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM("creditAmount"), 0) AS total,
            COUNT(*) FILTER (WHERE "creditAmount" > 0) AS count
          FROM "Sale"
          WHERE "businessId" = ${businessId}
            AND status = 'COMPLETED'
            ${branchFilter}
        `),
      ]);

    const sales = salesRows[0];
    const purchases = purchaseRows[0];
    const counts = countsRows[0];
    const inventory = inventoryRows[0];
    const credit = creditRows[0];

    const todayProfitRows = await this.prisma.$queryRaw<MoneyRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM("grossProfit"), 0) AS total,
        COUNT(*) AS count
      FROM "Sale"
      WHERE "businessId" = ${businessId}
        AND status = 'COMPLETED'
        ${branchFilter}
        AND ("completedAt" AT TIME ZONE ${timezone})::date =
            (NOW() AT TIME ZONE ${timezone})::date
    `);

    return {
      generatedAt: new Date().toISOString(),
      timezone,
      currency,
      branchId: branchId ?? null,
      today: {
        salesAmount: this.money(sales?.total),
        salesCount: this.integer(sales?.count),
        purchasesAmount: this.money(purchases?.total),
        purchasesCount: this.integer(purchases?.count),
        grossProfit: this.money(todayProfitRows[0]?.total),
      },
      inventory: {
        valueAtCost: this.money(inventory?.inventoryValue),
        retailValue: this.money(inventory?.retailValue),
        totalQuantity: this.quantity(inventory?.totalQuantity),
        lowStockRows: this.integer(inventory?.lowStockRows),
        outOfStockRows: this.integer(inventory?.outOfStockRows),
      },
      receivables: {
        customerCredit: this.money(credit?.total),
        creditSalesCount: this.integer(credit?.count),
      },
      totals: {
        activeBranches: this.integer(counts?.branches),
        activeProducts: this.integer(counts?.products),
        activeCustomers: this.integer(counts?.customers),
        activeSuppliers: this.integer(counts?.suppliers),
      },
    };
  }

  async getSalesDashboard(
    businessId: string,
    timezone: string,
    currency: string,
    branchId: string | undefined,
    days: number,
  ) {
    await this.validateBranch(businessId, branchId);

    const branchFilter = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.empty;

    const trend = await this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT
        (s."completedAt" AT TIME ZONE ${timezone})::date AS day,
        COALESCE(SUM(s."totalAmount"), 0) AS total,
        COUNT(*) AS count,
        COALESCE(SUM(s."grossProfit"), 0) AS "grossProfit"
      FROM "Sale" s
      WHERE s."businessId" = ${businessId}
        AND s.status = 'COMPLETED'
        ${branchFilter}
        AND s."completedAt" >= NOW() - (${days} * INTERVAL '1 day')
      GROUP BY day
      ORDER BY day ASC
    `);

    const recentSales = await this.prisma.$queryRaw<RecentSaleRow[]>(Prisma.sql`
      SELECT
        s.id,
        s."saleNumber",
        s."saleDate",
        s."totalAmount",
        s."paymentStatus"::text AS "paymentStatus",
        b.name AS "branchName",
        c.name AS "customerName"
      FROM "Sale" s
      INNER JOIN "Branch" b ON b.id = s."branchId"
      LEFT JOIN "Customer" c ON c.id = s."customerId"
      WHERE s."businessId" = ${businessId}
        AND s.status = 'COMPLETED'
        ${branchFilter}
      ORDER BY s."completedAt" DESC
      LIMIT 10
    `);

    return {
      generatedAt: new Date().toISOString(),
      timezone,
      currency,
      branchId: branchId ?? null,
      days,
      trend: trend.map((row) => ({
        date: this.dateOnly(row.day),
        salesAmount: this.money(row.total),
        salesCount: this.integer(row.count),
        grossProfit: this.money(row.grossProfit),
      })),
      recentSales: recentSales.map((sale) => ({
        id: sale.id,
        saleNumber: sale.saleNumber,
        saleDate: sale.saleDate,
        totalAmount: this.money(sale.totalAmount),
        paymentStatus: sale.paymentStatus,
        branchName: sale.branchName,
        customerName: sale.customerName,
      })),
    };
  }

  async getInventoryDashboard(
    businessId: string,
    currency: string,
    branchId?: string,
  ) {
    await this.validateBranch(businessId, branchId);

    const totals = (await this.getInventoryTotals(businessId, branchId))[0];

    const branchFilter = branchId
      ? Prisma.sql`AND bs."branchId" = ${branchId}`
      : Prisma.empty;

    const lowStock = await this.prisma.$queryRaw<LowStockRow[]>(Prisma.sql`
      SELECT
        bs."branchId",
        b.name AS "branchName",
        bs."productId",
        p.name AS "productName",
        p.code AS "productCode",
        bs.quantity,
        bs."reorderLevel"
      FROM "BranchStock" bs
      INNER JOIN "Branch" b ON b.id = bs."branchId"
      INNER JOIN "Product" p ON p.id = bs."productId"
      WHERE bs."businessId" = ${businessId}
        ${branchFilter}
        AND p."isActive" = true
        AND p."trackStock" = true
        AND bs.quantity <= bs."reorderLevel"
      ORDER BY
        CASE WHEN bs.quantity <= 0 THEN 0 ELSE 1 END,
        bs.quantity ASC,
        p.name ASC
      LIMIT 25
    `);

    return {
      generatedAt: new Date().toISOString(),
      currency,
      branchId: branchId ?? null,
      totals: {
        inventoryValue: this.money(totals?.inventoryValue),
        retailValue: this.money(totals?.retailValue),
        potentialMargin: this.money(
          this.number(totals?.retailValue) -
            this.number(totals?.inventoryValue),
        ),
        totalQuantity: this.quantity(totals?.totalQuantity),
        stockRows: this.integer(totals?.stockRows),
        lowStockRows: this.integer(totals?.lowStockRows),
        outOfStockRows: this.integer(totals?.outOfStockRows),
      },
      lowStock: lowStock.map((row) => ({
        ...row,
        quantity: this.quantity(row.quantity),
        reorderLevel: this.quantity(row.reorderLevel),
      })),
    };
  }

  async getFinancialDashboard(
    businessId: string,
    timezone: string,
    currency: string,
    branchId: string | undefined,
    days: number,
  ) {
    await this.validateBranch(businessId, branchId);

    const branchFilter = branchId
      ? Prisma.sql`AND "branchId" = ${branchId}`
      : Prisma.empty;

    const [salesRows, purchaseRows, receivedPayments, supplierPayments] =
      await Promise.all([
        this.prisma.$queryRaw<MoneyRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM("totalAmount"), 0) AS total,
            COUNT(*) AS count
          FROM "Sale"
          WHERE "businessId" = ${businessId}
            AND status = 'COMPLETED'
            ${branchFilter}
            AND "completedAt" >= NOW() - (${days} * INTERVAL '1 day')
        `),
        this.prisma.$queryRaw<MoneyRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM("totalAmount"), 0) AS total,
            COUNT(*) AS count
          FROM "Purchase"
          WHERE "businessId" = ${businessId}
            AND status = 'RECEIVED'
            ${branchFilter}
            AND "receivedAt" >= NOW() - (${days} * INTERVAL '1 day')
        `),
        this.prisma.$queryRaw<MoneyRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM(amount), 0) AS total,
            COUNT(*) AS count
          FROM "SalePayment"
          WHERE "businessId" = ${businessId}
            ${branchFilter}
            AND "paymentDate" >= NOW() - (${days} * INTERVAL '1 day')
        `),
        this.prisma.$queryRaw<MoneyRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM(amount), 0) AS total,
            COUNT(*) AS count
          FROM "PurchasePayment"
          WHERE "businessId" = ${businessId}
            ${branchFilter}
            AND "paymentDate" >= NOW() - (${days} * INTERVAL '1 day')
        `),
      ]);

    const grossProfitRows = await this.prisma.$queryRaw<MoneyRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM("grossProfit"), 0) AS total,
        COUNT(*) AS count
      FROM "Sale"
      WHERE "businessId" = ${businessId}
        AND status = 'COMPLETED'
        ${branchFilter}
        AND "completedAt" >= NOW() - (${days} * INTERVAL '1 day')
    `);

    return {
      generatedAt: new Date().toISOString(),
      timezone,
      currency,
      branchId: branchId ?? null,
      days,
      sales: {
        invoiced: this.money(salesRows[0]?.total),
        transactions: this.integer(salesRows[0]?.count),
        cashReceived: this.money(receivedPayments[0]?.total),
        grossProfit: this.money(grossProfitRows[0]?.total),
      },
      purchases: {
        received: this.money(purchaseRows[0]?.total),
        transactions: this.integer(purchaseRows[0]?.count),
        supplierPayments: this.money(supplierPayments[0]?.total),
      },
      cashFlow: {
        inflow: this.money(receivedPayments[0]?.total),
        outflow: this.money(supplierPayments[0]?.total),
        net: this.money(
          this.number(receivedPayments[0]?.total) -
            this.number(supplierPayments[0]?.total),
        ),
      },
    };
  }

  async getRecentActivity(businessId: string, branchId?: string) {
    await this.validateBranch(businessId, branchId);

    const saleBranchFilter = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.empty;
    const stockBranchFilter = branchId
      ? Prisma.sql`AND sm."branchId" = ${branchId}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
      (
        SELECT
          s.id,
          'SALE'::text AS "activityType",
          ('Sale ' || s."saleNumber")::text AS title,
          ('Completed for ' || s."totalAmount"::text)::text AS description,
          b.name AS "branchName",
          s."completedAt" AS "occurredAt"
        FROM "Sale" s
        INNER JOIN "Branch" b ON b.id = s."branchId"
        WHERE s."businessId" = ${businessId}
          AND s.status = 'COMPLETED'
          ${saleBranchFilter}
      )
      UNION ALL
      (
        SELECT
          sm.id,
          ('STOCK_' || sm.type::text)::text AS "activityType",
          p.name::text AS title,
          (
            'Quantity changed by ' || sm."quantityChange"::text
          )::text AS description,
          b.name AS "branchName",
          sm."createdAt" AS "occurredAt"
        FROM "StockMovement" sm
        INNER JOIN "Branch" b ON b.id = sm."branchId"
        INNER JOIN "Product" p ON p.id = sm."productId"
        WHERE sm."businessId" = ${businessId}
          ${stockBranchFilter}
      )
      ORDER BY "occurredAt" DESC
      LIMIT 30
    `);

    return {
      generatedAt: new Date().toISOString(),
      branchId: branchId ?? null,
      data: rows,
    };
  }

  private getInventoryTotals(businessId: string, branchId?: string) {
    const branchFilter = branchId
      ? Prisma.sql`AND bs."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<InventoryTotalsRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(bs.quantity * p."costPrice"), 0) AS "inventoryValue",
        COALESCE(SUM(bs.quantity * p."sellingPrice"), 0) AS "retailValue",
        COALESCE(SUM(bs.quantity), 0) AS "totalQuantity",
        COUNT(*) AS "stockRows",
        COUNT(*) FILTER (
          WHERE bs.quantity <= bs."reorderLevel"
        ) AS "lowStockRows",
        COUNT(*) FILTER (
          WHERE bs.quantity <= 0
        ) AS "outOfStockRows"
      FROM "BranchStock" bs
      INNER JOIN "Product" p ON p.id = bs."productId"
      WHERE bs."businessId" = ${businessId}
        ${branchFilter}
        AND p."isActive" = true
        AND p."trackStock" = true
    `);
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

  private money(value: unknown): string {
    return this.number(value).toFixed(2);
  }

  private quantity(value: unknown): string {
    return this.number(value).toFixed(3);
  }

  private integer(value: unknown): number {
    return Math.trunc(this.number(value));
  }

  private dateOnly(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
  }
}
