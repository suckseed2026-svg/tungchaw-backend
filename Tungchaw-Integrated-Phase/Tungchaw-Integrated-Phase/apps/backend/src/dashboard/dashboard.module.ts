import { Module } from '@nestjs/common';

import { DashboardController } from './dashboard.controller';
import { DashboardInventoryAnalyticsService } from './dashboard-inventory-analytics.service';
import { DashboardOverviewService } from './dashboard-overview.service';
import { DashboardPeriodService } from './dashboard-period.service';
import { DashboardSalesAnalyticsService } from './dashboard-sales-analytics.service';
import { DashboardSalesTrendService } from './dashboard-sales-trend.service';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardPeriodService,
    DashboardOverviewService,
    DashboardSalesAnalyticsService,
    DashboardSalesTrendService,
    DashboardInventoryAnalyticsService,
  ],
  exports: [
    DashboardService,
    DashboardPeriodService,
    DashboardOverviewService,
    DashboardSalesAnalyticsService,
    DashboardSalesTrendService,
    DashboardInventoryAnalyticsService,
  ],
})
export class DashboardModule {}
