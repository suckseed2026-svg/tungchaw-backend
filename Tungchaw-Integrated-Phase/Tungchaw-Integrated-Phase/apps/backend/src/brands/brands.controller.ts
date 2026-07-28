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
import { BrandsService } from './brands.service';
import { BrandQueryDto } from './dto/brand-query.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('Inventory - Brands')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('businesses/:businessId/brands')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @RequirePermissions(PermissionCodes.BRAND_CREATE)
  @ApiOperation({
    summary: 'Create a brand',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiCreatedResponse({
    description: 'Brand created successfully',
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
      'The user lacks business access or the BRAND_CREATE permission',
  })
  @ApiConflictResponse({
    description: 'Brand code already exists in this business',
  })
  create(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Body() dto: CreateBrandDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.brandsService.create(currentBusiness.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.BRAND_VIEW)
  @ApiOperation({
    summary: 'List brands',
    description:
      'Returns tenant-scoped brands with search, filtering, and pagination.',
  })
  @ApiOkResponse({
    description: 'Paginated brands',
  })
  @ApiBadRequestResponse({
    description: 'Business context does not match the URL',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description: 'The user lacks business access or the BRAND_VIEW permission',
  })
  findAll(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: BrandQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.brandsService.findAll(currentBusiness.id, query);
  }

  @Get(':brandId')
  @RequirePermissions(PermissionCodes.BRAND_VIEW)
  @ApiOperation({
    summary: 'Get a brand',
  })
  @ApiParam({
    name: 'brandId',
    description: 'Brand UUID',
  })
  @ApiOkResponse({
    description: 'Brand details',
  })
  @ApiNotFoundResponse({
    description: 'Brand not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description: 'The user lacks business access or the BRAND_VIEW permission',
  })
  findOne(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.brandsService.findOne(currentBusiness.id, brandId);
  }

  @Patch(':brandId')
  @RequirePermissions(PermissionCodes.BRAND_UPDATE)
  @ApiOperation({
    summary: 'Update a brand',
  })
  @ApiOkResponse({
    description: 'Brand updated successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Request validation failed or business context does not match the URL',
  })
  @ApiNotFoundResponse({
    description: 'Brand not found',
  })
  @ApiConflictResponse({
    description: 'Brand code already exists in this business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the BRAND_UPDATE permission',
  })
  update(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Body() dto: UpdateBrandDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.brandsService.update(currentBusiness.id, brandId, dto);
  }

  @Delete(':brandId')
  @RequirePermissions(PermissionCodes.BRAND_DELETE)
  @ApiOperation({
    summary: 'Deactivate a brand',
    description:
      'Soft-deletes the brand by setting its active status to false.',
  })
  @ApiOkResponse({
    description: 'Brand deactivated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Brand not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the BRAND_DELETE permission',
  })
  deactivate(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.brandsService.deactivate(currentBusiness.id, brandId);
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
