import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getContractTemplate, removeContractTemplate, saveContractTemplate } from './template-api';
import type { ContractTemplate } from './template';

const key = (agencyId: string | undefined) => ['contract-template', agencyId] as const;

/** Lu une fois puis gardé en mémoire : générer un contrat ne refait aucune analyse. */
export function useContractTemplate(agencyId: string | undefined) {
  return useQuery({
    queryKey: key(agencyId),
    queryFn: () => getContractTemplate(agencyId as string),
    enabled: !!agencyId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useSaveContractTemplate(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ template, sourceName }: { template: ContractTemplate; sourceName: string | null }) =>
      saveContractTemplate(agencyId as string, template, sourceName),
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
