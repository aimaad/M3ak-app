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
  branchId: string | null;
  branchNom: string | null;
};

export type AgencyInvite = {
  id: string;
  agencyId: string;
  code: string;
  role: AgencyRole;
  branchId: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export type MemberProfile = {
  id: string;
  agencyId: string;
  userId: string;
  role: AgencyRole;
  prenom: string | null;
  nom: string | null;
  nomComplet: string | null;
  photoPath: string | null;
  branchId: string | null;
  branchNom: string | null;
  createdAt: string;
};

export type MemberProfileInput = {
  prenom: string;
  nom: string;
};

export type AuditLogEntry = {
  id: string;
  actorName: string | null;
  action: string;
  targetLabel: string | null;
  details: Record<string, unknown> | null;
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
