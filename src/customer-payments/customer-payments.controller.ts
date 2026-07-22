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
} from "@nestjs/common";
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
} from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { JwtUser } from "../auth/types/jwt-user.type";
import { PermissionCodes } from "../authorization/constants/permission-codes";
import { RequirePermissions } from "../authorization/decorators/require-permissions.decorator";
import { PermissionGuard } from "../authorization/guards/permission.guard";
import { CurrentBusiness } from "../business-context/decorators/current-business.decorator";
import { BusinessContextGuard } from "../business-context/guards/business-context.guard";
import type { CurrentBusinessData } from "../business-context/types/business-context.type";
import { CustomerPaymentsService } from "./customer-payments.service";
import { CreateCustomerPaymentDto } from "./dto/create-customer-payment.dto";
import { CustomerPaymentQueryDto } from "./dto/customer-payment-query.dto";

@ApiTags("Customer Payments")
@ApiBearerAuth()
@ApiHeader({
  name: "X-Business-Id",
  description: "Business UUID selected by the authenticated user",
  required: true,
  example: "2c62dc07-964f-4fdc-a768-128b10ad5bfe",
})
@Controller("businesses/:businessId/customers/:customerId/payments")
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class CustomerPaymentsController {
  constructor(
    private readonly customerPaymentsService: CustomerPaymentsService,
  ) {}

  @Post()
  @RequirePermissions(PermissionCodes.CUSTOMER_PAYMENT_CREATE)
  @ApiOperation({
    summary: "Record a customer credit payment",
    description:
      "Records money received against the customer outstanding balance. Advance payments are not allowed in V1.",
  })
  @ApiParam({ name: "businessId", description: "Business UUID" })
  @ApiParam({ name: "customerId", description: "Customer UUID" })
  @ApiCreatedResponse({ description: "Customer payment recorded successfully" })
  @ApiBadRequestResponse({
    description:
      "Validation failed, payment exceeds outstanding balance, or business context does not match",
  })
  @ApiConflictResponse({
    description: "Payment number conflict; retry the request",
  })
  @ApiNotFoundResponse({ description: "Customer or branch not found" })
  @ApiUnauthorizedResponse({
    description: "Access token is invalid or expired",
  })
  @ApiForbiddenResponse({
    description:
      "Business access or CUSTOMER_PAYMENT_CREATE permission is missing",
  })
  create(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCustomerPaymentDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.customerPaymentsService.create(
      business.id,
      customerId,
      user.id,
      dto,
    );
  }

  @Get()
  @RequirePermissions(PermissionCodes.CUSTOMER_PAYMENT_VIEW)
  @ApiOperation({ summary: "List a customer payment history" })
  @ApiParam({ name: "businessId", description: "Business UUID" })
  @ApiParam({ name: "customerId", description: "Customer UUID" })
  @ApiOkResponse({ description: "Paginated customer payment history" })
  @ApiNotFoundResponse({ description: "Customer not found" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @CurrentBusiness() business: CurrentBusinessData,
    @Query() query: CustomerPaymentQueryDto,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.customerPaymentsService.findAll(business.id, customerId, query);
  }

  @Get("balance")
  @RequirePermissions(PermissionCodes.CUSTOMER_PAYMENT_VIEW)
  @ApiOperation({ summary: "Get the customer outstanding credit balance" })
  @ApiParam({ name: "businessId", description: "Business UUID" })
  @ApiParam({ name: "customerId", description: "Customer UUID" })
  @ApiOkResponse({ description: "Customer balance summary" })
  @ApiNotFoundResponse({ description: "Customer not found" })
  getBalance(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @CurrentBusiness() business: CurrentBusinessData,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.customerPaymentsService.getBalance(business.id, customerId);
  }

  @Get(":paymentId")
  @RequirePermissions(PermissionCodes.CUSTOMER_PAYMENT_VIEW)
  @ApiOperation({ summary: "Get one customer payment" })
  @ApiParam({ name: "businessId", description: "Business UUID" })
  @ApiParam({ name: "customerId", description: "Customer UUID" })
  @ApiParam({ name: "paymentId", description: "Customer payment UUID" })
  @ApiOkResponse({ description: "Customer payment details" })
  @ApiNotFoundResponse({ description: "Customer payment not found" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("customerId", ParseUUIDPipe) customerId: string,
    @Param("paymentId", ParseUUIDPipe) paymentId: string,
    @CurrentBusiness() business: CurrentBusinessData,
  ) {
    this.assertBusiness(businessId, business.id);
    return this.customerPaymentsService.findOne(
      business.id,
      customerId,
      paymentId,
    );
  }

  private assertBusiness(routeId: string, contextId: string): void {
    if (routeId !== contextId) {
      throw new BadRequestException(
        "URL businessId must match the X-Business-Id header",
      );
    }
  }
}
