export type MaintenanceUrgency = 'a_venir' | 'due' | 'en_retard';

const URGENCY_RANK: Record<MaintenanceUrgency, number> = { a_venir: 0, due: 1, en_retard: 2 };

const MS_PER_DAY = 86_400_000;

function urgencyFromDate(
  echeanceDate: string | null,
  today: Date,
  dueSoonDays: number
): MaintenanceUrgency | null {
  if (!echeanceDate) return null;
  const diffDays = (new Date(echeanceDate).getTime() - today.getTime()) / MS_PER_DAY;
  if (diffDays < 0) return 'en_retard';
  if (diffDays <= dueSoonDays) return 'due';
  return 'a_venir';
}

function urgencyFromKm(
  echeanceKm: number | null,
  currentKm: number | null,
  dueSoonKm: number
): MaintenanceUrgency | null {
  if (echeanceKm == null || currentKm == null) return null;
  const diff = echeanceKm - currentKm;
  if (diff < 0) return 'en_retard';
  if (diff <= dueSoonKm) return 'due';
  return 'a_venir';
}

/**
 * Urgence calculée dynamiquement (pas celle stockée en base, qui ne bougerait pas
 * toute seule) : la plus pressante entre l'échéance de date et l'échéance de
 * kilométrage, quand les deux sont renseignées.
 */
export function computeMaintenanceUrgency(
  item: { echeanceDate: string | null; echeanceKm: number | null },
  currentKm: number | null,
  today: Date = new Date(),
  options: { dueSoonDays?: number; dueSoonKm?: number } = {}
): MaintenanceUrgency {
  const dueSoonDays = options.dueSoonDays ?? 7;
  const dueSoonKm = options.dueSoonKm ?? 500;

  const candidates = [
    urgencyFromDate(item.echeanceDate, today, dueSoonDays),
    urgencyFromKm(item.echeanceKm, currentKm, dueSoonKm),
  ].filter((urgency): urgency is MaintenanceUrgency => urgency !== null);

  if (candidates.length === 0) return 'a_venir';
  return candidates.reduce((max, urgency) => (URGENCY_RANK[urgency] > URGENCY_RANK[max] ? urgency : max));
}
