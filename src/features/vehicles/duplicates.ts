import type { Vehicle } from './types';

export type VehicleDuplicate = { field: 'immatriculation' | 'vin'; vehicle: Vehicle };

/** Compare les plaques sans tenir compte des espaces, barres, tirets ni de la casse : « 8921 | ب | 14 » = « 8921-ب-14 ». */
export function normalizePlate(raw: string): string {
  return raw.replace(/[\s|/\-._]+/g, '').toUpperCase();
}

export function normalizeVin(raw: string): string {
  return raw.replace(/[\s\-]+/g, '').toUpperCase();
}

/**
 * Cherche dans les véhicules déjà connus (archivés compris) celui qui a la même plaque ou le même numéro de
 * série. La plaque l'emporte sur le VIN. `ignoreId` sert au formulaire de modification (on ne se compare pas à soi).
 */
export function findDuplicateInList(
  vehicles: Vehicle[],
  candidate: { immatriculation: string; vin?: string | null },
  ignoreId?: string
): VehicleDuplicate | null {
  const plate = normalizePlate(candidate.immatriculation);
  const vin = candidate.vin ? normalizeVin(candidate.vin) : '';

  if (plate) {
    const byPlate = vehicles.find((v) => v.id !== ignoreId && normalizePlate(v.immatriculation) === plate);
    if (byPlate) return { field: 'immatriculation', vehicle: byPlate };
  }
  if (vin.length >= 5) {
    const byVin = vehicles.find((v) => v.id !== ignoreId && v.vin && normalizeVin(v.vin) === vin);
    if (byVin) return { field: 'vin', vehicle: byVin };
  }
  return null;
}
