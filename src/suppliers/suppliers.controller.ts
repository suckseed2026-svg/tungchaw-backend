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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('Purchase - Suppliers')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('businesses/:businessId/suppliers')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @RequirePermissions(PermissionCodes.SUPPLIER_CREATE)
  @ApiOperation({
    summary: 'Create a supplier',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiCreatedResponse({
    description: 'Supplier created successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed or the URL business ID does not match the selected business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the SUPPLIER_CREATE permission',
  })
  @ApiConflictResponse({
    description: 'Supplier code already exists in this business',
  })
  create(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Body() dto: CreateSupplierDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.suppliersService.create(currentBusiness.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.SUPPLIER_VIEW)
  @ApiOperation({
    summary: 'List suppliers',
    description:
      'Returns tenant-scoped suppliers with searching, filtering, and pagination.',
  })
  @ApiOkResponse({
    description: 'Paginated supplier list',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed or the URL business ID does not match the selected business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the SUPPLIER_VIEW permission',
  })
  findAll(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: SupplierQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.suppliersService.findAll(currentBusiness.id, query);
  }

  @Get(':supplierId')
  @RequirePermissions(PermissionCodes.SUPPLIER_VIEW)
  @ApiOperation({
    summary: 'Get a supplier',
  })
  @ApiParam({
    name: 'supplierId',
    description: 'Supplier UUID',
  })
  @ApiOkResponse({
    description: 'Supplier details',
  })
  @ApiNotFoundResponse({
    description: 'Supplier not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the SUPPLIER_VIEW permission',
  })
  findOne(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('supplierId', new ParseUUIDPipe()) supplierId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.suppliersService.findOne(currentBusiness.id, supplierId);
  }

  @Patch(':supplierId')
  @RequirePermissions(PermissionCodes.SUPPLIER_UPDATE)
  @ApiOperation({
    summary: 'Update a supplier',
  })
  @ApiOkResponse({
    description: 'Supplier updated successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed or the URL business ID does not match the selected business',
  })
  @ApiNotFoundResponse({
    description: 'Supplier not found',
  })
  @ApiConflictResponse({
    description: 'Supplier code already exists in this business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the SUPPLIER_UPDATE permission',
  })
  update(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('supplierId', new ParseUUIDPipe()) supplierId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Body() dto: UpdateSupplierDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.suppliersService.update(currentBusiness.id, supplierId, dto);
  }

  @Delete(':supplierId')
  @RequirePermissions(PermissionCodes.SUPPLIER_DELETE)
  @ApiOperation({
    summary: 'Deactivate a supplier',
    description: 'Soft-deletes the supplier by setting isActive to false.',
  })
  @ApiOkResponse({
    description: 'Supplier deactivated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Supplier not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the SUPPLIER_DELETE permission',
  })
  deactivate(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('supplierId', new ParseUUIDPipe()) supplierId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.suppliersService.deactivate(currentBusiness.id, supplierId);
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
