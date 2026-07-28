import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { BusinessStatus, MembershipStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { BusinessContextRequest } from '../types/business-context-request.type';

@Injectable()
export class BusinessContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BusinessContextRequest>();

    if (!request.user) {
      throw new UnauthorizedException(
        'Authentication is required before selecting a business',
      );
    }

    const businessId = this.extractBusinessId(request.headers['x-business-id']);

    if (!businessId) {
      throw new BadRequestException('X-Business-Id header is required');
    }

    if (!isUUID(businessId, '4')) {
      throw new BadRequestException('X-Business-Id must be a valid UUID');
    }

    const membership = await this.prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: request.user.id,
        },
      },
      select: {
        id: true,
        businessId: true,
        userId: true,
        status: true,
        isOwner: true,
        joinedAt: true,
        business: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            timezone: true,
            currency: true,
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
              },
            },
          },
        },
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        'You do not have active access to this business',
      );
    }

    if (
      membership.business.status === BusinessStatus.SUSPENDED ||
      membership.business.status === BusinessStatus.EXPIRED ||
      membership.business.status === BusinessStatus.CANCELLED
    ) {
      throw new ForbiddenException('This business is currently unavailable');
    }

    request.businessContext = {
      business: {
        id: membership.business.id,
        name: membership.business.name,
        code: membership.business.code,
        status: membership.business.status,
        timezone: membership.business.timezone,
        currency: membership.business.currency,
      },
      membership: {
        id: membership.id,
        businessId: membership.businessId,
        userId: membership.userId,
        status: membership.status,
        isOwner: membership.isOwner,
        joinedAt: membership.joinedAt,
        roles: membership.roleAssignments.map((assignment) => assignment.role),
      },
    };

    return true;
  }

  private extractBusinessId(
    headerValue: string | string[] | undefined,
  ): string | null {
    if (Array.isArray(headerValue)) {
      const firstValue = headerValue[0]?.trim();
      return firstValue || null;
    }

    if (typeof headerValue === 'string') {
      const normalizedValue = headerValue.trim();
      return normalizedValue || null;
    }

    return null;
  }
}
