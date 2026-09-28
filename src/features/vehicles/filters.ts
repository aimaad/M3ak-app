import { VEHICLE_STATUSES, type Vehicle, type VehicleStatus } from './types';

export type StatusFilter = 'tous' | VehicleStatus;

export const STATUS_FILTERS: StatusFilter[] = ['tous', ...VEHICLE_STATUSES];

export function filterVehicles(
  vehicles: Vehicle[],
  statusFilter: StatusFilter,
  query: string
): Vehicle[] {
  const normalizedQuery = query.trim().toLowerCase();

  return vehicles.filter((vehicle) => {
    if (statusFilter !== 'tous' && vehicle.statut !== statusFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      vehicle.immatriculation.toLowerCase().includes(normalizedQuery) ||
      vehicle.marque.toLowerCase().includes(normalizedQuery) ||
      vehicle.modele.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function countByStatus(vehicles: Vehicle[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    tous: vehicles.length,
    disponible: 0,
    en_location: 0,
    maintenance: 0,
    a_inspecter: 0,
  };

  for (const vehicle of vehicles) {
    counts[vehicle.statut] += 1;
  }

  return counts;
}
