import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';

@ApiTags('Branches')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Business-Id',
  description: 'Business UUID selected by the authenticated user',
  required: true,
  example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
})
@Controller('businesses/:businessId/branches')
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @RequirePermissions(PermissionCodes.BRANCH_CREATE)
  @ApiOperation({
    summary: 'Create a branch',
    description:
      'Creates a branch inside the selected business. The URL business ID must match X-Business-Id.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
    example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
  })
  @ApiCreatedResponse({
    description: 'Branch created successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Business ID is invalid, the business context does not match the URL, or request validation failed',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks active business access or the BRANCH_CREATE permission',
  })
  @ApiConflictResponse({
    description: 'Branch code already exists in this business',
  })
  create(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
    @Body() dto: CreateBranchDto,
  ) {
    this.assertMatchingBusinessContext(businessId, currentBusiness.id);

    return this.branchesService.create(currentBusiness.id, dto);
  }

  @Get()
  @RequirePermissions(PermissionCodes.BRANCH_VIEW)
  @ApiOperation({
    summary: 'List branches',
    description:
      'Returns branches belonging only to the selected and validated business.',
  })
  @ApiParam({
    name: 'businessId',
    description: 'Business UUID',
    example: '2c62dc07-964f-4fdc-a768-128b10ad5bfe',
  })
  @ApiOkResponse({
    description: 'Branches belonging to the selected business',
  })
  @ApiBadRequestResponse({
    description:
      'Business ID is invalid or the business context does not match the URL',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks active business access or the BRANCH_VIEW permission',
  })
  findAll(
    @Param('businessId', new ParseUUIDPipe()) businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessData,
  ) {
    this.assertMatchingBusinessContext(businessId, currentBusiness.id);

    return this.branchesService.findAllByBusiness(currentBusiness.id);
  }

  private assertMatchingBusinessContext(
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
