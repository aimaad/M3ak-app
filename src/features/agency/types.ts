import type { StampConfig } from './stamp';

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
  email: string;
  prenom: string | null;
  nom: string | null;
  role: AgencyRole;
  branchId: string | null;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type CreateInviteInput = {
  agencyId: string;
  email: string;
  prenom: string;
  nom: string;
  role: AgencyRole;
  branchId: string | null;
};

/** Résultat d'une création / d'un renvoi : le code n'est connu que maintenant (jamais relisible ensuite). */
export type InviteResult = {
  inviteId: string;
  code: string;
  email: string;
  prenom: string;
  nom: string;
  role: AgencyRole;
  agencyName: string;
  branchName: string | null;
  inviterName: string | null;
  expiresAt: string;
  emailSent: boolean;
  emailError: string | null;
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
  /** Signature manuscrite enregistrée par le membre (null tant qu'il n'en a pas ajouté). */
  signaturePath: string | null;
  branchId: string | null;
  branchNom: string | null;
  createdAt: string;
};

export type MemberProfileInput = {
  prenom: string;
  nom: string;
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
  /** Cachet de l'agence apposé sur les contrats (chemin dans le bucket privé). */
  stampPath: string | null;
  /** Cachet généré par M3ak (vrai tampon dessiné) ; exclusif avec la photo de cachet. */
  stampConfig: StampConfig | null;
  /** Analyse automatique des permis par un fournisseur d'IA externe : désactivée par défaut, réservée au propriétaire. */
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
