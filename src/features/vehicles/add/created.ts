import type { Vehicle } from '../types';

import type { MissingKey } from './finalize';

/** Véhicule qui vient d'être ajouté, transmis de « Finaliser » à « Véhicule ajouté » (en mémoire, le temps du parcours). */
export type CreatedVehicle = { vehicle: Vehicle; missing: MissingKey[] };

let created: CreatedVehicle | null = null;

export const setCreatedVehicle = (value: CreatedVehicle | null) => {
  created = value;
};
export const getCreatedVehicle = (): CreatedVehicle | null => created;

/** « Louer maintenant » n'est proposé que pour un véhicule disponible dont le prix est fixé. */
export const canRentNow = (vehicle: Pick<Vehicle, 'statut' | 'prixJour'>): boolean => vehicle.statut === 'disponible' && vehicle.prixJour > 0;
