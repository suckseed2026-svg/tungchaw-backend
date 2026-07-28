import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtUser } from '../auth/types/jwt-user.type';
import { PermissionCodes } from '../authorization/constants/permission-codes';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { CurrentBusiness } from '../business-context/decorators/current-business.decorator';
import { BusinessContextGuard } from '../business-context/guards/business-context.guard';
import type { CurrentBusinessData } from '../business-context/types/business-context.type';
import { CancelInventoryAdjustmentDto } from './dto/cancel-inventory-adjustment.dto';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { InventoryAdjustmentQueryDto } from './dto/inventory-adjustment-query.dto';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';

@ApiTags('Inventory Adjustments')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  required: true,
  description: 'Selected business UUID',
})
@Controller('businesses/:businessId/inventory-adjustments')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class InventoryAdjustmentsController {
  constructor(
    private readonly inventoryAdjustmentsService: InventoryAdjustmentsService,
  ) {}

  @Post()
  @RequirePermissions(PermissionCodes.INVENTORY_ADJUSTMENT_CREATE)
  @ApiOperation({
    summary: 'Create an inventory adjustment and update stock atomically',
  })
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateInventoryAdjustmentDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.inventoryAdjustmentsService.create(business.id, user.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.INVENTORY_ADJUSTMENT_VIEW)
  @ApiOperation({ summary: 'List inventory adjustments' })
  findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @Query() query: InventoryAdjustmentQueryDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.inventoryAdjustmentsService.findAll(business.id, query);
  }

  @Get(':id')
  @RequirePermissions(PermissionCodes.INVENTORY_ADJUSTMENT_VIEW)
  @ApiOperation({ summary: 'Get inventory adjustment details' })
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentBusiness() business: CurrentBusinessData,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.inventoryAdjustmentsService.findOne(business.id, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(PermissionCodes.INVENTORY_ADJUSTMENT_CANCEL)
  @ApiOperation({
    summary:
      'Cancel an inventory adjustment and reverse its stock effect atomically',
  })
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CancelInventoryAdjustmentDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.inventoryAdjustmentsService.cancel(
      business.id,
      id,
      user.id,
      dto,
    );
  }

  private assertBusiness(routeId: string, contextId: string): void {
    if (routeId !== contextId) {
      throw new BadRequestException(
        'URL businessId must match the X-Business-Id header',
      );
    }
  }
}
