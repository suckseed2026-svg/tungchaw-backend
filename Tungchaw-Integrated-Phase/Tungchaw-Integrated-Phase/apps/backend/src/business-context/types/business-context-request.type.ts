import type { JwtUser } from '../../auth/types/jwt-user.type';
import type { BusinessContextData } from './business-context.type';

export interface BusinessContextRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: JwtUser;
  businessContext?: BusinessContextData;
}
