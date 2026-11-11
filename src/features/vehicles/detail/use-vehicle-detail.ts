import { useMemo } from 'react';

import { useMyAgency } from '@/features/agency/hooks';
import { useCustomers } from '@/features/customers/hooks';
import { useVehicleMaintenanceItems } from '@/features/maintenance/hooks';
import { useVehicleRentals } from '@/features/rentals/hooks';
import type { Customer } from '@/features/customers/types';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';

import { contextOf } from '../fleet-card';
import { buildFleetItems } from '../fleet-model';
import { useVehicle } from '../hooks';

const NO_RENTALS: Rental[] = [];
const NO_MAINTENANCE: MaintenanceItem[] = [];
const NO_CUSTOMERS: Customer[] = [];

/**
 * Toutes les données de la fiche : UNE requête par source (véhicule, ses locations, ses entretiens, les clients, le rôle), puis les calculs
 * mémoïsés (statut du jour, frise, contexte, retard) avec les mêmes fonctions que Ma Flotte. « Maintenant » est unique pour toute la fiche.
 */
export function useVehicleDetail(id: string | undefined) {
  const vehicleQuery = useVehicle(id);
  const rentalsQuery = useVehicleRentals(id);
  const maintenanceQuery = useVehicleMaintenanceItems(id);
  const customersQuery = useCustomers();
  const agencyQuery = useMyAgency();

  const vehicle = vehicleQuery.data;
  const rentals = rentalsQuery.data ?? NO_RENTALS;
  const maintenance = maintenanceQuery.data ?? NO_MAINTENANCE;
  const customerList = customersQuery.data ?? NO_CUSTOMERS;
  const role = agencyQuery.data?.role;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- une nouvelle heure à chaque nouvelle donnée
  const now = useMemo(() => new Date(), [vehicle, rentals, maintenance]);
  const customers = useMemo(() => new Map(customerList.map((customer) => [customer.id, customer])), [customerList]);
  // Un véhicule archivé n'est plus dans la flotte affichée : pas de statut du jour (la fiche montre « Archivé »).
  const item = useMemo(() => (vehicle && !vehicle.archivedAt ? (buildFleetItems({ vehicles: [vehicle], rentals, maintenance, now })[0] ?? null) : null), [vehicle, rentals, maintenance, now]);
  const context = useMemo(
    () => (item ? contextOf(item, { customers, rentals: new Map(rentals.map((rental) => [rental.id, rental])), maintenance }) : null),
    [item, customers, rentals, maintenance]
  );

  return {
    vehicle,
    rentals,
    maintenance,
    customers,
    role,
    isOwner: role === 'owner',
    isManager: role === 'owner' || role === 'manager',
    item,
    context,
    now,
    isLoading: vehicleQuery.isLoading,
    isError: vehicleQuery.isError,
    refetch: () => {
      void vehicleQuery.refetch();
      void rentalsQuery.refetch();
      void maintenanceQuery.refetch();
    },
  };
}
