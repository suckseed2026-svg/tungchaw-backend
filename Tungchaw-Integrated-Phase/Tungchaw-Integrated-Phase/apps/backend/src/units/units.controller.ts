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
import { CreateUnitDto } from './dto/create-unit.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@ApiTags('Inventory - Units')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('businesses/:businessId/units')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @RequirePermissions(PermissionCodes.UNIT_CREATE)
  @ApiOperation({
    summary: 'Create a unit',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
  })
  @ApiCreatedResponse({
    description: 'Unit created successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Request validation failed or business context does not match the URL',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description: 'The user lacks business access or the UNIT_CREATE permission',
  })
  @ApiConflictResponse({
    description: 'Unit code already exists in this business',
  })
  create(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Body() dto: CreateUnitDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.unitsService.create(currentBusiness.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.UNIT_VIEW)
  @ApiOperation({
    summary: 'List units',
    description:
      'Returns tenant-scoped units with search, filtering, and pagination.',
  })
  @ApiOkResponse({
    description: 'Paginated units',
  })
  @ApiBadRequestResponse({
    description: 'Business context does not match the URL',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description: 'The user lacks business access or the UNIT_VIEW permission',
  })
  findAll(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Query() query: UnitQueryDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.unitsService.findAll(currentBusiness.id, query);
  }

  @Get(':unitId')
  @RequirePermissions(PermissionCodes.UNIT_VIEW)
  @ApiOperation({
    summary: 'Get a unit',
  })
  @ApiParam({
    name: 'unitId',
    description: 'Unit UUID',
  })
  @ApiOkResponse({
    description: 'Unit details',
  })
  @ApiNotFoundResponse({
    description: 'Unit not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description: 'The user lacks business access or the UNIT_VIEW permission',
  })
  findOne(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.unitsService.findOne(currentBusiness.id, unitId);
  }

  @Patch(':unitId')
  @RequirePermissions(PermissionCodes.UNIT_UPDATE)
  @ApiOperation({
    summary: 'Update a unit',
  })
  @ApiOkResponse({
    description: 'Unit updated successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Request validation failed or business context does not match the URL',
  })
  @ApiNotFoundResponse({
    description: 'Unit not found',
  })
  @ApiConflictResponse({
    description: 'Unit code already exists in this business',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description: 'The user lacks business access or the UNIT_UPDATE permission',
  })
  update(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Body() dto: UpdateUnitDto,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.unitsService.update(currentBusiness.id, unitId, dto);
  }

  @Delete(':unitId')
  @RequirePermissions(PermissionCodes.UNIT_DELETE)
  @ApiOperation({
    summary: 'Deactivate a unit',
    description: 'Soft-deletes the unit by setting its active status to false.',
  })
  @ApiOkResponse({
    description: 'Unit deactivated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Unit not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description: 'The user lacks business access or the UNIT_DELETE permission',
  })
  deactivate(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertBusinessContext(businessId, currentBusiness.id);

    return this.unitsService.deactivate(currentBusiness.id, unitId);
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
