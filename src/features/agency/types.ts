export type AgencyRole = 'owner' | 'manager' | 'employee';

export const INVITABLE_ROLES: AgencyRole[] = ['manager', 'employee'];

export type AgencyMembership = {
  agencyId: string;
  role: AgencyRole;
  agencyName: string;
  agencyCity: string | null;
};

export type AgencyMember = {
  id: string;
  userId: string;
  role: AgencyRole;
  nomComplet: string | null;
};

export type AgencyInvite = {
  id: string;
  agencyId: string;
  code: string;
  role: AgencyRole;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};
