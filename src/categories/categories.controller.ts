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
import { CategoriesService } from './categories.service';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Inventory - Categories')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('businesses/:businessId/categories')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @RequirePermissions(PermissionCodes.CATEGORY_CREATE)
  @ApiOperation({
    summary: 'Create a category',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiCreatedResponse({
    description: 'Category created successfully',
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
      'The user lacks business access or the CATEGORY_CREATE permission',
  })
  @ApiConflictResponse({
    description: 'Category code already exists in this business',
  })
  create(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Body() dto: CreateCategoryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.categoriesService.create(currentBusiness.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.CATEGORY_VIEW)
  @ApiOperation({
    summary: 'List categories',
    description:
      'Returns tenant-scoped categories with search, filtering, and pagination.',
  })
  @ApiOkResponse({
    description: 'Paginated categories',
  })
  @ApiBadRequestResponse({
    description: 'Business context does not match the URL',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the CATEGORY_VIEW permission',
  })
  findAll(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: CategoryQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.categoriesService.findAll(currentBusiness.id, query);
  }

  @Get(':categoryId')
  @RequirePermissions(PermissionCodes.CATEGORY_VIEW)
  @ApiOperation({
    summary: 'Get a category',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category UUID',
  })
  @ApiOkResponse({
    description: 'Category details',
  })
  @ApiNotFoundResponse({
    description: 'Category not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the CATEGORY_VIEW permission',
  })
  findOne(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.categoriesService.findOne(currentBusiness.id, categoryId);
  }

  @Patch(':categoryId')
  @RequirePermissions(PermissionCodes.CATEGORY_UPDATE)
  @ApiOperation({
    summary: 'Update a category',
  })
  @ApiOkResponse({
    description: 'Category updated successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Request validation failed or business context does not match the URL',
  })
  @ApiNotFoundResponse({
    description: 'Category not found',
  })
  @ApiConflictResponse({
    description: 'Category code already exists in this business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the CATEGORY_UPDATE permission',
  })
  update(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Body() dto: UpdateCategoryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.categoriesService.update(currentBusiness.id, categoryId, dto);
  }

  @Delete(':categoryId')
  @RequirePermissions(PermissionCodes.CATEGORY_DELETE)
  @ApiOperation({
    summary: 'Deactivate a category',
    description:
      'Soft-deletes the category by setting its active status to false.',
  })
  @ApiOkResponse({
    description: 'Category deactivated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Category not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks business access or the CATEGORY_DELETE permission',
  })
  deactivate(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.categoriesService.deactivate(currentBusiness.id, categoryId);
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
