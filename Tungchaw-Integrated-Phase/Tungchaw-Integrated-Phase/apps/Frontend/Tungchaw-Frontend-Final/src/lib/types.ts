export type SessionUser = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
};

export type Branch = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

export type Business = {
  id: string;
  name: string;
  code: string;
  status?: string;
  currency?: string;
  timezone?: string;
  industry?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  branches?: Branch[];
};

export type BusinessRole = {
  id: string;
  name: string;
  code: string;
  isSystem?: boolean;
  isActive?: boolean;
};

export type UserBusinessMembership = {
  membershipId: string;
  membershipStatus: string;
  isOwner: boolean;
  joinedAt?: string | null;
  business: Business;
  roles: BusinessRole[];
};

export type ApiList<T> =
  | { data?: T[]; items?: T[]; total?: number; page?: number; limit?: number }
  | T[];

export type ResourceRow = Record<string, unknown> & { id: string };
export type NavItem = {
  label: string;
  path: string;
  icon: string;
  group: string;
  permission?: string;
};

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  business: Business | null;
  branch: Branch | null;
  membership?: UserBusinessMembership | null;
};
