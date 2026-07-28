import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionCodes } from '../authorization/constants/permission-codes';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { CurrentBusiness } from '../business-context/decorators/current-business.decorator';
import { BusinessContextGuard } from '../business-context/guards/business-context.guard';
import type { CurrentBusinessData } from '../business-context/types/business-context.type';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('Accounting - Expenses')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', description: 'Business UUID selected by the authenticated user', required: true })
@Controller('businesses/:businessId/expenses')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Post()
  @RequirePermissions(PermissionCodes.EXPENSE_CREATE)
  @ApiOperation({ summary: 'Create an expense' })
  @ApiCreatedResponse({ description: 'Created successfully' })
  @ApiBadRequestResponse({ description: 'Validation failed or business context mismatch' })
  @ApiConflictResponse({ description: 'Code or number already exists in this business' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Permission denied' })
  create(@Param('businessId', new ParseUUIDPipe()) businessId: string, @CurrentBusiness() business: CurrentBusinessData, @Body() dto: CreateExpenseDto) {
    this.assertBusiness(businessId, business.id);
    return this.service.create(business.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.EXPENSE_VIEW)
  @ApiOperation({ summary: 'List expenses' })
  @ApiOkResponse({ description: 'Paginated list' })
  findAll(@Param('businessId', new ParseUUIDPipe()) businessId: string, @CurrentBusiness() business: CurrentBusinessData, @Query() query: ExpenseQueryDto) {
    this.assertBusiness(businessId, business.id);
    return this.service.findAll(business.id, query);
  }

  @Get(':expenseId')
  @RequirePermissions(PermissionCodes.EXPENSE_VIEW)
  @ApiOperation({ summary: 'Get expense' })
  @ApiOkResponse({ description: 'Details' })
  @ApiNotFoundResponse({ description: 'Not found' })
  findOne(@Param('businessId', new ParseUUIDPipe()) businessId: string, @Param('expenseId', new ParseUUIDPipe()) id: string, @CurrentBusiness() business: CurrentBusinessData) {
    this.assertBusiness(businessId, business.id);
    return this.service.findOne(business.id, id);
  }

  @Patch(':expenseId')
  @RequirePermissions(PermissionCodes.EXPENSE_UPDATE)
  @ApiOperation({ summary: 'Update expense' })
  @ApiOkResponse({ description: 'Updated successfully' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiConflictResponse({ description: 'Code or number already exists in this business' })
  update(@Param('businessId', new ParseUUIDPipe()) businessId: string, @Param('expenseId', new ParseUUIDPipe()) id: string, @CurrentBusiness() business: CurrentBusinessData, @Body() dto: UpdateExpenseDto) {
    this.assertBusiness(businessId, business.id);
    return this.service.update(business.id, id, dto);
  }

  @Delete(':expenseId')
  @RequirePermissions(PermissionCodes.EXPENSE_DELETE)
  @ApiOperation({ summary: 'Deactivate expense' })
  @ApiOkResponse({ description: 'Deactivated successfully' })
  @ApiNotFoundResponse({ description: 'Not found' })
  deactivate(@Param('businessId', new ParseUUIDPipe()) businessId: string, @Param('expenseId', new ParseUUIDPipe()) id: string, @CurrentBusiness() business: CurrentBusinessData) {
    this.assertBusiness(businessId, business.id);
    return this.service.deactivate(business.id, id);
  }

  private assertBusiness(routeId: string, contextId: string): void {
    if (routeId !== contextId) throw new BadRequestException('URL businessId must match the X-Business-Id header');
  }
}
