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

export type AuditPeriod = 'today' | '7d' | '30d' | 'all';
export const AUDIT_PERIODS: AuditPeriod[] = ['today', '7d', '30d', 'all'];

export type AuditFilters = {
  period: AuditPeriod;
  /** Identifiant de l'employé, ou null pour tous. */
  actorId: string | null;
  category: AuditCategory | null;
};

/** Début (inclus) de la période choisie, en ISO ; null = depuis le début. */
export function auditPeriodStart(period: AuditPeriod, now: Date = new Date()): string | null {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return startOfToday.toISOString();
  if (period === '7d') return new Date(startOfToday.getTime() - 6 * 86_400_000).toISOString();
  if (period === '30d') return new Date(startOfToday.getTime() - 29 * 86_400_000).toISOString();
  return null;
}
