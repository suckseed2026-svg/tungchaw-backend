import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionCodes } from '../authorization/constants/permission-codes';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { CurrentBusiness } from '../business-context/decorators/current-business.decorator';
import { BusinessContextGuard } from '../business-context/guards/business-context.guard';
import type { CurrentBusinessData } from '../business-context/types/business-context.type';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { ExpenseCategoryQueryDto } from './dto/expense-category-query.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { ExpenseCategoriesService } from './expense-categories.service';

@ApiTags('Accounting - Expense Categories')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', description: 'Business UUID selected by the authenticated user', required: true })
@Controller('businesses/:businessId/expense-categories')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class ExpenseCategoriesController {
  constructor(private readonly service: ExpenseCategoriesService) {}

  @Post()
  @RequirePermissions(PermissionCodes.EXPENSE_CATEGORY_CREATE)
  @ApiOperation({ summary: 'Create an an expense category' })
  @ApiCreatedResponse({ description: 'Created successfully' })
  @ApiBadRequestResponse({ description: 'Validation failed or business context mismatch' })
  @ApiConflictResponse({ description: 'Code or number already exists in this business' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Permission denied' })
  create(@Param('businessId', new ParseUUIDPipe()) businessId: string, @CurrentBusiness() business: CurrentBusinessData, @Body() dto: CreateExpenseCategoryDto) {
    this.assertBusiness(businessId, business.id);
    return this.service.create(business.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.EXPENSE_CATEGORY_VIEW)
  @ApiOperation({ summary: 'List expenseCategories' })
  @ApiOkResponse({ description: 'Paginated list' })
  findAll(@Param('businessId', new ParseUUIDPipe()) businessId: string, @CurrentBusiness() business: CurrentBusinessData, @Query() query: ExpenseCategoryQueryDto) {
    this.assertBusiness(businessId, business.id);
    return this.service.findAll(business.id, query);
  }

  @Get(':expenseCategoryId')
  @RequirePermissions(PermissionCodes.EXPENSE_CATEGORY_VIEW)
  @ApiOperation({ summary: 'Get expenseCategory' })
  @ApiOkResponse({ description: 'Details' })
  @ApiNotFoundResponse({ description: 'Not found' })
  findOne(@Param('businessId', new ParseUUIDPipe()) businessId: string, @Param('expenseCategoryId', new ParseUUIDPipe()) id: string, @CurrentBusiness() business: CurrentBusinessData) {
    this.assertBusiness(businessId, business.id);
    return this.service.findOne(business.id, id);
  }

  @Patch(':expenseCategoryId')
  @RequirePermissions(PermissionCodes.EXPENSE_CATEGORY_UPDATE)
  @ApiOperation({ summary: 'Update expenseCategory' })
  @ApiOkResponse({ description: 'Updated successfully' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiConflictResponse({ description: 'Code or number already exists in this business' })
  update(@Param('businessId', new ParseUUIDPipe()) businessId: string, @Param('expenseCategoryId', new ParseUUIDPipe()) id: string, @CurrentBusiness() business: CurrentBusinessData, @Body() dto: UpdateExpenseCategoryDto) {
    this.assertBusiness(businessId, business.id);
    return this.service.update(business.id, id, dto);
  }

  @Delete(':expenseCategoryId')
  @RequirePermissions(PermissionCodes.EXPENSE_CATEGORY_DELETE)
  @ApiOperation({ summary: 'Deactivate expenseCategory' })
  @ApiOkResponse({ description: 'Deactivated successfully' })
  @ApiNotFoundResponse({ description: 'Not found' })
  deactivate(@Param('businessId', new ParseUUIDPipe()) businessId: string, @Param('expenseCategoryId', new ParseUUIDPipe()) id: string, @CurrentBusiness() business: CurrentBusinessData) {
    this.assertBusiness(businessId, business.id);
    return this.service.deactivate(business.id, id);
  }

  private assertBusiness(routeId: string, contextId: string): void {
    if (routeId !== contextId) throw new BadRequestException('URL businessId must match the X-Business-Id header');
  }
}
