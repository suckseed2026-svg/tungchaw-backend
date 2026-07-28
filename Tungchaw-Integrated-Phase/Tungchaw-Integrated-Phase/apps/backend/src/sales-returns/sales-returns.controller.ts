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
import { CancelSaleReturnDto } from './dto/cancel-sale-return.dto';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { SaleReturnQueryDto } from './dto/sale-return-query.dto';
import { SalesReturnsService } from './sales-returns.service';

@ApiTags('Sales Returns')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  required: true,
  description: 'Selected business UUID',
})
@Controller('businesses/:businessId')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class SalesReturnsController {
  constructor(private readonly salesReturnsService: SalesReturnsService) {}

  @Post('sales/:saleId/returns')
  @RequirePermissions(PermissionCodes.SALE_RETURN_CREATE)
  @ApiOperation({
    summary:
      'Create a sale return and adjust inventory and customer credit atomically',
  })
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSaleReturnDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesReturnsService.create(business.id, saleId, user.id, dto);
  }

  @Get('sales-returns')
  @RequirePermissions(PermissionCodes.SALE_RETURN_VIEW)
  @ApiOperation({ summary: 'List sale returns' })
  findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @Query() query: SaleReturnQueryDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesReturnsService.findAll(business.id, query);
  }

  @Get('sales-returns/:id')
  @RequirePermissions(PermissionCodes.SALE_RETURN_VIEW)
  @ApiOperation({ summary: 'Get sale return details' })
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentBusiness() business: CurrentBusinessData,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesReturnsService.findOne(business.id, id);
  }

  @Post('sales-returns/:id/cancel')
  @RequirePermissions(PermissionCodes.SALE_RETURN_CANCEL)
  @ApiOperation({
    summary: 'Cancel a sale return and reverse restored inventory atomically',
  })
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CancelSaleReturnDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.salesReturnsService.cancel(business.id, id, user.id, dto);
  }

  private assertBusiness(routeId: string, contextId: string): void {
    if (routeId !== contextId) {
      throw new BadRequestException(
        'URL businessId must match the X-Business-Id header',
      );
    }
  }
}
