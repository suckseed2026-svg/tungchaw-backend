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
import { CancelPurchaseReturnDto } from './dto/cancel-purchase-return.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { PurchaseReturnQueryDto } from './dto/purchase-return-query.dto';
import { PurchaseReturnsService } from './purchase-returns.service';

@ApiTags('Purchase Returns')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  required: true,
  description: 'Selected business UUID',
})
@Controller('businesses/:businessId')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class PurchaseReturnsController {
  constructor(
    private readonly purchaseReturnsService: PurchaseReturnsService,
  ) {}

  @Post('purchases/:purchaseId/returns')
  @RequirePermissions(PermissionCodes.PURCHASE_CANCEL)
  @ApiOperation({
    summary:
      'Create a purchase return and remove returned goods from inventory atomically',
  })
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePurchaseReturnDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.purchaseReturnsService.create(
      business.id,
      purchaseId,
      user.id,
      dto,
    );
  }

  @Get('purchase-returns')
  @RequirePermissions(PermissionCodes.PURCHASE_VIEW)
  @ApiOperation({ summary: 'List purchase returns' })
  findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @Query() query: PurchaseReturnQueryDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.purchaseReturnsService.findAll(business.id, query);
  }

  @Get('purchase-returns/:id')
  @RequirePermissions(PermissionCodes.PURCHASE_VIEW)
  @ApiOperation({ summary: 'Get purchase return details' })
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentBusiness() business: CurrentBusinessData,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.purchaseReturnsService.findOne(business.id, id);
  }

  @Post('purchase-returns/:id/cancel')
  @RequirePermissions(PermissionCodes.PURCHASE_CANCEL)
  @ApiOperation({
    summary:
      'Cancel a purchase return and restore its removed inventory atomically',
  })
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CancelPurchaseReturnDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.purchaseReturnsService.cancel(business.id, id, user.id, dto);
  }

  private assertBusiness(routeId: string, contextId: string): void {
    if (routeId !== contextId) {
      throw new BadRequestException(
        'URL businessId must match the X-Business-Id header',
      );
    }
  }
}
