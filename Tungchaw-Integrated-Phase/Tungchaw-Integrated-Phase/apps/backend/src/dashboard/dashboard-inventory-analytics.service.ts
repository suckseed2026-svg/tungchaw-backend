import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DashboardDateRange,
  DashboardPeriodService,
} from './dashboard-period.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

type InventorySummaryRow = {
  productCount: bigint | number | string;
  stockedProductCount: bigint | number | string;
  totalQuantity: Prisma.Decimal | number | string | null;
  costValue: Prisma.Decimal | number | string | null;
  retailValue: Prisma.Decimal | number | string | null;
  potentialProfit: Prisma.Decimal | number | string | null;
  outOfStockCount: bigint | number | string;
  lowStockCount: bigint | number | string;
  healthyStockCount: bigint | number | string;
};

type InventoryProductRow = {
  productId: string;
  productName: string;
  productCode: string;
  barcode: string | null;
  categoryName: string | null;
  brandName: string | null;
  branchId: string;
  branchName: string;
  quantity: Prisma.Decimal | number | string;
  reorderLevel: Prisma.Decimal | number | string;
  costPrice: Prisma.Decimal | number | string;
  sellingPrice: Prisma.Decimal | number | string;
  costValue: Prisma.Decimal | number | string;
  retailValue: Prisma.Decimal | number | string;
};

type InventoryGroupRow = {
  id: string | null;
  name: string;
  productCount: bigint | number | string;
  quantity: Prisma.Decimal | number | string | null;
  costValue: Prisma.Decimal | number | string | null;
  retailValue: Prisma.Decimal | number | string | null;
  potentialProfit: Prisma.Decimal | number | string | null;
};

type StockMovementSummaryRow = {
  type: string;
  movementCount: bigint | number | string;
  quantity: Prisma.Decimal | number | string | null;
};

type RecentStockMovementRow = {
  id: string;
  createdAt: Date;
  type: string;
  quantityBefore: Prisma.Decimal | number | string;
  quantityChange: Prisma.Decimal | number | string;
  quantityAfter: Prisma.Decimal | number | string;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  notes: string | null;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  productCode: string;
};

type AdjustmentSummaryRow = {
  reason: string;
  type: string;
  adjustmentCount: bigint | number | string;
  quantity: Prisma.Decimal | number | string | null;
};

type TransferSummaryRow = {
  transferCount: bigint | number | string;
  quantity: Prisma.Decimal | number | string | null;
};

