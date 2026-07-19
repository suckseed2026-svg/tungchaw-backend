import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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


import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessContextGuard } from '../business-context/guards/business-context.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';

import { CurrentBusiness } from '../business-context/decorators/current-business.decorator';
import type { CurrentBusinessData } from '../business-context/types/business-context.type';

import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
import { PermissionCodes } from '../authorization/constants/permission-codes';

import { CustomersService } from './customers.service';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'UUID of the currently selected business',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('customers')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create customer',
  })
  @RequirePermissions(PermissionCodes.CUSTOMER_CREATE)
  create(
    @CurrentBusiness() business: CurrentBusinessData,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(business.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List customers',
  })
  @RequirePermissions(PermissionCodes.CUSTOMER_VIEW)
  findAll(
    @CurrentBusiness() business: CurrentBusinessData,
    @Query() query: CustomerQueryDto,
  ) {
    return this.customersService.findAll(business.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get customer',
  })
  @RequirePermissions(PermissionCodes.CUSTOMER_VIEW)
  findOne(
    @CurrentBusiness() business: CurrentBusinessData,
    @Param('id') id: string,
  ) {
    return this.customersService.findOne(business.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update customer',
  })
  @RequirePermissions(PermissionCodes.CUSTOMER_UPDATE)
  update(
    @CurrentBusiness() business: CurrentBusinessData,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(business.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate customer',
  })
  @RequirePermissions(PermissionCodes.CUSTOMER_DELETE)
  deactivate(
    @CurrentBusiness() business: CurrentBusinessData,
    @Param('id') id: string,
  ) {
    return this.customersService.deactivate(business.id, id);
  }
}