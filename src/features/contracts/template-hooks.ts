import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ContractOptions } from './contract-options';
import { getContractTemplate, removeContractTemplate, saveContractOptions } from './template-api';

const key = (agencyId: string | undefined) => ['contract-template', agencyId] as const;

/** Lu une fois puis gardé en mémoire : générer un contrat ne refait aucune lecture lourde. */
export function useContractTemplate(agencyId: string | undefined) {
  return useQuery({
    queryKey: key(agencyId),
    queryFn: () => getContractTemplate(agencyId as string),
    enabled: !!agencyId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useSaveContractOptions(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: ContractOptions) => saveContractOptions(agencyId as string, options),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(agencyId) }),
  });
}

export function useRemoveContractTemplate(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeContractTemplate(agencyId as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(agencyId) }),
  });
}
