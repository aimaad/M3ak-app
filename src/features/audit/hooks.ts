import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getActivitySummary, listAuditEntries, type AuditQuery } from './api';
import { auditPeriodStart, type AuditFilters } from './types';

export const AUDIT_PAGE_SIZE = 30;

/** Convertit les filtres de l'écran en requête ; `from` est calculé une fois par rendu de filtre. */
export function toAuditQuery(agencyId: string, filters: AuditFilters, now: Date = new Date()): AuditQuery {
  return { agencyId, from: auditPeriodStart(filters.period, now), actorId: filters.actorId, category: filters.category };
}

export function useAuditEntries(agencyId: string | undefined, filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: ['audit-entries', agencyId, filters],
    enabled: !!agencyId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listAuditEntries(toAuditQuery(agencyId as string, filters), pageParam, AUDIT_PAGE_SIZE),
    getNextPageParam: (lastPage, pages) => (lastPage.length === AUDIT_PAGE_SIZE ? pages.length * AUDIT_PAGE_SIZE : undefined),
  });
}

export function useActivitySummary(agencyId: string | undefined, filters: AuditFilters) {
  return useQuery({
    queryKey: ['audit-summary', agencyId, filters.period],
    enabled: !!agencyId,
    queryFn: () => getActivitySummary(agencyId as string, auditPeriodStart(filters.period)),
  });
}