@Injectable()
export class DashboardInventoryAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodService: DashboardPeriodService,
  ) {}

  async getInventoryAnalysis(
    businessId: string,
    timezone: string,
    currency: string,
    query: DashboardQueryDto,
  ) {
    await this.validateBranch(businessId, query.branchId);

    const range = this.periodService.resolve(query, timezone);
    const limit = this.resolveLimit(query.limit);

    const [
      summaryRows,
      lowStockRows,
      outOfStockRows,
      topStockedRows,
      branchRows,
      categoryRows,
      brandRows,
      movementSummaryRows,
      recentMovementRows,
      adjustmentRows,
      transferInRows,
      transferOutRows,
    ] = await Promise.all([
      this.querySummary(businessId, query.branchId),
      this.queryLowStockProducts(businessId, query.branchId, limit),
      this.queryOutOfStockProducts(businessId, query.branchId, limit),
      this.queryTopStockedProducts(businessId, query.branchId, limit),
      this.queryBranchInventory(businessId, query.branchId),
      this.queryCategoryInventory(businessId, query.branchId, limit),
      this.queryBrandInventory(businessId, query.branchId, limit),
      this.queryMovementSummary(businessId, query.branchId, range),
      this.queryRecentMovements(businessId, query.branchId, range, limit),
      this.queryAdjustmentSummary(businessId, query.branchId, range),
      this.queryTransferInSummary(businessId, query.branchId, range),
      this.queryTransferOutSummary(businessId, query.branchId, range),
    ]);

    const summary = summaryRows[0] ?? {
      productCount: 0,
      stockedProductCount: 0,
      totalQuantity: 0,
      costValue: 0,
      retailValue: 0,
      potentialProfit: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      healthyStockCount: 0,
    };

    const costValue = this.number(summary.costValue);
    const retailValue = this.number(summary.retailValue);
    const potentialProfit = this.number(summary.potentialProfit);

    return {
      generatedAt: new Date().toISOString(),
      currency,
      scope: {
        businessId,
        branchId: query.branchId ?? null,
        period: range.period,
        timezone,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },

      summary: {
        productCount: this.integer(summary.productCount),
        stockedProductCount: this.integer(summary.stockedProductCount),
        totalQuantity: this.quantity(summary.totalQuantity),
        costValue: this.money(costValue),
        retailValue: this.money(retailValue),
        potentialProfit: this.money(potentialProfit),
        potentialMarginPercentage: this.percentage(
          potentialProfit,
          retailValue,
        ),
        outOfStockCount: this.integer(summary.outOfStockCount),
        lowStockCount: this.integer(summary.lowStockCount),
        healthyStockCount: this.integer(summary.healthyStockCount),
      },

      stockAlerts: {
        lowStock: lowStockRows.map((row) => this.mapInventoryProduct(row)),
        outOfStock: outOfStockRows.map((row) => this.mapInventoryProduct(row)),
      },

      topStockedProducts: topStockedRows.map((row) =>
        this.mapInventoryProduct(row),
      ),

      inventoryByBranch: branchRows.map((row) => this.mapInventoryGroup(row)),

      inventoryByCategory: categoryRows.map((row) =>
        this.mapInventoryGroup(row),
      ),

      inventoryByBrand: brandRows.map((row) => this.mapInventoryGroup(row)),

      stockMovements: {
        summary: movementSummaryRows.map((row) => ({
          type: row.type,
          movementCount: this.integer(row.movementCount),
          quantity: this.quantity(row.quantity),
        })),

        recent: recentMovementRows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          type: row.type,
          quantityBefore: this.quantity(row.quantityBefore),
          quantityChange: this.quantity(row.quantityChange),
          quantityAfter: this.quantity(row.quantityAfter),
          referenceType: row.referenceType,
          referenceId: row.referenceId,
          reason: row.reason,
          notes: row.notes,
          branch: {
            id: row.branchId,
            name: row.branchName,
          },
          product: {
            id: row.productId,
            name: row.productName,
            code: row.productCode,
          },
        })),
      },

      adjustments: adjustmentRows.map((row) => ({
        reason: row.reason,
        type: row.type,
        adjustmentCount: this.integer(row.adjustmentCount),
        quantity: this.quantity(row.quantity),
      })),

      transfers: {
        incoming: {
          transferCount: this.integer(transferInRows[0]?.transferCount),
          quantity: this.quantity(transferInRows[0]?.quantity),
        },
        outgoing: {
          transferCount: this.integer(transferOutRows[0]?.transferCount),
          quantity: this.quantity(transferOutRows[0]?.quantity),
        },
      },
    };
  }

  private querySummary(businessId: string, branchId?: string) {
    const branchFilter = branchId
      ? Prisma.sql`AND bs."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<InventorySummaryRow[]>(
      Prisma.sql`
        WITH product_stock AS (
          SELECT
            p.id AS "productId",
            COALESCE(SUM(bs.quantity), 0) AS quantity,
            COALESCE(SUM(bs."reorderLevel"), 0) AS "reorderLevel",
            p."costPrice",
            p."sellingPrice"

          FROM "Product" p

          LEFT JOIN "BranchStock" bs
            ON bs."productId" = p.id
            AND bs."businessId" = ${businessId}
            ${branchFilter}

          WHERE p."businessId" = ${businessId}
            AND p."isActive" = true
            AND p."trackStock" = true

          GROUP BY
            p.id,
            p."costPrice",
            p."sellingPrice"
        )

        SELECT
          COUNT(*) AS "productCount",

          COUNT(
            CASE
              WHEN quantity > 0 THEN 1
            END
          ) AS "stockedProductCount",

          COALESCE(SUM(quantity), 0) AS "totalQuantity",

          COALESCE(
            SUM(quantity * "costPrice"),
            0
          ) AS "costValue",

          COALESCE(
            SUM(quantity * "sellingPrice"),
            0
          ) AS "retailValue",

          COALESCE(
            SUM(
              quantity *
              ("sellingPrice" - "costPrice")
            ),
            0
          ) AS "potentialProfit",

          COUNT(
            CASE
              WHEN quantity <= 0 THEN 1
            END
          ) AS "outOfStockCount",

          COUNT(
            CASE
              WHEN quantity > 0
                AND quantity <= "reorderLevel"
              THEN 1
            END
          ) AS "lowStockCount",

          COUNT(
            CASE
              WHEN quantity > "reorderLevel"
              THEN 1
            END
          ) AS "healthyStockCount"

        FROM product_stock
      `,
    );
  }

  private queryLowStockProducts(
    businessId: string,
    branchId: string | undefined,
    limit: number,
  ) {
    if (branchId) {
      return this.prisma.$queryRaw<InventoryProductRow[]>(
        Prisma.sql`
          SELECT
            p.id AS "productId",
            p.name AS "productName",
            p.code AS "productCode",
            p.barcode,
            c.name AS "categoryName",
            b.name AS "brandName",
            br.id AS "branchId",
            br.name AS "branchName",
            bs.quantity,
            bs."reorderLevel",
            p."costPrice",
            p."sellingPrice",
            bs.quantity * p."costPrice" AS "costValue",
            bs.quantity * p."sellingPrice" AS "retailValue"

          FROM "BranchStock" bs

          INNER JOIN "Product" p
            ON p.id = bs."productId"

          INNER JOIN "Branch" br
            ON br.id = bs."branchId"

          LEFT JOIN "Category" c
            ON c.id = p."categoryId"

          LEFT JOIN "Brand" b
            ON b.id = p."brandId"

          WHERE bs."businessId" = ${businessId}
            AND bs."branchId" = ${branchId}
            AND p."isActive" = true
            AND p."trackStock" = true
            AND bs.quantity > 0
            AND bs.quantity <= bs."reorderLevel"

          ORDER BY
            CASE
              WHEN bs."reorderLevel" > 0
              THEN bs.quantity / bs."reorderLevel"
              ELSE bs.quantity
            END ASC,
            p.name ASC

          LIMIT ${limit}
        `,
      );
    }

    return this.prisma.$queryRaw<InventoryProductRow[]>(
      Prisma.sql`
        WITH product_stock AS (
          SELECT
            p.id AS "productId",
            p.name AS "productName",
            p.code AS "productCode",
            p.barcode,
            c.name AS "categoryName",
            b.name AS "brandName",
            COALESCE(SUM(bs.quantity), 0) AS quantity,
            COALESCE(SUM(bs."reorderLevel"), 0) AS "reorderLevel",
            p."costPrice",
            p."sellingPrice"

          FROM "Product" p

          LEFT JOIN "BranchStock" bs
            ON bs."productId" = p.id
            AND bs."businessId" = ${businessId}

          LEFT JOIN "Category" c
            ON c.id = p."categoryId"

          LEFT JOIN "Brand" b
            ON b.id = p."brandId"

          WHERE p."businessId" = ${businessId}
            AND p."isActive" = true
            AND p."trackStock" = true

          GROUP BY
            p.id,
            p.name,
            p.code,
            p.barcode,
            c.name,
            b.name,
            p."costPrice",
            p."sellingPrice"
        )

        SELECT
          "productId",
          "productName",
          "productCode",
          barcode,
          "categoryName",
          "brandName",
          'ALL'::text AS "branchId",
          'All Branches'::text AS "branchName",
          quantity,
          "reorderLevel",
          "costPrice",
          "sellingPrice",
          quantity * "costPrice" AS "costValue",
          quantity * "sellingPrice" AS "retailValue"

        FROM product_stock

        WHERE quantity > 0
          AND quantity <= "reorderLevel"

        ORDER BY
          CASE
            WHEN "reorderLevel" > 0
            THEN quantity / "reorderLevel"
            ELSE quantity
          END ASC,
          "productName" ASC

        LIMIT ${limit}
      `,
    );
  }

  private queryOutOfStockProducts(
    businessId: string,
    branchId: string | undefined,
    limit: number,
  ) {
    if (branchId) {
      return this.prisma.$queryRaw<InventoryProductRow[]>(
        Prisma.sql`
          SELECT
            p.id AS "productId",
            p.name AS "productName",
            p.code AS "productCode",
            p.barcode,
            c.name AS "categoryName",
            b.name AS "brandName",
            br.id AS "branchId",
            br.name AS "branchName",
            bs.quantity,
            bs."reorderLevel",
            p."costPrice",
            p."sellingPrice",
            bs.quantity * p."costPrice" AS "costValue",
            bs.quantity * p."sellingPrice" AS "retailValue"

          FROM "BranchStock" bs

          INNER JOIN "Product" p
            ON p.id = bs."productId"

          INNER JOIN "Branch" br
            ON br.id = bs."branchId"

          LEFT JOIN "Category" c
            ON c.id = p."categoryId"

          LEFT JOIN "Brand" b
            ON b.id = p."brandId"

          WHERE bs."businessId" = ${businessId}
            AND bs."branchId" = ${branchId}
            AND p."isActive" = true
            AND p."trackStock" = true
            AND bs.quantity <= 0

          ORDER BY p.name ASC
          LIMIT ${limit}
        `,
      );
    }

    return this.prisma.$queryRaw<InventoryProductRow[]>(
      Prisma.sql`
        WITH product_stock AS (
          SELECT
            p.id AS "productId",
            p.name AS "productName",
            p.code AS "productCode",
            p.barcode,
            c.name AS "categoryName",
            b.name AS "brandName",
            COALESCE(SUM(bs.quantity), 0) AS quantity,
            COALESCE(SUM(bs."reorderLevel"), 0) AS "reorderLevel",
            p."costPrice",
            p."sellingPrice"

          FROM "Product" p

          LEFT JOIN "BranchStock" bs
            ON bs."productId" = p.id
            AND bs."businessId" = ${businessId}

          LEFT JOIN "Category" c
            ON c.id = p."categoryId"

          LEFT JOIN "Brand" b
            ON b.id = p."brandId"

          WHERE p."businessId" = ${businessId}
            AND p."isActive" = true
            AND p."trackStock" = true

          GROUP BY
            p.id,
            p.name,
            p.code,
            p.barcode,
            c.name,
            b.name,
            p."costPrice",
            p."sellingPrice"
        )

        SELECT
          "productId",
          "productName",
          "productCode",
          barcode,
          "categoryName",
          "brandName",
          'ALL'::text AS "branchId",
          'All Branches'::text AS "branchName",
          quantity,
          "reorderLevel",
          "costPrice",
          "sellingPrice",
          quantity * "costPrice" AS "costValue",
          quantity * "sellingPrice" AS "retailValue"

        FROM product_stock

        WHERE quantity <= 0

        ORDER BY "productName" ASC
        LIMIT ${limit}
      `,
    );
  }

  private queryTopStockedProducts(
    businessId: string,
    branchId: string | undefined,
    limit: number,
  ) {
    if (branchId) {
      return this.prisma.$queryRaw<InventoryProductRow[]>(
        Prisma.sql`
          SELECT
            p.id AS "productId",
            p.name AS "productName",
            p.code AS "productCode",
            p.barcode,
            c.name AS "categoryName",
            b.name AS "brandName",
            br.id AS "branchId",
            br.name AS "branchName",
            bs.quantity,
            bs."reorderLevel",
            p."costPrice",
            p."sellingPrice",
            bs.quantity * p."costPrice" AS "costValue",
            bs.quantity * p."sellingPrice" AS "retailValue"

          FROM "BranchStock" bs

          INNER JOIN "Product" p
            ON p.id = bs."productId"

          INNER JOIN "Branch" br
            ON br.id = bs."branchId"

          LEFT JOIN "Category" c
            ON c.id = p."categoryId"

          LEFT JOIN "Brand" b
            ON b.id = p."brandId"

          WHERE bs."businessId" = ${businessId}
            AND bs."branchId" = ${branchId}
            AND p."isActive" = true
            AND p."trackStock" = true

          ORDER BY
            bs.quantity DESC,
            p.name ASC

          LIMIT ${limit}
        `,
      );
    }

    return this.prisma.$queryRaw<InventoryProductRow[]>(
      Prisma.sql`
        SELECT
          p.id AS "productId",
          p.name AS "productName",
          p.code AS "productCode",
          p.barcode,
          c.name AS "categoryName",
          b.name AS "brandName",
          'ALL'::text AS "branchId",
          'All Branches'::text AS "branchName",
          COALESCE(SUM(bs.quantity), 0) AS quantity,
          COALESCE(SUM(bs."reorderLevel"), 0) AS "reorderLevel",
          p."costPrice",
          p."sellingPrice",
          COALESCE(SUM(bs.quantity), 0) * p."costPrice" AS "costValue",
          COALESCE(SUM(bs.quantity), 0) * p."sellingPrice" AS "retailValue"

        FROM "Product" p

        LEFT JOIN "BranchStock" bs
          ON bs."productId" = p.id
          AND bs."businessId" = ${businessId}

        LEFT JOIN "Category" c
          ON c.id = p."categoryId"

        LEFT JOIN "Brand" b
          ON b.id = p."brandId"

        WHERE p."businessId" = ${businessId}
          AND p."isActive" = true
          AND p."trackStock" = true

        GROUP BY
          p.id,
          p.name,
          p.code,
          p.barcode,
          c.name,
          b.name,
          p."costPrice",
          p."sellingPrice"

        ORDER BY
          quantity DESC,
          p.name ASC

        LIMIT ${limit}
      `,
    );
  }

  private queryBranchInventory(businessId: string, branchId?: string) {
    const branchFilter = branchId
      ? Prisma.sql`AND br.id = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<InventoryGroupRow[]>(
      Prisma.sql`
        SELECT
          br.id,
          br.name,

          COUNT(
            DISTINCT CASE
              WHEN bs.quantity <> 0 THEN p.id
            END
          ) AS "productCount",

          COALESCE(SUM(bs.quantity), 0) AS quantity,

          COALESCE(
            SUM(bs.quantity * p."costPrice"),
            0
          ) AS "costValue",

          COALESCE(
            SUM(bs.quantity * p."sellingPrice"),
            0
          ) AS "retailValue",

          COALESCE(
            SUM(
              bs.quantity *
              (p."sellingPrice" - p."costPrice")
            ),
            0
          ) AS "potentialProfit"

        FROM "Branch" br

        LEFT JOIN "BranchStock" bs
          ON bs."branchId" = br.id
          AND bs."businessId" = ${businessId}

        LEFT JOIN "Product" p
          ON p.id = bs."productId"
          AND p."isActive" = true
          AND p."trackStock" = true

        WHERE br."businessId" = ${businessId}
          ${branchFilter}

        GROUP BY br.id, br.name
        ORDER BY "costValue" DESC, br.name ASC
      `,
    );
  }

  private queryCategoryInventory(
    businessId: string,
    branchId: string | undefined,
    limit: number,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND bs."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<InventoryGroupRow[]>(
      Prisma.sql`
        SELECT
          c.id,
          COALESCE(c.name, 'Uncategorized') AS name,
          COUNT(DISTINCT p.id) AS "productCount",
          COALESCE(SUM(bs.quantity), 0) AS quantity,

          COALESCE(
            SUM(bs.quantity * p."costPrice"),
            0
          ) AS "costValue",

          COALESCE(
            SUM(bs.quantity * p."sellingPrice"),
            0
          ) AS "retailValue",

          COALESCE(
            SUM(
              bs.quantity *
              (p."sellingPrice" - p."costPrice")
            ),
            0
          ) AS "potentialProfit"

        FROM "BranchStock" bs

        INNER JOIN "Product" p
          ON p.id = bs."productId"

        LEFT JOIN "Category" c
          ON c.id = p."categoryId"

        WHERE bs."businessId" = ${businessId}
          AND p."isActive" = true
          AND p."trackStock" = true
          ${branchFilter}

        GROUP BY c.id, c.name
        ORDER BY "costValue" DESC, name ASC
        LIMIT ${limit}
      `,
    );
  }

  private queryBrandInventory(
    businessId: string,
    branchId: string | undefined,
    limit: number,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND bs."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<InventoryGroupRow[]>(
      Prisma.sql`
        SELECT
          b.id,
          COALESCE(b.name, 'Unbranded') AS name,
          COUNT(DISTINCT p.id) AS "productCount",
          COALESCE(SUM(bs.quantity), 0) AS quantity,

          COALESCE(
            SUM(bs.quantity * p."costPrice"),
            0
          ) AS "costValue",

          COALESCE(
            SUM(bs.quantity * p."sellingPrice"),
            0
          ) AS "retailValue",

          COALESCE(
            SUM(
              bs.quantity *
              (p."sellingPrice" - p."costPrice")
            ),
            0
          ) AS "potentialProfit"

        FROM "BranchStock" bs

        INNER JOIN "Product" p
          ON p.id = bs."productId"

        LEFT JOIN "Brand" b
          ON b.id = p."brandId"

        WHERE bs."businessId" = ${businessId}
          AND p."isActive" = true
          AND p."trackStock" = true
          ${branchFilter}

        GROUP BY b.id, b.name
        ORDER BY "costValue" DESC, name ASC
        LIMIT ${limit}
      `,
    );
  }

  private queryMovementSummary(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND sm."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<StockMovementSummaryRow[]>(
      Prisma.sql`
        SELECT
          sm.type::text AS type,
          COUNT(sm.id) AS "movementCount",
          COALESCE(
            SUM(ABS(sm."quantityChange")),
            0
          ) AS quantity

        FROM "StockMovement" sm

        WHERE sm."businessId" = ${businessId}
          ${branchFilter}
          AND sm."createdAt" >= ${range.from}
          AND sm."createdAt" < ${range.to}

        GROUP BY sm.type
        ORDER BY sm.type ASC
      `,
    );
  }

  private queryRecentMovements(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
    limit: number,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND sm."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<RecentStockMovementRow[]>(
      Prisma.sql`
        SELECT
          sm.id,
          sm."createdAt",
          sm.type::text AS type,
          sm."quantityBefore",
          sm."quantityChange",
          sm."quantityAfter",
          sm."referenceType",
          sm."referenceId",
          sm.reason,
          sm.notes,
          br.id AS "branchId",
          br.name AS "branchName",
          p.id AS "productId",
          p.name AS "productName",
          p.code AS "productCode"

        FROM "StockMovement" sm

        INNER JOIN "Branch" br
          ON br.id = sm."branchId"

        INNER JOIN "Product" p
          ON p.id = sm."productId"

        WHERE sm."businessId" = ${businessId}
          ${branchFilter}
          AND sm."createdAt" >= ${range.from}
          AND sm."createdAt" < ${range.to}

        ORDER BY sm."createdAt" DESC
        LIMIT ${limit}
      `,
    );
  }

  private queryAdjustmentSummary(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND ia."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<AdjustmentSummaryRow[]>(
      Prisma.sql`
        SELECT
          ia.reason::text AS reason,
          ia.type::text AS type,
          COUNT(ia.id) AS "adjustmentCount",
          COALESCE(
            SUM(ia."totalQuantity"),
            0
          ) AS quantity

        FROM "InventoryAdjustment" ia

        WHERE ia."businessId" = ${businessId}
          AND ia.status = 'COMPLETED'
          ${branchFilter}
          AND ia."adjustmentDate" >= ${range.from}
          AND ia."adjustmentDate" < ${range.to}

        GROUP BY ia.reason, ia.type
        ORDER BY ia.type ASC, ia.reason ASC
      `,
    );
  }

  private queryTransferInSummary(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND sm."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<TransferSummaryRow[]>(
      Prisma.sql`
        SELECT
          COUNT(DISTINCT sm."referenceId") AS "transferCount",
          COALESCE(
            SUM(ABS(sm."quantityChange")),
            0
          ) AS quantity

        FROM "StockMovement" sm

        WHERE sm."businessId" = ${businessId}
          AND sm.type = 'TRANSFER_IN'
          AND sm."referenceType" = 'STOCK_TRANSFER'
          AND sm."referenceId" IS NOT NULL
          ${branchFilter}
          AND sm."createdAt" >= ${range.from}
          AND sm."createdAt" < ${range.to}
      `,
    );
  }

  private queryTransferOutSummary(
    businessId: string,
    branchId: string | undefined,
    range: DashboardDateRange,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND sm."branchId" = ${branchId}`
      : Prisma.empty;

    return this.prisma.$queryRaw<TransferSummaryRow[]>(
      Prisma.sql`
        SELECT
          COUNT(DISTINCT sm."referenceId") AS "transferCount",
          COALESCE(
            SUM(ABS(sm."quantityChange")),
            0
          ) AS quantity

        FROM "StockMovement" sm

        WHERE sm."businessId" = ${businessId}
          AND sm.type = 'TRANSFER_OUT'
          AND sm."referenceType" = 'STOCK_TRANSFER'
          AND sm."referenceId" IS NOT NULL
          ${branchFilter}
          AND sm."createdAt" >= ${range.from}
          AND sm."createdAt" < ${range.to}
      `,
    );
  }

  private mapInventoryProduct(row: InventoryProductRow) {
    const costValue = this.number(row.costValue);
    const retailValue = this.number(row.retailValue);

    return {
      product: {
        id: row.productId,
        name: row.productName,
        code: row.productCode,
        barcode: row.barcode,
        categoryName: row.categoryName,
        brandName: row.brandName,
      },
      branch: {
        id: row.branchId,
        name: row.branchName,
      },
      quantity: this.quantity(row.quantity),
      reorderLevel: this.quantity(row.reorderLevel),
      costPrice: this.money(row.costPrice),
      sellingPrice: this.money(row.sellingPrice),
      costValue: this.money(costValue),
      retailValue: this.money(retailValue),
      potentialProfit: this.money(retailValue - costValue),
    };
  }

  private mapInventoryGroup(row: InventoryGroupRow) {
    const costValue = this.number(row.costValue);
    const retailValue = this.number(row.retailValue);
    const potentialProfit = this.number(row.potentialProfit);

    return {
      id: row.id,
      name: row.name,
      productCount: this.integer(row.productCount),
      quantity: this.quantity(row.quantity),
      costValue: this.money(costValue),
      retailValue: this.money(retailValue),
      potentialProfit: this.money(potentialProfit),
      potentialMarginPercentage: this.percentage(potentialProfit, retailValue),
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

  private resolveLimit(limit?: number): number {
    if (!limit) {
      return 10;
    }

    return Math.min(Math.max(limit, 1), 50);
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
