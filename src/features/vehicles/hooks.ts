import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createVehicle, getVehicle, listVehicles, updateVehicle } from './api';
import type { VehicleInput } from './types';

const vehiclesKey = ['vehicles'] as const;
const vehicleKey = (id: string) => ['vehicles', id] as const;

export function useVehicles() {
  return useQuery({ queryKey: vehiclesKey, queryFn: listVehicles });
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: vehicleKey(id ?? ''),
    queryFn: () => getVehicle(id as string),
    enabled: !!id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, input }: { agencyId: string; input: VehicleInput }) =>
      createVehicle(agencyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehiclesKey });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VehicleInput }) => updateVehicle(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vehiclesKey });
      queryClient.invalidateQueries({ queryKey: vehicleKey(data.id) });
    },
  });
}
