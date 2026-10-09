export type AgencyRole = 'owner' | 'manager' | 'employee';

export const INVITABLE_ROLES: AgencyRole[] = ['manager', 'employee'];

export type AgencyMembership = {
  agencyId: string;
  role: AgencyRole;
  memberName: string | null;
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

export type AgencyDetails = {
  id: string;
  nom: string;
  raisonSociale: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string;
  devise: string;
  logoUrl: string | null;
  createdAt: string;
};

export type AgencyDetailsInput = {
  nom: string;
  raisonSociale: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string;
  devise: string;
};
