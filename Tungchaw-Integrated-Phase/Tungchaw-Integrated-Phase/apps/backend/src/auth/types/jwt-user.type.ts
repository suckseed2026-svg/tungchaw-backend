import type { UserStatus } from '../../generated/prisma/enums';

export interface JwtUser {
  id: string;
  email: string;
  status: UserStatus;
}
