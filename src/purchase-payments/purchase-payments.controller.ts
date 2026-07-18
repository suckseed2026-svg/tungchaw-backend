import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePurchasePaymentDto } from './dto/create-purchase-payment.dto';
import { PurchasePaymentsService } from './purchase-payments.service';

type AuthenticatedRequest = {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@ApiTags('Purchase Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/purchases/:purchaseId/payments')
export class PurchasePaymentsController {
  constructor(
    private readonly purchasePaymentsService: PurchasePaymentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Record a payment for a received purchase' })
  @ApiCreatedResponse({ description: 'Purchase payment recorded' })
  create(
    @Param('businessId') businessId: string,
    @Param('purchaseId') purchaseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePurchasePaymentDto,
  ) {
    const createdById =
      request.user?.id ?? request.user?.userId ?? request.user?.sub;

    if (!createdById) {
      throw new UnauthorizedException(
        'Authenticated user identifier is missing.',
      );
    }

    return this.purchasePaymentsService.create(
      businessId,
      purchaseId,
      createdById,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List payments and balance for a purchase' })
  @ApiOkResponse({ description: 'Purchase payments returned' })
  findAll(
    @Param('businessId') businessId: string,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.purchasePaymentsService.findAll(businessId, purchaseId);
  }

  @Get(':paymentId')
  @ApiOperation({ summary: 'Get one purchase payment' })
  @ApiOkResponse({ description: 'Purchase payment returned' })
  findOne(
    @Param('businessId') businessId: string,
    @Param('purchaseId') purchaseId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.purchasePaymentsService.findOne(
      businessId,
      purchaseId,
      paymentId,
    );
  }
}
