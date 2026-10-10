import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  completeMaintenanceItem,
  createMaintenanceItem,
  getMaintenanceItem,
  listMaintenanceItems,
  listMaintenanceItemsForVehicle,
  startMaintenanceItem,
} from './api';
import type { MaintenanceCompletionInput, MaintenanceInput } from './types';

const maintenanceKey = ['maintenance'] as const;
const maintenanceItemKey = (id: string) => ['maintenance', id] as const;
const vehicleMaintenanceKey = (vehicleId: string) => ['maintenance', 'vehicle', vehicleId] as const;

export function useMaintenanceItems() {
  return useQuery({ queryKey: maintenanceKey, queryFn: listMaintenanceItems });
}

export function useMaintenanceItem(id: string | undefined) {
  return useQuery({
    queryKey: maintenanceItemKey(id ?? ''),
    queryFn: () => getMaintenanceItem(id as string),
    enabled: !!id,
  });
}

export function useVehicleMaintenanceItems(vehicleId: string | undefined) {
  return useQuery({
    queryKey: vehicleMaintenanceKey(vehicleId ?? ''),
    queryFn: () => listMaintenanceItemsForVehicle(vehicleId as string),
    enabled: !!vehicleId,
  });
}

function useInvalidateMaintenance() {
  const queryClient = useQueryClient();
  return (item: { id: string; vehicleId: string }) => {
    queryClient.invalidateQueries({ queryKey: maintenanceKey });
    queryClient.invalidateQueries({ queryKey: maintenanceItemKey(item.id) });
    queryClient.invalidateQueries({ queryKey: vehicleMaintenanceKey(item.vehicleId) });
    // Le statut du véhicule peut changer côté serveur (immobilisation automatique).
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  };
}

export function useCreateMaintenanceItem() {
  const invalidate = useInvalidateMaintenance();

  return useMutation({
    mutationFn: ({ agencyId, input }: { agencyId: string; input: MaintenanceInput }) =>
      createMaintenanceItem(agencyId, input),
    onSuccess: (item) => invalidate(item),
  });
}

export function useStartMaintenanceItem() {
  const invalidate = useInvalidateMaintenance();

  return useMutation({
    mutationFn: (id: string) => startMaintenanceItem(id),
    onSuccess: (item) => invalidate(item),
  });
}

export function useCompleteMaintenanceItem() {
  const invalidate = useInvalidateMaintenance();

  return useMutation({
    mutationFn: ({ id, completion }: { id: string; completion: MaintenanceCompletionInput }) =>
      completeMaintenanceItem(id, completion),
    onSuccess: (item) => invalidate(item),
  });
}
