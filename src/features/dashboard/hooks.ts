import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { AgencyRole } from '@/features/agency/types';
import { useCustomers } from '@/features/customers/hooks';
import { useMaintenanceItems } from '@/features/maintenance/hooks';
import { deviceStorage } from '@/features/ocr/cached-scan';
import { useAllPayments } from '@/features/payments/hooks';
import { useRentals } from '@/features/rentals/hooks';
import { useVehicles } from '@/features/vehicles/hooks';

import { buildInsightsPayload, type AiInsights, type InsightsLanguage } from './insights';
import { fetchInsights } from './insights-api';
import { insightsCacheKey, readInsightsCache, writeInsightsCache } from './insights-cache';
import { computeDashboardMetrics } from './kpis';

const EMPTY: never[] = [];

/** Toutes les données de l'accueil (déjà filtrées par la sécurité du serveur) et les indicateurs calculés. */
export function useDashboardMetrics() {
  const vehicles = useVehicles();
  const rentals = useRentals();
  const payments = useAllPayments();
  const maintenance = useMaintenanceItems();
  const customers = useCustomers();

  const metrics = useMemo(
    () =>
      computeDashboardMetrics({
        vehicles: vehicles.data ?? EMPTY,
        rentals: rentals.data ?? EMPTY,
        payments: payments.data ?? EMPTY,
        maintenance: maintenance.data ?? EMPTY,
        customers: customers.data ?? EMPTY,
      }),
    [vehicles.data, rentals.data, payments.data, maintenance.data, customers.data]
  );

  const queries = [vehicles, rentals, payments, maintenance, customers];
  return {
    metrics,
    vehicles: vehicles.data ?? EMPTY,
    maintenanceItems: maintenance.data ?? EMPTY,
    customers: customers.data ?? EMPTY,
    isLoading: vehicles.isLoading,
    /** Toutes les sources sont chargées : les statistiques sont complètes (utile avant d'appeler l'IA). */
    isComplete: queries.every((q) => q.isSuccess),
    isRefreshing: queries.some((q) => q.isFetching),
    refetchAll: () => queries.forEach((q) => q.refetch()),
  };
}

const REFRESH_COOLDOWN_MS = 2 * 60 * 1000;

/**
 * Recommandations IA : lues du cache de l'appareil (6 h) si possible, sinon demandées au serveur. « Actualiser » force une
 * nouvelle analyse, au plus une toutes les 2 minutes (le serveur limite aussi à 20 par jour et par entreprise).
 */
export function useAiInsights(options: {
  enabled: boolean;
  agencyId: string | undefined;
  role: AgencyRole | null | undefined;
  language: InsightsLanguage;
  metrics: ReturnType<typeof computeDashboardMetrics>;
}) {
  const { enabled, agencyId, role, language, metrics } = options;
  const queryClient = useQueryClient();
  const [forceNonce, setForceNonce] = useState(0);
  const lastForced = useRef(0);

  const key = agencyId && role ? insightsCacheKey(agencyId, role, language) : null;
  const query = useQuery({
    queryKey: ['ai-insights', key, forceNonce],
    enabled: enabled && !!key && !!role,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<{ insights: AiInsights; at: number }> => {
      const storage = deviceStorage();
      if (storage && key && forceNonce === 0) {
        const cached = await readInsightsCache(storage, key);
        if (cached) return cached;
      }
      const insights = await fetchInsights(buildInsightsPayload(role as AgencyRole, metrics), language);
      const at = Date.now();
      if (storage && key) await writeInsightsCache(storage, key, insights, at);
      return { insights, at };
    },
  });

  const refresh = useCallback((): boolean => {
    if (Date.now() - lastForced.current < REFRESH_COOLDOWN_MS) return false;
    lastForced.current = Date.now();
    queryClient.removeQueries({ queryKey: ['ai-insights', key] });
    setForceNonce((n) => n + 1);
    return true;
  }, [key, queryClient]);

  return { ...query, refresh };
}
