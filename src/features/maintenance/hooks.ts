import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createMaintenanceItem, listMaintenanceItems, markMaintenanceDone } from './api';
import type { MaintenanceInput } from './types';

const maintenanceKey = ['maintenance'] as const;

export function useMaintenanceItems() {
  return useQuery({ queryKey: maintenanceKey, queryFn: listMaintenanceItems });
}

export function useCreateMaintenanceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, input }: { agencyId: string; input: MaintenanceInput }) =>
      createMaintenanceItem(agencyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKey });
    },
  });
}

export function useMarkMaintenanceDone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markMaintenanceDone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKey });
    },
  });
}
