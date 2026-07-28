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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
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
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseQueryDto } from './dto/purchase-query.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('Purchase - Purchases')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('businesses/:businessId/purchases')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @RequirePermissions(PermissionCodes.PURCHASE_CREATE)
  @ApiOperation({
    summary: 'Create a draft purchase',
    description:
      'Creates a draft purchase and calculates all totals on the server. Stock is not changed until the purchase is received.',
  })
  @ApiCreatedResponse({
    description: 'Draft purchase created successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed or a branch, supplier, or product is invalid',
  })
  @ApiConflictResponse({
    description: 'Purchase invoice number already exists in this business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description: 'The user lacks business access or PURCHASE_CREATE permission',
  })
  create(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
    @CurrentUser()
    currentUser: JwtUser,
    @Body()
    dto: CreatePurchaseDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.purchasesService.create(
      currentBusiness.id,
      currentUser.id,
      dto,
    );
  }

  @Get()
  @RequirePermissions(PermissionCodes.PURCHASE_VIEW)
  @ApiOperation({
    summary: 'List purchases',
  })
  @ApiOkResponse({
    description: 'Paginated purchase list',
  })
  findAll(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
    @Query()
    query: PurchaseQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.purchasesService.findAll(currentBusiness.id, query);
  }

  @Get(':purchaseId')
  @RequirePermissions(PermissionCodes.PURCHASE_VIEW)
  @ApiOperation({
    summary: 'Get purchase details',
  })
  @ApiParam({
    name: 'purchaseId',
    description: 'Purchase UUID',
  })
  @ApiOkResponse({
    description: 'Purchase details',
  })
  @ApiNotFoundResponse({
    description: 'Purchase not found',
  })
  findOne(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @Param('purchaseId', new ParseUUIDPipe())
    purchaseId: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.purchasesService.findOne(currentBusiness.id, purchaseId);
  }

  @Patch(':purchaseId')
  @RequirePermissions(PermissionCodes.PURCHASE_UPDATE)
  @ApiOperation({
    summary: 'Update a draft purchase',
    description: 'Only purchases with DRAFT status may be edited.',
  })
  @ApiOkResponse({
    description: 'Purchase updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Purchase is not a draft or request validation failed',
  })
  @ApiConflictResponse({
    description: 'Purchase invoice number already exists in this business',
  })
  @ApiNotFoundResponse({
    description: 'Purchase not found',
  })
  update(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @Param('purchaseId', new ParseUUIDPipe())
    purchaseId: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
    @Body()
    dto: UpdatePurchaseDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.purchasesService.update(currentBusiness.id, purchaseId, dto);
  }

  @Post(':purchaseId/receive')
  @RequirePermissions(PermissionCodes.PURCHASE_RECEIVE)
  @ApiOperation({
    summary: 'Receive a purchase',
    description:
      'Marks a draft purchase as received, increases branch stock, and records stock movements in one transaction.',
  })
  @ApiOkResponse({
    description: 'Purchase received and stock updated successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Purchase is cancelled, already received, or contains invalid data',
  })
  @ApiNotFoundResponse({
    description: 'Purchase not found',
  })
  receive(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @Param('purchaseId', new ParseUUIDPipe())
    purchaseId: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
    @CurrentUser()
    currentUser: JwtUser,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.purchasesService.receive(
      currentBusiness.id,
      purchaseId,
      currentUser.id,
    );
  }

  @Post(':purchaseId/cancel')
  @RequirePermissions(PermissionCodes.PURCHASE_CANCEL)
  @ApiOperation({
    summary: 'Cancel a draft purchase',
  })
  @ApiOkResponse({
    description: 'Purchase cancelled successfully',
  })
  @ApiBadRequestResponse({
    description: 'Received purchases cannot be cancelled',
  })
  @ApiNotFoundResponse({
    description: 'Purchase not found',
  })
  cancel(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @Param('purchaseId', new ParseUUIDPipe())
    purchaseId: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.purchasesService.cancel(currentBusiness.id, purchaseId);
  }

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
