import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtUser } from '../auth/types/jwt-user.type';
import { PermissionCodes } from '../authorization/constants/permission-codes';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { CurrentBusiness } from '../business-context/decorators/current-business.decorator';
import { CurrentMembership } from '../business-context/decorators/current-membership.decorator';
import { BusinessContextResponseDto } from '../business-context/dto/business-context-response.dto';
import { BusinessContextGuard } from '../business-context/guards/business-context.guard';
import type {
  CurrentBusinessData,
  CurrentMembershipData,
} from '../business-context/types/business-context.type';
import { BusinessesService } from './businesses.service';
import { CreateBusinessResponseDto } from './dto/create-business-response.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UserBusinessResponseDto } from './dto/user-business-response.dto';

@ApiTags('Businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a business',
    description:
      'Creates a business and automatically assigns the authenticated user as its owner.',
  })
  @ApiCreatedResponse({
    description:
      'Business, owner membership, and Owner role created successfully',
    type: CreateBusinessResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiConflictResponse({
    description: 'Business code already exists',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unable to complete business onboarding',
  })
  create(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateBusinessDto,
  ): Promise<CreateBusinessResponseDto> {
    return this.businessesService.create(currentUser.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List businesses available to the authenticated user',
    description:
      'Returns active business memberships together with assigned roles.',
  })
  @ApiOkResponse({
    description: 'Businesses available to the authenticated user',
    type: UserBusinessResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  findAll(
    @CurrentUser() currentUser: JwtUser,
  ): Promise<UserBusinessResponseDto[]> {
    return this.businessesService.findAllForUser(currentUser.id);
  }

  @Get('context')
  @UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionGuard)
  @RequirePermissions(PermissionCodes.BUSINESS_VIEW)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Business-Id',
    description: 'Business UUID selected by the authenticated user',
    required: true,
    example: 'f23bd92a-ff79-456d-8282-ab86035ea795',
  })
  @ApiOperation({
    summary: 'Validate the selected business context',
    description:
      'Validates business access and confirms that the member has permission to view the business.',
  })
  @ApiOkResponse({
    description: 'Validated business context',
    type: BusinessContextResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'X-Business-Id is missing or is not a valid UUID',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired',
  })
  @ApiForbiddenResponse({
    description:
      'The user lacks active business access or the required permission',
  })
  getBusinessContext(
    @CurrentBusiness() business: CurrentBusinessData,
    @CurrentMembership() membership: CurrentMembershipData,
  ): BusinessContextResponseDto {
    return {
      business,
      membership,
    };
  }
}
