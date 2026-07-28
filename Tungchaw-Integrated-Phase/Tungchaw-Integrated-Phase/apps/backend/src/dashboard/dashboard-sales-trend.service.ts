import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DashboardDateRange,
  DashboardPeriodService,
} from './dashboard-period.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

type TrendGranularity = 'DAY' | 'MONTH';

type SalesTrendRow = {
  periodKey: string;
  salesAmount: Prisma.Decimal | number | string | null;
  grossProfit: Prisma.Decimal | number | string | null;
  costOfGoods: Prisma.Decimal | number | string | null;
  discountTotal: Prisma.Decimal | number | string | null;
  taxAmount: Prisma.Decimal | number | string | null;
  quantitySold: Prisma.Decimal | number | string | null;
  transactionCount: bigint | number | string;
};

@Injectable()
export class DashboardSalesTrendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodService: DashboardPeriodService,
  ) {}

  async getSalesTrend(
    businessId: string,
    timezone: string,
    currency: string,
    query: DashboardQueryDto,
  ) {
    await this.validateBranch(businessId, query.branchId);

    const range = this.periodService.resolve(query, timezone);
    const granularity = this.resolveGranularity(range);

    const rows = await this.queryTrend(
      businessId,
      query.branchId,
      timezone,
      range,
      granularity,
    );

    const rowMap = new Map(rows.map((row) => [row.periodKey, row]));

    const periods = this.createPeriodKeys(range, timezone, granularity);

    const trend = periods.map((periodKey) => {
      const row = rowMap.get(periodKey);

      const salesAmount = this.number(row?.salesAmount);
      const grossProfit = this.number(row?.grossProfit);
      const transactionCount = this.integer(row?.transactionCount);

      return {
        period: periodKey,
        salesAmount: this.money(salesAmount),
        grossProfit: this.money(grossProfit),
        costOfGoods: this.money(row?.costOfGoods),
        discountTotal: this.money(row?.discountTotal),
        taxAmount: this.money(row?.taxAmount),
        quantitySold: this.quantity(row?.quantitySold),
        transactionCount,
        averageSaleValue: this.money(
          transactionCount > 0 ? salesAmount / transactionCount : 0,
        ),
        grossMarginPercentage: this.percentage(grossProfit, salesAmount),
      };
    });

    const totals = trend.reduce(
      (result, item) => {
        result.salesAmount += Number(item.salesAmount);
        result.grossProfit += Number(item.grossProfit);
        result.costOfGoods += Number(item.costOfGoods);
        result.discountTotal += Number(item.discountTotal);
        result.taxAmount += Number(item.taxAmount);
        result.quantitySold += Number(item.quantitySold);
        result.transactionCount += item.transactionCount;

        return result;
      },
      {
        salesAmount: 0,
        grossProfit: 0,
        costOfGoods: 0,
        discountTotal: 0,
        taxAmount: 0,
        quantitySold: 0,
        transactionCount: 0,
      },
    );

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
      granularity,
      totals: {
        salesAmount: this.money(totals.salesAmount),
        grossProfit: this.money(totals.grossProfit),
        costOfGoods: this.money(totals.costOfGoods),
        discountTotal: this.money(totals.discountTotal),
        taxAmount: this.money(totals.taxAmount),
        quantitySold: this.quantity(totals.quantitySold),
        transactionCount: totals.transactionCount,
        averageSaleValue: this.money(
          totals.transactionCount > 0
            ? totals.salesAmount / totals.transactionCount
            : 0,
        ),
        grossMarginPercentage: this.percentage(
          totals.grossProfit,
          totals.salesAmount,
        ),
      },
      trend,
    };
  }

  private queryTrend(
    businessId: string,
    branchId: string | undefined,
    timezone: string,
    range: DashboardDateRange,
    granularity: TrendGranularity,
  ) {
    const branchFilter = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.empty;

    const localCompletedAt = Prisma.sql`
      (
        s."completedAt" AT TIME ZONE 'UTC'
      ) AT TIME ZONE ${timezone}
    `;

    const periodExpression =
      granularity === 'MONTH'
        ? Prisma.sql`
            TO_CHAR(
              DATE_TRUNC('month', ${localCompletedAt}),
              'YYYY-MM'
            )
          `
        : Prisma.sql`
            TO_CHAR(
              DATE_TRUNC('day', ${localCompletedAt}),
              'YYYY-MM-DD'
            )
          `;

    return this.prisma.$queryRaw<SalesTrendRow[]>(Prisma.sql`
      WITH filtered_sales AS (
        SELECT
          s.id,
          ${periodExpression} AS "periodKey",
          s."totalAmount",
          s."grossProfit",
          s."costTotal",
          s."itemDiscountTotal",
          s."billDiscount",
          s."taxAmount"
        FROM "Sale" s
        WHERE s."businessId" = ${businessId}
          AND s.status = 'COMPLETED'
          ${branchFilter}
          AND s."completedAt" >= ${range.from}
          AND s."completedAt" < ${range.to}
      ),
      sale_quantities AS (
        SELECT
          si."saleId",
          COALESCE(SUM(si.quantity), 0) AS "quantitySold"
        FROM "SaleItem" si
        INNER JOIN filtered_sales fs
          ON fs.id = si."saleId"
        GROUP BY si."saleId"
      )
      SELECT
        fs."periodKey",
        COALESCE(SUM(fs."totalAmount"), 0) AS "salesAmount",
        COALESCE(SUM(fs."grossProfit"), 0) AS "grossProfit",
        COALESCE(SUM(fs."costTotal"), 0) AS "costOfGoods",
        COALESCE(
          SUM(fs."itemDiscountTotal" + fs."billDiscount"),
          0
        ) AS "discountTotal",
        COALESCE(SUM(fs."taxAmount"), 0) AS "taxAmount",
        COALESCE(SUM(sq."quantitySold"), 0) AS "quantitySold",
        COUNT(fs.id) AS "transactionCount"
      FROM filtered_sales fs
      LEFT JOIN sale_quantities sq
        ON sq."saleId" = fs.id
      GROUP BY fs."periodKey"
      ORDER BY fs."periodKey" ASC
    `);
  }

  private resolveGranularity(range: DashboardDateRange): TrendGranularity {
    const durationInDays =
      (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);

    return durationInDays > 92 ? 'MONTH' : 'DAY';
  }

  private createPeriodKeys(
    range: DashboardDateRange,
    timezone: string,
    granularity: TrendGranularity,
  ): string[] {
    const firstDate = this.getLocalDateParts(range.from, timezone);

    const lastIncludedDate = this.getLocalDateParts(
      new Date(range.to.getTime() - 1),
      timezone,
    );

    if (granularity === 'MONTH') {
      return this.createMonthKeys(
        firstDate.year,
        firstDate.month,
        lastIncludedDate.year,
        lastIncludedDate.month,
      );
    }

    return this.createDayKeys(
      firstDate.year,
      firstDate.month,
      firstDate.day,
      lastIncludedDate.year,
      lastIncludedDate.month,
      lastIncludedDate.day,
    );
  }

  private createDayKeys(
    startYear: number,
    startMonth: number,
    startDay: number,
    endYear: number,
    endMonth: number,
    endDay: number,
  ): string[] {
    const keys: string[] = [];

    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));

    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

    while (current <= end) {
      keys.push(
        [
          current.getUTCFullYear(),
          this.pad(current.getUTCMonth() + 1),
          this.pad(current.getUTCDate()),
        ].join('-'),
      );

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return keys;
  }

  private createMonthKeys(
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
  ): string[] {
    const keys: string[] = [];

    let year = startYear;
    let month = startMonth;

    while (year < endYear || (year === endYear && month <= endMonth)) {
      keys.push(`${year}-${this.pad(month)}`);

      month += 1;

      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    return keys;
  }

  private getLocalDateParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
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

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
