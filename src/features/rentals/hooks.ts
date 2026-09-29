import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelRental,
  completeRental,
  createRental,
  getRental,
  listRentals,
  listRentalsForVehicle,
  startRental,
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
