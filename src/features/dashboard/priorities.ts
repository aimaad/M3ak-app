/**
 * Priorités de l'accueil : seulement ce qui est ANORMAL aujourd'hui. Ordre de tri fixe (le plus urgent d'abord) :
 * retards > impayés > documents expirés > entretiens en retard > véhicules à l'arrêt. Les impayés (« trésorerie ») ne sont
 * proposés qu'au propriétaire. L'écran n'affiche que les 3 premières ; le compteur donne le total.
 */
export type PriorityKind = 'late' | 'unpaid' | 'documents' | 'maintenance' | 'stopped';

export type Priority = {
  kind: PriorityKind;
  /** Nombre d'éléments concernés (retours, dossiers, documents…). */
  count: number;
  /** Montant en MAD (impayés seulement). */
  amount?: number;
};

export const MAX_PRIORITY_CARDS = 3;

export type PriorityInput = {
  /** Propriétaire : voit la carte « Trésorerie ». */
  showMoney: boolean;
  lateReturns: number;
  unpaid: { count: number; total: number };
  expiredDocuments: number;
  overdueMaintenance: number;
  stoppedVehicles: number;
};

export function buildPriorities(input: PriorityInput): Priority[] {
  const all: Priority[] = [];
  if (input.lateReturns > 0) all.push({ kind: 'late', count: input.lateReturns });
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
