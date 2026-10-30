import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { loadSignature, removeMySignature, saveMySignature } from './api';
import type { HandwrittenSignature } from './signature';

export function useSignature(path: string | null | undefined) {
  return useQuery({
    queryKey: ['signature', path],
    queryFn: () => loadSignature(path),
    enabled: !!path,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveMySignature(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, signature }: { memberId: string; signature: HandwrittenSignature }) =>
      saveMySignature(agencyId as string, memberId, signature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature'] });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
  });
}

export function useRemoveMySignature(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMySignature(agencyId as string, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature'] });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
  });
}
