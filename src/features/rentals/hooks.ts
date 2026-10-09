import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelRental,
  checkVehicleAvailability,
  completeRental,
  confirmRental,
  createRental,
  getRental,
  listRentals,
  listRentalsForVehicle,
  startRental,
  updateRentalDates,
} from './api';
import type { DepartInput, RentalInput, RetourInput } from './types';

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

export function useStartRental() {
  const invalidate = useInvalidateRentals();

  return useMutation({
    mutationFn: ({ id, vehicleId, input }: { id: string; vehicleId: string; input: DepartInput }) =>
      startRental(id, vehicleId, input),
    onSuccess: (rental) => invalidate(rental),
  });
}

export function useCompleteRental() {
  const invalidate = useInvalidateRentals();

  return useMutation({
    mutationFn: ({ id, vehicleId, input }: { id: string; vehicleId: string; input: RetourInput }) =>
      completeRental(id, vehicleId, input),
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
