import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CompleteSaleDto } from './dto/complete-sale.dto';
import { CreateSaleDraftDto } from './dto/create-sale-draft.dto';
import { SaleQueryDto } from './dto/sale-query.dto';
import { UpdateSaleDraftDto } from './dto/update-sale-draft.dto';
import { SalesService } from './sales.service';

@ApiTags('Sales')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  required: true,
  description: 'Selected business UUID',
})
@Controller('businesses/:businessId/sales')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('drafts')
  @RequirePermissions(PermissionCodes.SALE_CREATE)
  @ApiOperation({ summary: 'Create a draft sale' })
  createDraft(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSaleDraftDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesService.createDraft(business.id, user.id, dto);
  }

  @Patch(':saleId/draft')
  @RequirePermissions(PermissionCodes.SALE_UPDATE)
  @ApiOperation({ summary: 'Update a draft sale' })
  updateDraft(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateSaleDraftDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesService.updateDraft(business.id, saleId, user.id, dto);
  }

  @Post(':saleId/complete')
  @RequirePermissions(PermissionCodes.SALE_COMPLETE)
  @ApiOperation({ summary: 'Complete a sale and deduct stock atomically' })
  complete(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CompleteSaleDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesService.complete(business.id, saleId, user.id, dto);
  }

  @Post(':saleId/cancel')
  @RequirePermissions(PermissionCodes.SALE_CANCEL)
  @ApiOperation({ summary: 'Cancel a draft sale' })
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CancelSaleDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesService.cancel(business.id, saleId, user.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.SALE_VIEW)
  @ApiOperation({ summary: 'List sales' })
  findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @Query() query: SaleQueryDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesService.findAll(business.id, query);
  }

  @Get(':saleId')
  @RequirePermissions(PermissionCodes.SALE_VIEW)
  @ApiOperation({ summary: 'Get sale details' })
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @CurrentBusiness() business: CurrentBusinessData,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesService.findOne(business.id, saleId);
  }

  private assertBusiness(routeId: string, contextId: string): void {
    if (routeId !== contextId)
      throw new BadRequestException(
        'URL businessId must match the X-Business-Id header',
      );
  }
}
