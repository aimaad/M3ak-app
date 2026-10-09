/**
 * Règles tarifaires explicites pour les frais PROPOSÉS au retour — jamais
 * appliqués automatiquement (voir RetourContractInput.appliquerFrais). Ces
 * valeurs sont volontairement simples et visibles ici plutôt qu'enfouies
 * dans l'UI, pour pouvoir être ajustées sans deviner une vraie politique
 * tarifaire d'agence (qui n'existe pas encore dans le projet).
 */
export const RETARD_TOLERANCE_MINUTES = 15;
export const RETARD_TARIF_PAR_HEURE = 50; // MAD, heure commencée comptée en entier
export const CARBURANT_TARIF_PAR_TRANCHE = 50; // MAD par tranche de 10% manquante
export const CARBURANT_TRANCHE_POURCENT = 10;

export function computeRetardMinutes(dateFinPrevueISO: string, dateRetourReelleISO: string): number {
  const prevue = new Date(dateFinPrevueISO).getTime();
  const reelle = new Date(dateRetourReelleISO).getTime();
  return Math.max(0, Math.round((reelle - prevue) / 60000));
}

export function computeFraisRetard(retardMinutes: number): number {
  if (retardMinutes <= RETARD_TOLERANCE_MINUTES) return 0;
  const heures = Math.ceil(retardMinutes / 60);
  return heures * RETARD_TARIF_PAR_HEURE;
}

/** carburantDepart et carburantRetour sont des pourcentages (0-100). */
export function computeFraisCarburant(carburantDepart: number, carburantRetour: number): number {
  const manquant = Math.max(0, carburantDepart - carburantRetour);
  if (manquant <= 0) return 0;
  const tranches = Math.ceil(manquant / CARBURANT_TRANCHE_POURCENT);
  return tranches * CARBURANT_TARIF_PAR_TRANCHE;
}
