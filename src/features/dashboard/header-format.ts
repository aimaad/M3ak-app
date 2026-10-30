/** Prénom à afficher dans l'en-tête : le prénom du profil, sinon le premier mot du nom complet. */
export function headerFirstName(
  prenom: string | null | undefined,
  nomComplet: string | null | undefined
): string {
  const fromProfile = prenom?.trim();
  if (fromProfile) return fromProfile;
  return nomComplet?.trim().split(/\s+/)[0] ?? '';
}

/** Date du jour en toutes lettres (« jeudi 30 octobre »), avec une majuscule initiale. */
export function formatHeaderDate(date: Date, language: string): string {
  const locale = language === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-FR';
  const text = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** Nombre affiché dans la pastille de notifications : « 99+ » au-delà de 99, rien à zéro. */
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}
