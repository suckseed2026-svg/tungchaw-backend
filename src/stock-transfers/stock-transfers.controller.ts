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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
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
import { CancelStockTransferDto } from './dto/cancel-stock-transfer.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { StockTransferQueryDto } from './dto/stock-transfer-query.dto';
import { StockTransfersService } from './stock-transfers.service';

@ApiTags('Stock Transfers')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('businesses/:businessId/stock-transfers')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Post()
  @RequirePermissions(PermissionCodes.STOCK_TRANSFER_CREATE)
  @ApiOperation({
    summary: 'Transfer stock between two branches atomically',
  })
  @ApiCreatedResponse({
    description: 'Stock transfer completed successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Branches are invalid, duplicate products exist, or validation failed',
  })
  @ApiConflictResponse({
    description: 'The source branch does not have enough stock',
  })
  @ApiNotFoundResponse({
    description: 'A branch or product was not found',
  })
  create(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
    @CurrentUser()
    currentUser: JwtUser,
    @Body()
    dto: CreateStockTransferDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.stockTransfersService.create(
      currentBusiness.id,
      currentUser.id,
      dto,
    );
  }

  @Get()
  @RequirePermissions(PermissionCodes.STOCK_TRANSFER_VIEW)
  @ApiOperation({
    summary: 'List stock transfers',
  })
  @ApiOkResponse({
    description: 'Stock transfers returned successfully',
  })
  findAll(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
    @Query()
    query: StockTransferQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.stockTransfersService.findAll(currentBusiness.id, query);
  }

  @Get(':id')
  @RequirePermissions(PermissionCodes.STOCK_TRANSFER_VIEW)
  @ApiOperation({
    summary: 'Get stock transfer details',
  })
  @ApiOkResponse({
    description: 'Stock transfer returned successfully',
  })
  @ApiNotFoundResponse({
    description: 'Stock transfer not found',
  })
  findOne(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @Param('id', new ParseUUIDPipe())
    id: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.stockTransfersService.findOne(currentBusiness.id, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(PermissionCodes.STOCK_TRANSFER_CANCEL)
  @ApiOperation({
    summary: 'Cancel a stock transfer and reverse its inventory movements',
  })
  @ApiOkResponse({
    description: 'Stock transfer cancelled and inventory reversed',
  })
  @ApiBadRequestResponse({
    description:
      'The transfer is already cancelled or destination stock is insufficient',
  })
  @ApiConflictResponse({
    description:
      'The destination branch no longer has enough stock to reverse the transfer',
  })
  @ApiNotFoundResponse({
    description: 'Stock transfer not found',
  })
  cancel(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,
    @Param('id', new ParseUUIDPipe())
    id: string,
    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
    @CurrentUser()
    currentUser: JwtUser,
    @Body()
    dto: CancelStockTransferDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.stockTransfersService.cancel(
      currentBusiness.id,
      id,
      currentUser.id,
      dto,
    );
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