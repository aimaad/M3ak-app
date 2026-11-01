/** Prénom à afficher dans l'en-tête : le prénom du profil, sinon le premier mot du nom complet. */
export function headerFirstName(
  prenom: string | null | undefined,
  nomComplet: string | null | undefined
): string {
  const fromProfile = prenom?.trim();
  if (fromProfile) return fromProfile;
  return nomComplet?.trim().split(/\s+/)[0] ?? '';
}

/** Nombre affiché dans la pastille de notifications : « 99+ » au-delà de 99, rien à zéro. */
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}
