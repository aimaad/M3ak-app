/** Kilomètres parcourus pendant la location ; null tant qu'un des deux relevés manque ou s'ils sont incohérents. */
export function kmDriven(kmDepart: number | null | undefined, kmRetour: number | null | undefined): number | null {
  if (kmDepart == null || kmRetour == null || kmRetour < kmDepart) return null;
  return kmRetour - kmDepart;
}

/** Retard lisible : « 3 h 20 », « 2 j 4 h » ; null s'il n'y a pas de retard. */
export function formatDelay(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = Math.round(minutes % 60);
  if (days > 0) return hours > 0 ? `${days} j ${hours} h` : `${days} j`;
  if (hours > 0) return rest > 0 ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
  return `${rest} min`;
}

/** Ce qu'il reste à payer (jamais négatif) ; null si le prix total n'est pas connu. */
export function balanceDue(prixTotal: number | null | undefined, paid: number): number | null {
  return prixTotal == null ? null : Math.max(0, prixTotal - paid);
}
