import type {
  BusinessStatus,
  MembershipStatus,
} from '../../generated/prisma/enums';

export interface CurrentBusinessData {
  id: string;
  name: string;
  code: string;
  status: BusinessStatus;
  timezone: string;
  currency: string;
}

export interface CurrentBusinessRole {
  id: string;
  name: string;
  code: string;
  isSystem: boolean;
}

export interface CurrentMembershipData {
  id: string;
  businessId: string;
  userId: string;
  status: MembershipStatus;
  isOwner: boolean;
  joinedAt: Date | null;
  roles: CurrentBusinessRole[];
}

export interface BusinessContextData {
  business: CurrentBusinessData;
  membership: CurrentMembershipData;
}
