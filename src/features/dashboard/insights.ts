import type { AgencyRole } from '@/features/agency/types';

import type { DashboardMetrics } from './kpis';

/**
 * Recommandations IA : ce qui part vers le serveur, et comment on lit la réponse.
 * Seules des STATISTIQUES AGRÉGÉES sont envoyées (compteurs, totaux, quelques libellés « marque modèle ») :
 * jamais de nom de client, de téléphone, de CIN, d'immatriculation ni de photo. Un responsable n'envoie aucun
 * chiffre d'argent. Le serveur reconstruit lui-même les données à partir d'une liste blanche.
 */
export type InsightsLanguage = 'fr' | 'ar';

export type InsightsPayload = {
  fleet: { total: number; available: number; occupancyMonthPct: number };
  vehicles: { label: string; occupancyPct: number; revenue?: number; maintenanceCost?: number }[];
  rentals: {
    active: number;
    lateReturns: number;
    pendingConfirmation: number;
    upcoming7Days: number;
    cancellationRatePct: number;
    averageDurationDays: number | null;
  };
  maintenance: { overdue: number; due: number; inProgress: number };
  money?: {
    revenueMonth: number;
    revenuePreviousMonth: number;
    changePct: number | null;
    outstandingTotal: number;
    outstandingCount: number;
    profit30d: number;
    maintenanceCostMonth: number;
    averageBasket: number | null;
    revenueTrend: number[];
  };
};

export function buildInsightsPayload(role: AgencyRole, metrics: DashboardMetrics): InsightsPayload {
  const owner = role === 'owner';
  const payload: InsightsPayload = {
    fleet: { total: metrics.fleetTotal, available: metrics.availableNow, occupancyMonthPct: metrics.occupancyMonthPct },
    vehicles: metrics.performance30d.slice(0, 8).map((p) => ({
      label: p.label,
      occupancyPct: p.occupancyPct,
      ...(owner ? { revenue: p.revenue, maintenanceCost: p.maintenanceCost } : {}),
    })),
    rentals: {
      active: metrics.activity.active,
      lateReturns: metrics.activity.lateReturns,
      pendingConfirmation: metrics.activity.pendingConfirmation,
      upcoming7Days: metrics.activity.upcoming7Days,
      cancellationRatePct: metrics.activity.cancellationRatePct,
      averageDurationDays: metrics.activity.averageDurationDays,
    },
    maintenance: { overdue: metrics.maintenance.overdue, due: metrics.maintenance.due, inProgress: metrics.maintenance.inProgress },
  };
  if (owner) {
    payload.money = {
      revenueMonth: metrics.revenue.current,
      revenuePreviousMonth: metrics.revenue.previous,
      changePct: metrics.revenue.changePct,
      outstandingTotal: metrics.outstanding.total,
      outstandingCount: metrics.outstanding.count,
      profit30d: metrics.profit30d,
      maintenanceCostMonth: metrics.maintenance.costThisMonth,
      averageBasket: metrics.activity.averageBasket,
      revenueTrend: metrics.revenueTrend.map((p) => p.total),
    };
  }
  return payload;
}

// ---------------------------------------------------------------- réponse

export type InsightIndicator = { label: string; value: string; trend: 'up' | 'down' | 'flat'; explanation: string | null };
export type InsightRecommendation = {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  area: 'revenue' | 'fleet' | 'maintenance' | 'operations' | 'customers';
};
export type AiInsights = { summary: string | null; indicators: InsightIndicator[]; recommendations: InsightRecommendation[] };

const TRENDS = ['up', 'down', 'flat'] as const;
const PRIORITIES = ['high', 'medium', 'low'] as const;
const AREAS = ['revenue', 'fleet', 'maintenance', 'operations', 'customers'] as const;
const oneOf = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  (allowed as readonly string[]).includes(value as string) ? (value as T) : fallback;
const clean = (value: unknown, max: number): string | null =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) || null : null;

/** Défense en profondeur : la réponse du serveur est relue et bornée avant affichage. Renvoie null si inutilisable. */
export function parseInsights(raw: unknown): AiInsights | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

  const indicators = asList(source.indicators)
    .slice(0, 4)
    .flatMap((item): InsightIndicator[] => {
      const i = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      const label = clean(i.label, 60);
      const value = clean(i.value, 40);
      return label && value ? [{ label, value, trend: oneOf(TRENDS, i.trend, 'flat'), explanation: clean(i.explanation, 200) }] : [];
    });
  const recommendations = asList(source.recommendations)
    .slice(0, 5)
    .flatMap((item): InsightRecommendation[] => {
      const r = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      const title = clean(r.title, 80);
      const detail = clean(r.detail, 300);
      return title && detail
        ? [{ title, detail, priority: oneOf(PRIORITIES, r.priority, 'medium'), area: oneOf(AREAS, r.area, 'operations') }]
        : [];
    });
  const summary = clean(source.summary, 500);
  return summary || indicators.length || recommendations.length ? { summary, indicators, recommendations } : null;
}
