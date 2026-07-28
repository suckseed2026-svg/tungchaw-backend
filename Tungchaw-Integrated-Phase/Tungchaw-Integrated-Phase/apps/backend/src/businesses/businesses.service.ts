import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { BusinessIndustry, MembershipStatus } from '../generated/prisma/enums';
import { getBusinessInventoryDefaults } from '../business-configurations/constants/business-industry-defaults';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessResponseDto } from './dto/create-business-response.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UserBusinessResponseDto } from './dto/user-business-response.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateBusinessDto,
  ): Promise<CreateBusinessResponseDto> {
    const name = dto.name.trim();
    const normalizedCode = dto.code.trim().toUpperCase();
    const phone = dto.phone?.trim() || null;
    const email = dto.email?.trim().toLowerCase() || null;
    const address = dto.address?.trim() || null;
    const industry = dto.industry ?? BusinessIndustry.GENERAL_RETAIL;
    const inventoryDefaults = getBusinessInventoryDefaults(industry);

    const existingBusiness = await this.prisma.business.findUnique({
      where: {
        code: normalizedCode,
      },
      select: {
        id: true,
      },
    });

    if (existingBusiness) {
      throw new ConflictException('Business code already exists');
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const business = await transaction.business.create({
          data: {
            name,
            code: normalizedCode,
            phone,
            email,
            address,
            industry,
            configuration: {
              create: inventoryDefaults,
            },
          },
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            phone: true,
            email: true,
            address: true,
            timezone: true,
            currency: true,
            industry: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const membership = await transaction.businessMember.create({
          data: {
            businessId: business.id,
            userId,
            status: MembershipStatus.ACTIVE,
            isOwner: true,
            joinedAt: new Date(),
          },
          select: {
            id: true,
            userId: true,
            businessId: true,
            status: true,
            isOwner: true,
            joinedAt: true,
          },
        });

        const ownerRole = await transaction.role.create({
          data: {
            businessId: business.id,
            name: 'Owner',
            code: 'OWNER',
            description:
              'System role with full administrative control over the business',
            isSystem: true,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            code: true,
            isSystem: true,
            isActive: true,
          },
        });

        const activePermissions = await transaction.permission.findMany({
          where: {
            isActive: true,
          },
          select: {
            id: true,
          },
        });

        if (activePermissions.length === 0) {
          throw new InternalServerErrorException(
            'System permissions have not been seeded',
          );
        }

        await transaction.rolePermission.createMany({
          data: activePermissions.map((permission) => ({
            roleId: ownerRole.id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });

        await transaction.memberRole.create({
          data: {
            memberId: membership.id,
            roleId: ownerRole.id,
          },
        });

        if (!membership.joinedAt) {
          throw new InternalServerErrorException(
            'Owner membership joining date was not created',
          );
        }

        return {
          message: 'Business created successfully',
          business,
          membership: {
            id: membership.id,
            userId: membership.userId,
            businessId: membership.businessId,
            status: membership.status,
            isOwner: membership.isOwner,
            joinedAt: membership.joinedAt,
          },
          ownerRole,
        };
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Business code already exists');
      }

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to create business at this time',
      );
    }
  }

  async findAllForUser(userId: string): Promise<UserBusinessResponseDto[]> {
    const memberships = await this.prisma.businessMember.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
      },
      orderBy: {
        joinedAt: 'asc',
      },
      select: {
        id: true,
        status: true,
        isOwner: true,
        joinedAt: true,
        business: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            phone: true,
            email: true,
            address: true,
            timezone: true,
            currency: true,
            industry: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        roleAssignments: {
          where: {
            role: {
              isActive: true,
            },
          },
          select: {
            role: {
              select: {
                id: true,
                name: true,
                code: true,
                isSystem: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      membershipStatus: membership.status,
      isOwner: membership.isOwner,
      joinedAt: membership.joinedAt,
      business: membership.business,
      roles: membership.roleAssignments.map((assignment) => assignment.role),
    }));
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
