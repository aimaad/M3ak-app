const MS_PER_DAY = 86_400_000;

export type ExpiryUrgency = 'ok' | 'bientot' | 'expire';

/**
 * null si pas de date d'expiration (rien à signaler) ; sinon le niveau
 * d'urgence selon le nombre de jours restants. Même principe que
 * computeMaintenanceUrgency, réutilisé pour tout document avec date
 * d'expiration (client, conducteur, véhicule).
 */
export function computeExpiryUrgency(
  expiresAt: string | null,
  today: Date = new Date(),
  dueSoonDays = 30
): ExpiryUrgency | null {
  if (!expiresAt) return null;
  const diffDays = (new Date(expiresAt).getTime() - today.getTime()) / MS_PER_DAY;
  if (diffDays < 0) return 'expire';
  if (diffDays <= dueSoonDays) return 'bientot';
  return 'ok';
}
