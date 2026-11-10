import { VEHICLE_STATUSES, type FuelType, type Vehicle, type VehicleStatus, type VehicleTransmission } from './types';

export type StatusFilter = 'tous' | VehicleStatus;

export const STATUS_FILTERS: StatusFilter[] = ['tous', ...VEHICLE_STATUSES];

/** Statuts qui comptent comme "véhicule immobilisé" (indisponible à la location). */
const IMMOBILIZED_STATUSES: VehicleStatus[] = ['maintenance', 'a_inspecter', 'en_preparation', 'indisponible'];

export type VehicleFilters = {
  statusFilter: StatusFilter;
  query: string;
  categorie: Vehicle['categorie'] | 'toutes';
  marque: string | 'toutes';
  carburant: FuelType | 'tous';
  transmission: VehicleTransmission | 'toutes';
  includeArchived: boolean;
};

export const DEFAULT_VEHICLE_FILTERS: VehicleFilters = {
  statusFilter: 'tous',
  query: '',
  categorie: 'toutes',
  marque: 'toutes',
  carburant: 'tous',
  transmission: 'toutes',
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
    if (filters.carburant !== 'tous' && vehicle.carburant !== filters.carburant) return false;
    if (filters.transmission !== 'toutes' && vehicle.transmission !== filters.transmission) return false;
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

/**
 * Tri de la liste de Ma Flotte : « statut » (par défaut) groupe par statut puis range par nom ; les autres rangent dans chaque section.
 * Le tri par prix n'est proposé qu'au propriétaire (l'ordre des prix est lui aussi un montant).
 */
export type FleetSort = 'statut' | 'nom' | 'prix' | 'km' | 'recent';
export const FLEET_SORTS: FleetSort[] = ['statut', 'nom', 'prix', 'km', 'recent'];
export const DEFAULT_FLEET_SORT: FleetSort = 'statut';

export function availableSorts(canSeePrices: boolean): FleetSort[] {
  return canSeePrices ? FLEET_SORTS : FLEET_SORTS.filter((sort) => sort !== 'prix');
}

const byName = (a: Vehicle, b: Vehicle) => `${a.marque} ${a.modele}`.localeCompare(`${b.marque} ${b.modele}`) || a.immatriculation.localeCompare(b.immatriculation);

/** Range des véhicules selon le tri choisi (« statut » range par nom : le regroupement par statut est fait par la page). */
export function sortFleet(vehicles: Vehicle[], sort: FleetSort): Vehicle[] {
  const sorted = [...vehicles];
  switch (sort) {
    case 'prix':
      return sorted.sort((a, b) => a.prixJour - b.prixJour || byName(a, b));
    case 'km':
      return sorted.sort((a, b) => a.kilometrage - b.kilometrage || byName(a, b));
    case 'recent':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || byName(a, b));
    case 'nom':
    case 'statut':
    default:
      return sorted.sort(byName);
  }
}

/** Valeurs qui existent vraiment dans la flotte : la feuille ne propose que des filtres qui peuvent donner un résultat. */
export function filterOptions(vehicles: Vehicle[]): { categories: NonNullable<Vehicle['categorie']>[]; brands: string[]; fuels: FuelType[]; transmissions: VehicleTransmission[] } {
  const active = vehicles.filter((v) => !v.archivedAt);
  const unique = <T,>(values: (T | null | undefined)[]): T[] => Array.from(new Set(values.filter((value): value is T => value !== null && value !== undefined)));
  return {
    categories: unique(active.map((v) => v.categorie)).sort((a, b) => a.localeCompare(b)),
    brands: uniqueBrands(active),
    fuels: unique(active.map((v) => v.carburant)).sort((a, b) => a.localeCompare(b)),
    transmissions: unique(active.map((v) => v.transmission)).sort((a, b) => a.localeCompare(b)),
  };
}

/** Nombre de filtres actifs (pastille sur le bouton Filtres et tri) : catégorie, marque, carburant, boîte, archivés. */
export function activeFilterCount(filters: VehicleFilters): number {
  return [filters.categorie !== 'toutes', filters.marque !== 'toutes', filters.carburant !== 'tous', filters.transmission !== 'toutes', filters.includeArchived].filter(Boolean).length;
}
