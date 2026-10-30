import type { AgencyRole } from '@/features/agency/types';

export const AUDIT_CATEGORIES = ['rental', 'payment', 'customer', 'vehicle', 'contract', 'deposit', 'maintenance', 'inspection', 'team', 'settings'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export type AuditEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: AgencyRole | null;
  category: string | null;
  action: string;
  targetLabel: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type ActivitySummaryRow = {
  actorId: string | null;
  actorName: string;
  actorRole: AgencyRole | null;
  total: number;
  lastAt: string | null;
  categories: Record<string, number>;
};

/** Jour, mois ou année civils, ou tout l'historique. */
export type AuditGranularity = 'day' | 'month' | 'year' | 'custom' | 'all';
export const AUDIT_GRANULARITIES: AuditGranularity[] = ['day', 'month', 'year', 'custom', 'all'];

export type AuditFilters = {
  granularity: AuditGranularity;
  /** 0 = jour / mois / année en cours, -1 = le précédent, etc. Jamais positif. */
  offset: number;
  /** Dates choisies à la main (JJ/MM/AAAA), utilisées seulement en mode « custom ». */
  customFrom: string;
  customTo: string;
  /** Identifiant de l'employé, ou null pour tous. */
  actorId: string | null;
  category: AuditCategory | null;
};

export type AuditRange = { from: string | null; to: string | null; start: Date | null };

/** « 17/10/2026 » (ou 17-10-2026, 17.10.2026) → date locale à minuit ; null si invalide ou inexistante. */
export function parseFrDate(text: string): Date | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** Faux tant que les dates saisies à la main sont incomplètes, inexistantes ou inversées. */
export function isAuditRangeValid(filters: Pick<AuditFilters, 'granularity' | 'customFrom' | 'customTo'>): boolean {
  return filters.granularity !== 'custom' || auditRange({ ...filters, offset: 0 }).from !== null;
}

/** Bornes [from, to[ en ISO de la période choisie (calendrier local) ; null = sans borne. */
export function auditRange(filters: Pick<AuditFilters, 'granularity' | 'offset'> & Partial<Pick<AuditFilters, 'customFrom' | 'customTo'>>, now: Date = new Date()): AuditRange {
  const offset = Math.min(0, Math.trunc(filters.offset));
  let start: Date;
  let end: Date;
  if (filters.granularity === 'day') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset + 1);
  } else if (filters.granularity === 'month') {
    start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  } else if (filters.granularity === 'year') {
    start = new Date(now.getFullYear() + offset, 0, 1);
    end = new Date(now.getFullYear() + offset + 1, 0, 1);
  } else if (filters.granularity === 'custom') {
    const a = parseFrDate(filters.customFrom ?? '');
    const b = parseFrDate(filters.customTo ?? '');
    if (!a || !b || a > b) return { from: null, to: null, start: null };
    start = a;
    end = new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1);
  } else {
    return { from: null, to: null, start: null };
  }
  return { from: start.toISOString(), to: end.toISOString(), start };
}

/** Libellé lisible de la période choisie : « 17 oct. 2026 », « octobre 2026 », « 2026 ». Null pour tout l'historique. */
export function auditRangeLabel(filters: Pick<AuditFilters, 'granularity' | 'offset'> & Partial<Pick<AuditFilters, 'customFrom' | 'customTo'>>, locale: string, now: Date = new Date()): string | null {
  const { start } = auditRange(filters, now);
  if (!start) return null;
  if (filters.granularity === 'custom') {
    const to = parseFrDate(filters.customTo ?? '') as Date;
    const fmt = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(start)} → ${fmt(to)}`;
  }
  if (filters.granularity === 'day') return start.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  if (filters.granularity === 'month') return start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return String(start.getFullYear());
}
