import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '../constants/permission-codes';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

export const RequirePermissions = (
  ...permissions: PermissionCode[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
