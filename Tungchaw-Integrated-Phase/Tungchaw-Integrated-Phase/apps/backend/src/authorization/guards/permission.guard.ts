import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { PermissionCode } from '../constants/permission-codes';
import type { BusinessContextRequest } from '../../business-context/types/business-context-request.type';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionCode[]
    >(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    /*
     * Routes without @RequirePermissions() are not restricted by this guard.
     */
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<BusinessContextRequest>();

    const businessContext = request.businessContext;

    if (!businessContext) {
      throw new InternalServerErrorException(
        'Business context must be validated before permissions are checked',
      );
    }

    /*
     * The business owner always has complete administrative access.
     * This also allows the first owner to configure roles and permissions.
     */
    if (businessContext.membership.isOwner) {
      return true;
    }

    const membership = await this.prisma.businessMember.findUnique({
      where: {
        id: businessContext.membership.id,
      },
      select: {
        id: true,
        businessId: true,
        status: true,
        roleAssignments: {
          where: {
            role: {
              businessId: businessContext.business.id,
              isActive: true,
            },
          },
          select: {
            role: {
              select: {
                permissions: {
                  where: {
                    permission: {
                      isActive: true,
                    },
                  },
                  select: {
                    permission: {
                      select: {
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !membership ||
      membership.status !== MembershipStatus.ACTIVE ||
      membership.businessId !== businessContext.business.id
    ) {
      throw new ForbiddenException(
        'You do not have active access to this business',
      );
    }

    const grantedPermissions = new Set(
      membership.roleAssignments.flatMap((roleAssignment) =>
        roleAssignment.role.permissions.map(
          (rolePermission) => rolePermission.permission.code,
        ),
      ),
    );

    const missingPermissions = requiredPermissions.filter(
      (permission) => !grantedPermissions.has(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Missing required permission${
          missingPermissions.length > 1 ? 's' : ''
        }: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
