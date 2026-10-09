import { VEHICLE_STATUSES, type Vehicle, type VehicleStatus } from './types';

export type StatusFilter = 'tous' | VehicleStatus;

export const STATUS_FILTERS: StatusFilter[] = ['tous', ...VEHICLE_STATUSES];

/** Statuts qui comptent comme "véhicule immobilisé" (indisponible à la location). */
const IMMOBILIZED_STATUSES: VehicleStatus[] = ['maintenance', 'a_inspecter', 'en_preparation', 'indisponible'];

export type VehicleFilters = {
  statusFilter: StatusFilter;
  query: string;
  categorie: Vehicle['categorie'] | 'toutes';
  marque: string | 'toutes';
  includeArchived: boolean;
};

export const DEFAULT_VEHICLE_FILTERS: VehicleFilters = {
  statusFilter: 'tous',
  query: '',
  categorie: 'toutes',
  marque: 'toutes',
  includeArchived: false,
};

export function filterVehicles(vehicles: Vehicle[], filters: VehicleFilters): Vehicle[] {
  const normalizedQuery = filters.query.trim().toLowerCase();

  return vehicles.filter((vehicle) => {
    if (!filters.includeArchived && vehicle.archivedAt) return false;
    if (filters.includeArchived && !vehicle.archivedAt) return false;
    if (filters.statusFilter !== 'tous' && vehicle.statut !== filters.statusFilter) return false;
    if (filters.categorie !== 'toutes' && vehicle.categorie !== filters.categorie) return false;
    if (filters.marque !== 'toutes' && vehicle.marque !== filters.marque) return false;
    if (!normalizedQuery) return true;
    return (
      vehicle.immatriculation.toLowerCase().includes(normalizedQuery) ||
      vehicle.marque.toLowerCase().includes(normalizedQuery) ||
      vehicle.modele.toLowerCase().includes(normalizedQuery)
    );
  });
}

export type VehicleSort = 'recent' | 'marque' | 'immatriculation' | 'prixJour' | 'kilometrage';

export function sortVehicles(vehicles: Vehicle[], sort: VehicleSort): Vehicle[] {
  const sorted = [...vehicles];
  switch (sort) {
    case 'marque':
      return sorted.sort((a, b) => a.marque.localeCompare(b.marque));
    case 'immatriculation':
      return sorted.sort((a, b) => a.immatriculation.localeCompare(b.immatriculation));
    case 'prixJour':
      return sorted.sort((a, b) => a.prixJour - b.prixJour);
    case 'kilometrage':
      return sorted.sort((a, b) => a.kilometrage - b.kilometrage);
    case 'recent':
    default:
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export function countByStatus(vehicles: Vehicle[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    tous: 0,
    disponible: 0,
    en_location: 0,
    maintenance: 0,
    a_inspecter: 0,
    en_preparation: 0,
    indisponible: 0,
  };

  for (const vehicle of vehicles) {
    if (vehicle.archivedAt) continue;
    counts.tous += 1;
    counts[vehicle.statut] += 1;
  }

  return counts;
}

export function countImmobilized(vehicles: Vehicle[]): number {
  return vehicles.filter((v) => !v.archivedAt && IMMOBILIZED_STATUSES.includes(v.statut)).length;
}

export function countExpiringSoonDocuments(
  vehicles: Vehicle[],
  withinDays = 30,
  now: Date = new Date()
): number {
  const limit = new Date(now);
  limit.setDate(limit.getDate() + withinDays);

  let count = 0;
  for (const vehicle of vehicles) {
    if (vehicle.archivedAt) continue;
    for (const doc of vehicle.documents) {
      if (!doc.expiresAt) continue;
      const expiry = new Date(doc.expiresAt);
      if (expiry.getTime() <= limit.getTime()) count += 1;
    }
  }
  return count;
}

export function uniqueBrands(vehicles: Vehicle[]): string[] {
  return Array.from(new Set(vehicles.map((v) => v.marque))).sort((a, b) => a.localeCompare(b));
}
