/**
 * Priorités de l'accueil : seulement ce qui est ANORMAL aujourd'hui. Ordre de tri fixe (le plus urgent d'abord) :
 * retards et conflits (même rang) > impayés > documents expirés > entretiens en retard > véhicules à l'arrêt. Les impayés (« trésorerie ») ne sont
 * proposés qu'au propriétaire. L'écran n'affiche que les 3 premières ; le compteur donne le total.
 */
export type PriorityKind = 'late' | 'conflict' | 'unpaid' | 'documents' | 'maintenance' | 'stopped';

export type Priority = {
  kind: PriorityKind;
  /** Nombre d'éléments concernés (retours, dossiers, documents…). */
  count: number;
  /** Montant en MAD (impayés seulement). */
  amount?: number;
  /** Conflit : la réservation menacée la plus proche (ouverte par la carte). */
  rentalId?: string;
};

export const MAX_PRIORITY_CARDS = 3;

export type PriorityInput = {
  /** Propriétaire : voit la carte « Trésorerie ». */
  showMoney: boolean;
  lateReturns: number;
  /** Réservations menacées par un retard (voir `conflicts` dans availability.ts). */
  conflicts: { count: number; firstRentalId: string | null };
  unpaid: { count: number; total: number };
  expiredDocuments: number;
  overdueMaintenance: number;
  stoppedVehicles: number;
};

export function buildPriorities(input: PriorityInput): Priority[] {
  const all: Priority[] = [];
  if (input.lateReturns > 0) all.push({ kind: 'late', count: input.lateReturns });
  if (input.conflicts.count > 0)
    all.push({ kind: 'conflict', count: input.conflicts.count, ...(input.conflicts.firstRentalId ? { rentalId: input.conflicts.firstRentalId } : {}) });
  if (input.showMoney && input.unpaid.count > 0)
    all.push({ kind: 'unpaid', count: input.unpaid.count, amount: input.unpaid.total });
  if (input.expiredDocuments > 0) all.push({ kind: 'documents', count: input.expiredDocuments });
  if (input.overdueMaintenance > 0)
    all.push({ kind: 'maintenance', count: input.overdueMaintenance });
  if (input.stoppedVehicles > 0) all.push({ kind: 'stopped', count: input.stoppedVehicles });
  return all;
}

/** Cartes affichées (3 au maximum) ; `total` = nombre de priorités, affiché dans le compteur. */
export function visiblePriorities(priorities: Priority[]): { cards: Priority[]; total: number } {
  return { cards: priorities.slice(0, MAX_PRIORITY_CARDS), total: priorities.length };
}

/** Écran ouvert par chaque priorité (liste des éléments concernés ; un conflit ouvre la réservation menacée). */
export function priorityHref(priority: Priority): string {
  switch (priority.kind) {
    case 'late':
      return '/accueil/retards';
    case 'conflict':
      return priority.rentalId ? `/locations/${priority.rentalId}` : '/accueil/retards';
    case 'unpaid':
      return '/accueil/impayes';
    case 'documents':
      return '/accueil/documents';
    case 'maintenance':
      return '/maintenance';
    case 'stopped':
      return '/accueil/vehicules-a-l-arret';
  }
}
