import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelRental,
  checkVehicleAvailability,
  confirmRental,
  createRental,
  getRental,
  listRentals,
  listRentalsForCustomer,
  listRentalsForVehicle,
  updateRentalDates,
} from './api';
import { confirmDepartureCheck, getDeparturePolicy, getDepartureCheck, saveDeparturePolicy } from './departure-api';
import type { DeparturePolicy } from './departure-check';
import { listRentalAdditionalDrivers, saveRentalDrivers } from './drivers-api';
import type { RentalDriversSelection } from './rental-drivers';
import type { RentalInput } from './types';

const rentalsKey = ['rentals'] as const;
const rentalKey = (id: string) => ['rentals', id] as const;
const vehicleRentalsKey = (vehicleId: string) => ['rentals', 'vehicle', vehicleId] as const;

export function useRentals() {
  return useQuery({ queryKey: rentalsKey, queryFn: listRentals });
}

export function useRental(id: string | undefined) {
  return useQuery({
    queryKey: rentalKey(id ?? ''),
    queryFn: () => getRental(id as string),
    enabled: !!id,
  });
}

export function useVehicleRentals(vehicleId: string | undefined) {
  return useQuery({
    queryKey: vehicleRentalsKey(vehicleId ?? ''),
    queryFn: () => listRentalsForVehicle(vehicleId as string),
    enabled: !!vehicleId,
  });
}

const customerRentalsKey = (customerId: string) => ['rentals', 'customer', customerId] as const;

export function useCustomerRentals(customerId: string | undefined) {
  return useQuery({
    queryKey: customerRentalsKey(customerId ?? ''),
    queryFn: () => listRentalsForCustomer(customerId as string),
    enabled: !!customerId,
  });
}

function useInvalidateRentals() {
  const queryClient = useQueryClient();
  return (rental: { id: string; vehicleId: string }) => {
    queryClient.invalidateQueries({ queryKey: rentalsKey });
    queryClient.invalidateQueries({ queryKey: rentalKey(rental.id) });
    queryClient.invalidateQueries({ queryKey: vehicleRentalsKey(rental.vehicleId) });
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  };
}

export function useCreateRental() {
  const invalidate = useInvalidateRentals();

  return useMutation({
    mutationFn: ({ agencyId, input }: { agencyId: string; input: RentalInput }) =>
      createRental(agencyId, input),
    onSuccess: (rental) => invalidate(rental),
  });
}

export function useUpdateRentalDates() {
  const invalidate = useInvalidateRentals();

  return useMutation({
    mutationFn: ({
      id,
      dateDebutPrevue,
      dateFinPrevue,
      fraisSupplementaires,
      remiseMontant,
    }: {
      id: string;
      vehicleId: string;
      dateDebutPrevue: string;
      dateFinPrevue: string;
      fraisSupplementaires: number;
      remiseMontant: number;
    }) => updateRentalDates(id, dateDebutPrevue, dateFinPrevue, fraisSupplementaires, remiseMontant),
    onSuccess: (rental) => invalidate(rental),
  });
}

export function useConfirmRental() {
  const invalidate = useInvalidateRentals();

  return useMutation({
    mutationFn: (id: string) => confirmRental(id),
    onSuccess: (rental) => invalidate(rental),
  });
}

export function useCancelRental() {
  const invalidate = useInvalidateRentals();

  return useMutation({
    mutationFn: (id: string) => cancelRental(id),
    onSuccess: (rental) => invalidate(rental),
  });
}

export function useCheckAvailability(
  vehicleId: string | undefined,
  startISO: string | null,
  endISO: string | null,
  excludeRentalId?: string
) {
  return useQuery({
    queryKey: ['rental-availability', vehicleId, startISO, endISO, excludeRentalId],
    queryFn: () => checkVehicleAvailability(vehicleId as string, startISO as string, endISO as string, excludeRentalId),
    enabled: !!vehicleId && !!startISO && !!endISO,
  });
}

// ----------------------------------------------------------------------
// Conducteurs d'une réservation
// ----------------------------------------------------------------------

export function useRentalAdditionalDrivers(rentalId: string | undefined) {
  return useQuery({
    queryKey: ['rental-drivers', rentalId],
    queryFn: () => listRentalAdditionalDrivers(rentalId as string),
    enabled: !!rentalId,
  });
}

export function useSaveRentalDrivers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: {
      agencyId: string;
      customerId: string;
      rentalId: string;
      selection: RentalDriversSelection;
    }) => saveRentalDrivers(args.agencyId, args.customerId, args.rentalId, args.selection),
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({ queryKey: ['rental-drivers', args.rentalId] });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['departure-check', args.rentalId] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

// ----------------------------------------------------------------------
// Vérification avant départ
// ----------------------------------------------------------------------

export function useDepartureCheck(rentalId: string | undefined) {
  return useQuery({
    queryKey: ['departure-check', rentalId],
    queryFn: () => getDepartureCheck(rentalId as string),
    enabled: !!rentalId,
  });
}

export function useConfirmDepartureCheck(rentalId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => confirmDepartureCheck(rentalId),
    onSuccess: (check) => {
      queryClient.setQueryData(['departure-check', rentalId], check);
    },
  });
}

export function useDeparturePolicy(agencyId: string | undefined) {
  return useQuery({
    queryKey: ['departure-policy', agencyId],
    queryFn: () => getDeparturePolicy(agencyId as string),
    enabled: !!agencyId,
  });
}

export function useSaveDeparturePolicy(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (policy: DeparturePolicy) => saveDeparturePolicy(agencyId as string, policy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departure-policy', agencyId] });
      queryClient.invalidateQueries({ queryKey: ['departure-check'] });
    },
  });
}
