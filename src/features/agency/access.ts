/** État d'accès d'une agence (essai limité dans le temps ou suspension), renvoyé par `my_agency_access()`. */
export type AgencyAccess = {
  agencyId: string;
  /** Fin de l'accès (ISO) ; null = illimité. */
  accessUntil: string | null;
  suspended: boolean;
  hasAccess: boolean;
};

type AccessPayload = {
  agency_id?: unknown;
  access_until?: unknown;
  suspended?: unknown;
  has_access?: unknown;
};

/** Convertit la réponse JSON du serveur ; null si l'utilisateur n'a pas d'agence. */
export function parseAgencyAccess(payload: unknown): AgencyAccess | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as AccessPayload;
  if (typeof p.agency_id !== 'string') return null;
  return {
    agencyId: p.agency_id,
    accessUntil: typeof p.access_until === 'string' ? p.access_until : null,
    suspended: p.suspended === true,
    hasAccess: p.has_access === true,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Jours restants (arrondis au supérieur, minimum 0) ; null si l'accès est illimité. */
export function daysLeft(accessUntil: string | null, now: Date = new Date()): number | null {
  if (!accessUntil) return null;
  const end = new Date(accessUntil).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS));
}

/** Faut-il afficher le bandeau d'essai ? Oui dès qu'une échéance existe et que l'accès est encore actif. */
export function shouldShowTrialBanner(access: AgencyAccess | null): boolean {
  return !!access && access.hasAccess && access.accessUntil !== null;
}
