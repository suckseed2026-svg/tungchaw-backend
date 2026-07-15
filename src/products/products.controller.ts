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
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Inventory - Products')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('businesses/:businessId/products')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermissions(PermissionCodes.PRODUCT_CREATE)
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Creates a tenant-scoped product and validates its category, unit, and brand.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiCreatedResponse({
    description: 'Product created successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed, a related record is invalid, or the business context does not match the URL',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the PRODUCT_CREATE permission',
  })
  @ApiConflictResponse({
    description: 'Product code or barcode already exists in this business',
  })
  create(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,

    @Body()
    dto: CreateProductDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.productsService.create(currentBusiness.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.PRODUCT_VIEW)
  @ApiOperation({
    summary: 'List products',
    description:
      'Returns tenant-scoped products with filtering, searching, pagination, and related category, unit, and brand details.',
  })
  @ApiOkResponse({
    description: 'Paginated products',
  })
  @ApiBadRequestResponse({
    description:
      'Request validation failed or business context does not match the URL',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the PRODUCT_VIEW permission',
  })
  findAll(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,

    @Query()
    query: ProductQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.productsService.findAll(currentBusiness.id, query);
  }

  @Get(':productId')
  @RequirePermissions(PermissionCodes.PRODUCT_VIEW)
  @ApiOperation({
    summary: 'Get a product',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product UUID',
  })
  @ApiOkResponse({
    description: 'Product details',
  })
  @ApiNotFoundResponse({
    description: 'Product not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the PRODUCT_VIEW permission',
  })
  findOne(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @Param('productId', new ParseUUIDPipe())
    productId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.productsService.findOne(currentBusiness.id, productId);
  }

  @Patch(':productId')
  @RequirePermissions(PermissionCodes.PRODUCT_UPDATE)
  @ApiOperation({
    summary: 'Update a product',
  })
  @ApiOkResponse({
    description: 'Product updated successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed, a related record is invalid, or the business context does not match the URL',
  })
  @ApiNotFoundResponse({
    description: 'Product not found',
  })
  @ApiConflictResponse({
    description: 'Product code or barcode already exists in this business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the PRODUCT_UPDATE permission',
  })
  update(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @Param('productId', new ParseUUIDPipe())
    productId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,

    @Body()
    dto: UpdateProductDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.productsService.update(currentBusiness.id, productId, dto);
  }

  @Delete(':productId')
  @RequirePermissions(PermissionCodes.PRODUCT_DELETE)
  @ApiOperation({
    summary: 'Deactivate a product',
    description: 'Soft-deletes the product by setting isActive to false.',
  })
  @ApiOkResponse({
    description: 'Product deactivated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Product not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the PRODUCT_DELETE permission',
  })
  deactivate(
    @Param('businessId', new ParseUUIDPipe())
    businessId: string,

    @Param('productId', new ParseUUIDPipe())
    productId: string,

    @CurrentBusiness()
    currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.productsService.deactivate(currentBusiness.id, productId);
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
