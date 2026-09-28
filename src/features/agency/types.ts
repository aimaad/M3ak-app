export type AgencyRole = 'owner' | 'manager' | 'employee';

export type AgencyMembership = {
  agencyId: string;
  role: AgencyRole;
  agencyName: string;
  agencyCity: string | null;
};
