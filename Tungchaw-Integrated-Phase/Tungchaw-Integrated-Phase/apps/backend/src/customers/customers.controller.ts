import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionCodes } from '../authorization/constants/permission-codes';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { CurrentBusiness } from '../business-context/decorators/current-business.decorator';
import { BusinessContextGuard } from '../business-context/guards/business-context.guard';
import type { CurrentBusinessData } from '../business-context/types/business-context.type';

import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('businesses/:businessId/customers')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions(PermissionCodes.CUSTOMER_CREATE)
  @ApiOperation({
    summary: 'Create a customer',
    description: 'Creates a customer inside the selected business.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiCreatedResponse({
    description: 'Customer created successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed or the URL businessId does not match the selected business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the CUSTOMER_CREATE permission',
  })
  @ApiConflictResponse({
    description: 'Customer code already exists in this business',
  })
  create(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,

    @Body()
    dto: CreateCustomerDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.customersService.create(currentBusiness.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.CUSTOMER_VIEW)
  @ApiOperation({
    summary: 'List customers',
    description:
      'Returns customers belonging only to the selected business with searching, filtering, and pagination.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiOkResponse({
    description: 'Paginated customer list',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed or the URL businessId does not match the selected business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the CUSTOMER_VIEW permission',
  })
  findAll(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,

    @Query()
    query: CustomerQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.customersService.findAll(currentBusiness.id, query);
  }

  @Get(':customerId')
  @RequirePermissions(PermissionCodes.CUSTOMER_VIEW)
  @ApiOperation({
    summary: 'Get a customer',
    description:
      'Returns one customer only when it belongs to the selected business.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer UUID',
  })
  @ApiOkResponse({
    description: 'Customer details',
  })
  @ApiBadRequestResponse({
    description:
      'The URL businessId does not match the selected business or a UUID is invalid',
  })
  @ApiNotFoundResponse({
    description: 'Customer not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the CUSTOMER_VIEW permission',
  })
  findOne(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @Param('customerId', new ParseUUIDPipe())
    customerId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.customersService.findOne(currentBusiness.id, customerId);
  }

  @Patch(':customerId')
  @RequirePermissions(PermissionCodes.CUSTOMER_UPDATE)
  @ApiOperation({
    summary: 'Update a customer',
    description:
      'Updates a customer only when it belongs to the selected business.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer UUID',
  })
  @ApiOkResponse({
    description: 'Customer updated successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed, a UUID is invalid, or the business context does not match the URL',
  })
  @ApiNotFoundResponse({
    description: 'Customer not found',
  })
  @ApiConflictResponse({
    description: 'Customer code already exists in this business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the CUSTOMER_UPDATE permission',
  })
  update(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @Param('customerId', new ParseUUIDPipe())
    customerId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,

    @Body()
    dto: UpdateCustomerDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.customersService.update(currentBusiness.id, customerId, dto);
  }

  @Delete(':customerId')
  @RequirePermissions(PermissionCodes.CUSTOMER_DELETE)
  @ApiOperation({
    summary: 'Deactivate a customer',
    description: 'Soft-deletes a customer by setting isActive to false.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer UUID',
  })
  @ApiOkResponse({
    description: 'Customer deactivated successfully',
  })
  @ApiBadRequestResponse({
    description:
      'A UUID is invalid or the URL businessId does not match the selected business',
  })
  @ApiNotFoundResponse({
    description: 'Customer not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the CUSTOMER_DELETE permission',
  })
  deactivate(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @Param('customerId', new ParseUUIDPipe())
    customerId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.customersService.deactivate(currentBusiness.id, customerId);
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
