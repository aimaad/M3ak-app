import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createBranch, deleteBranch, listBranches, updateBranch } from './api';
import type { BranchInput } from './types';

const branchesKey = (agencyId: string) => ['branches', agencyId] as const;

export function useBranches(agencyId: string | undefined) {
  return useQuery({
    queryKey: branchesKey(agencyId ?? ''),
    queryFn: () => listBranches(agencyId as string),
    enabled: !!agencyId,
  });
}

export function useCreateBranch(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BranchInput) => createBranch(agencyId as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchesKey(agencyId ?? '') });
    },
  });
}

export function useUpdateBranch(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BranchInput }) => updateBranch(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchesKey(agencyId ?? '') });
    },
  });
}

export function useDeleteBranch(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchesKey(agencyId ?? '') });
    },
  });
}
