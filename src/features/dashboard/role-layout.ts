import type { AgencyRole } from '@/features/agency/types';

/**
 * Qui voit quoi sur la page d'accueil. Une seule table, facile à relire et à ajuster ; les données elles-mêmes sont
 * protégées côté serveur (RLS) : cette table ne fait que décider de ce qui est AFFICHÉ.
 *  - propriétaire : tout, y compris argent, rentabilité et recommandations financières ;
 *  - responsable : exploitation et performance de la flotte, sans chiffres d'argent de l'entreprise ;
 *  - employé de comptoir : le travail du jour (départs, retours, retards, encaissements à faire).
 */
export type DashboardSection = 'financial' | 'upcoming' | 'fleet' | 'performance' | 'operations' | 'counter' | 'maintenance' | 'alerts' | 'ai';

const LAYOUT: Record<AgencyRole, DashboardSection[]> = {
  owner: ['financial', 'fleet', 'upcoming', 'operations', 'performance', 'maintenance', 'alerts', 'ai'],
  manager: ['fleet', 'upcoming', 'operations', 'performance', 'maintenance', 'alerts', 'ai'],
  employee: ['counter', 'upcoming', 'fleet', 'alerts'],
};

export function dashboardSections(role: AgencyRole | null | undefined): DashboardSection[] {
  return role ? LAYOUT[role] : [];
}

export const canSeeMoney = (role: AgencyRole | null | undefined) => role === 'owner';

/** Les recommandations IA ne sont proposées qu'au propriétaire et au responsable. */
export const canUseAiInsights = (role: AgencyRole | null | undefined) => role === 'owner' || role === 'manager';
