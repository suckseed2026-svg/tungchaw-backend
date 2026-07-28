import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentBusiness } from '../business-context/decorators/current-business.decorator';
import { BusinessContextGuard } from '../business-context/guards/business-context.guard';
import type { CurrentBusinessData } from '../business-context/types/business-context.type';

import { DashboardInventoryAnalyticsService } from './dashboard-inventory-analytics.service';
import { DashboardOverviewService } from './dashboard-overview.service';
import { DashboardSalesAnalyticsService } from './dashboard-sales-analytics.service';
import { DashboardSalesTrendService } from './dashboard-sales-trend.service';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
})
@Controller('businesses/:businessId/dashboard')
@UseGuards(JwtAuthGuard, BusinessContextGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dashboardOverviewService: DashboardOverviewService,
    private readonly dashboardSalesAnalyticsService: DashboardSalesAnalyticsService,
    private readonly dashboardSalesTrendService: DashboardSalesTrendService,
    private readonly dashboardInventoryAnalyticsService: DashboardInventoryAnalyticsService,
  ) {}

  // --------------------------------------------------------------------------
  // Dashboard V2 Overview
  // --------------------------------------------------------------------------

  @Get('overview')
  @ApiOperation({
    summary: 'Get Dashboard V2 overview analytics',
    description:
      'Returns current-period metrics, previous-period comparisons, sales, purchases and payment analytics.',
  })
  @ApiOkResponse({
    description: 'Dashboard overview returned successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid business context, branch, reporting period or custom date range',
  })
  overview(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.dashboardOverviewService.getOverview(
      currentBusiness.id,
      currentBusiness.timezone,
      currentBusiness.currency,
      query,
    );
  }

  // --------------------------------------------------------------------------
  // Dashboard V2 Sales Analytics
  // --------------------------------------------------------------------------

  @Get('sales-analysis')
  @ApiOperation({
    summary: 'Get Dashboard V2 sales analytics',
    description:
      'Returns sales KPIs, top products, top categories, top brands, payment methods, branch performance and recent sales.',
  })
  @ApiOkResponse({
    description: 'Sales analytics returned successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid business context, branch, reporting period or custom date range',
  })
  salesAnalysis(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.dashboardSalesAnalyticsService.getSalesAnalysis(
      currentBusiness.id,
      currentBusiness.timezone,
      currentBusiness.currency,
      query,
    );
  }

  // --------------------------------------------------------------------------
  // Dashboard V2 Sales Trend
  // --------------------------------------------------------------------------

  @Get('sales-trend')
  @ApiOperation({
    summary: 'Get Dashboard V2 sales trend',
    description:
      'Returns chart-ready sales, profit, cost, quantity and transaction trend points with zero-value periods included.',
  })
  @ApiOkResponse({
    description: 'Sales trend returned successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid business context, branch, reporting period or custom date range',
  })
  salesTrend(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.dashboardSalesTrendService.getSalesTrend(
      currentBusiness.id,
      currentBusiness.timezone,
      currentBusiness.currency,
      query,
    );
  }

  // --------------------------------------------------------------------------
  // Dashboard V2 Inventory Analytics
  // --------------------------------------------------------------------------

  @Get('inventory-analysis')
  @ApiOperation({
    summary: 'Get Dashboard V2 inventory analytics',
    description:
      'Returns inventory valuation, stock alerts, branch/category/brand breakdowns, stock movements, adjustments and transfer summaries.',
  })
  @ApiOkResponse({
    description: 'Inventory analytics returned successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid business context, branch, reporting period or custom date range',
  })
  inventoryAnalysis(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.dashboardInventoryAnalyticsService.getInventoryAnalysis(
      currentBusiness.id,
      currentBusiness.timezone,
      currentBusiness.currency,
      query,
    );
  }

  // --------------------------------------------------------------------------
  // Dashboard V1 Summary
  // --------------------------------------------------------------------------

  @Get('summary')
  @ApiOperation({
    summary: 'Get the owner dashboard summary',
  })
  @ApiOkResponse({
    description: 'Dashboard summary returned successfully',
  })
  @ApiBadRequestResponse({
    description: 'The route business does not match X-Business-Id',
  })
  summary(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.dashboardService.getSummary(
      currentBusiness.id,
      currentBusiness.timezone,
      currentBusiness.currency,
      query.branchId,
    );
  }

  // --------------------------------------------------------------------------
  // Dashboard V1 Sales
  // --------------------------------------------------------------------------

  @Get('sales')
  @ApiOperation({
    summary: 'Get sales trend and recent sales',
  })
  @ApiOkResponse({
    description: 'Sales dashboard returned successfully',
  })
  sales(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.dashboardService.getSalesDashboard(
      currentBusiness.id,
      currentBusiness.timezone,
      currentBusiness.currency,
      query.branchId,
      query.days ?? 7,
    );
  }

  // --------------------------------------------------------------------------
  // Dashboard V1 Inventory
  // --------------------------------------------------------------------------

  @Get('inventory')
  @ApiOperation({
    summary: 'Get inventory value and low-stock information',
  })
  @ApiOkResponse({
    description: 'Inventory dashboard returned successfully',
  })
  inventory(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.dashboardService.getInventoryDashboard(
      currentBusiness.id,
      currentBusiness.currency,
      query.branchId,
    );
  }

  // --------------------------------------------------------------------------
  // Dashboard V1 Financial
  // --------------------------------------------------------------------------

  @Get('financial')
  @ApiOperation({
    summary: 'Get sales, purchases, credit and payable totals',
  })
  @ApiOkResponse({
    description: 'Financial dashboard returned successfully',
  })
  financial(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.dashboardService.getFinancialDashboard(
      currentBusiness.id,
      currentBusiness.timezone,
      currentBusiness.currency,
      query.branchId,
      query.days ?? 30,
    );
  }

  // --------------------------------------------------------------------------
  // Dashboard V1 Activity
  // --------------------------------------------------------------------------

  @Get('activity')
  @ApiOperation({
    summary: 'Get recent business activity',
  })
  @ApiOkResponse({
    description: 'Recent activity returned successfully',
  })
  activity(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.dashboardService.getRecentActivity(
      currentBusiness.id,
      query.branchId,
    );
  }

  // --------------------------------------------------------------------------
  // Shared validation
  // --------------------------------------------------------------------------

  private assertBusinessContext(
    routeBusinessId: string,
    contextBusinessId: string,
  ): void {
    if (routeBusinessId !== contextBusinessId) {
      throw new BadRequestException(
        'URL businessId must match the X-Business-Id header',
      );
    }
  }
}
