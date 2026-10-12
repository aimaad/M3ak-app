import type { Vehicle, VehicleCategory } from './types';

/**
 * Suggestion de tarif journalier basée sur les véhicules déjà enregistrés
 * dans l'agence pour la même catégorie (médiane, robuste aux valeurs
 * extrêmes). Ne propose jamais un prix s'il n'y a aucune référence — la
 * saisie reste alors obligatoire et vide.
 */
export function suggestDailyPrice(vehicles: Vehicle[], categorie: VehicleCategory | null): number | null {
  if (!categorie) return null;

  const prices = vehicles
    .filter((v) => v.categorie === categorie && !v.archivedAt && v.prixJour > 0)
    .map((v) => v.prixJour)
    .sort((a, b) => a - b);

  if (prices.length === 0) return null;

  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0 ? (prices[mid - 1]! + prices[mid]!) / 2 : prices[mid]!;
  return Math.round(median);
}
