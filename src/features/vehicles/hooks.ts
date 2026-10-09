import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archiveVehicle,
  createVehicle,
  getVehicle,
  listVehicles,
  reactivateVehicle,
  updateVehicle,
  updateVehicleDocuments,
  updateVehiclePhotos,
} from './api';
import type { Vehicle, VehicleDocument, VehicleInput, VehiclePhoto } from './types';

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

function useVehicleStatusMutation(mutationFn: (id: string) => Promise<Vehicle>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vehiclesKey });
      queryClient.invalidateQueries({ queryKey: vehicleKey(data.id) });
    },
  });
}

export function useArchiveVehicle() {
  return useVehicleStatusMutation(archiveVehicle);
}

export function useReactivateVehicle() {
  return useVehicleStatusMutation(reactivateVehicle);
}

export function useUpdateVehicleDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, documents }: { id: string; documents: VehicleDocument[] }) =>
      updateVehicleDocuments(id, documents),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vehiclesKey });
      queryClient.invalidateQueries({ queryKey: vehicleKey(data.id) });
    },
  });
}

export function useUpdateVehiclePhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, photos }: { id: string; photos: VehiclePhoto[] }) => updateVehiclePhotos(id, photos),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vehiclesKey });
      queryClient.invalidateQueries({ queryKey: vehicleKey(data.id) });
    },
  });
}
