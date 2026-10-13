import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-context';

import { clearOcrKey, isPlatformAdmin, listOcrAgencies, setOcrKey } from './api';

const adminKey = (userId: string | undefined) => ['platform-admin', userId] as const;
const agenciesKey = ['admin-ocr-agencies'] as const;

export function useIsPlatformAdmin() {
  const { session } = useSession();
  return useQuery({ queryKey: adminKey(session?.user.id), queryFn: isPlatformAdmin, enabled: !!session, staleTime: 5 * 60 * 1000 });
}

export function useOcrAgencies(enabled: boolean) {
  return useQuery({ queryKey: agenciesKey, queryFn: listOcrAgencies, enabled });
}

export function useSetOcrKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agencyId, key }: { agencyId: string; key: string }) => setOcrKey(agencyId, key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agenciesKey }),
  });
}

export function useClearOcrKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agencyId: string) => clearOcrKey(agencyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agenciesKey }),
  });
}
