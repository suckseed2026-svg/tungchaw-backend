import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionCodes } from '../authorization/constants/permission-codes';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { CurrentBusiness } from '../business-context/decorators/current-business.decorator';
import { BusinessContextGuard } from '../business-context/guards/business-context.guard';
import type { CurrentBusinessData } from '../business-context/types/business-context.type';
import { InventoryBatchQueryDto } from './dto/inventory-batch-query.dto';
import { InventoryBatchesService } from './inventory-batches.service';

@ApiTags('Inventory - Batches')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: true })
@Controller('businesses/:businessId/inventory-batches')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class InventoryBatchesController {
  constructor(private readonly service: InventoryBatchesService) {}

  @Get()
  @RequirePermissions(PermissionCodes.PRODUCT_VIEW)
  @ApiOperation({ summary: 'List live inventory batches' })
  findAll(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: InventoryBatchQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);
    return this.service.findAll(currentBusiness.id, query);
  }

  @Get('expiring/:days')
  @RequirePermissions(PermissionCodes.PRODUCT_VIEW)
  @ApiOperation({ summary: 'List batches expiring within a number of days' })
  expiring(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('days', ParseIntPipe) days: number,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query('branchId') branchId?: string,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);
    return this.service.expiring(currentBusiness.id, days, branchId);
  }

  @Get('expired')
  @RequirePermissions(PermissionCodes.PRODUCT_VIEW)
  @ApiOperation({ summary: 'List expired batches with remaining stock' })
  expired(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query('branchId') branchId?: string,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);
    return this.service.expired(currentBusiness.id, branchId);
  }

  @Get(':batchId')
  @RequirePermissions(PermissionCodes.PRODUCT_VIEW)
  @ApiOperation({ summary: 'Get an inventory batch' })
  findOne(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);
    return this.service.findOne(currentBusiness.id, batchId);
  }

  private assertBusinessContext(
    routeBusinessId: string,
    contextBusinessId: string,
  ) {
    if (routeBusinessId !== contextBusinessId)
      throw new BadRequestException(
        'Business context does not match the route',
      );
  }
}
