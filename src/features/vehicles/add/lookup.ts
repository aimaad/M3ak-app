import type { Rental } from '@/features/rentals/types';

import { plateKey, vinKey } from './plate';
import type { Vehicle } from '../types';

export type ExistingVehicle = { field: 'immatriculation' | 'vin'; vehicle: Vehicle; archived: boolean };

/**
 * Cherche dans les véhicules connus (archivés compris) celui qui a la même plaque ou le même VIN. La plaque l'emporte sur le VIN.
 * `ignoreId` : on ne se compare pas à soi-même.
 */
export function findExistingVehicle(vehicles: Vehicle[], candidate: { plate?: string | null; vin?: string | null }, ignoreId?: string): ExistingVehicle | null {
  const plate = candidate.plate ? plateKey(candidate.plate) : '';
  const vin = candidate.vin ? vinKey(candidate.vin) : '';
  const others = vehicles.filter((vehicle) => vehicle.id !== ignoreId);
  if (plate) {
    const byPlate = others.find((vehicle) => plateKey(vehicle.immatriculation) === plate);
    if (byPlate) return { field: 'immatriculation', vehicle: byPlate, archived: !!byPlate.archivedAt };
  }
  if (vin.length >= 5) {
    const byVin = others.find((vehicle) => vehicle.vin && vinKey(vehicle.vin) === vin);
    if (byVin) return { field: 'vin', vehicle: byVin, archived: !!byVin.archivedAt };
  }
  return null;
}

/** Nombre de locations d'un véhicule : toutes, annulées exclues. */
export function rentalCount(rentals: Pick<Rental, 'vehicleId' | 'statut'>[], vehicleId: string): number {
  return rentals.filter((rental) => rental.vehicleId === vehicleId && rental.statut !== 'annulee').length;
}

/** Plaques qui seraient en double une fois normalisées (pour le nettoyage manuel des données existantes). */
export function duplicatePlateGroups(vehicles: Pick<Vehicle, 'id' | 'immatriculation'>[]): { key: string; vehicleIds: string[]; plates: string[] }[] {
  const groups = new Map<string, { vehicleIds: string[]; plates: string[] }>();
  for (const vehicle of vehicles) {
    const key = plateKey(vehicle.immatriculation);
    if (!key) continue;
    const group = groups.get(key) ?? { vehicleIds: [], plates: [] };
    group.vehicleIds.push(vehicle.id);
    group.plates.push(vehicle.immatriculation);
    groups.set(key, group);
  }
  return [...groups].filter(([, group]) => group.vehicleIds.length > 1).map(([key, group]) => ({ key, ...group }));
}
