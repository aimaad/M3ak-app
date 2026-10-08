import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-context';

import {
  createAgency,
  createAgencyInvite,
  getMyAgencyMembership,
  listAgencyInvites,
  listAgencyMembers,
  redeemInvite,
} from './api';
import type { AgencyRole } from './types';

export function useMyAgency() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['my-agency', session?.user.id],
    queryFn: getMyAgencyMembership,
    enabled: !!session,
  });
}

export function useCreateAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nom, ville, ownerName }: { nom: string; ville: string | null; ownerName: string }) =>
      createAgency(nom, ville, ownerName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-agency'] });
    },
  });
}

export function useRedeemInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => redeemInvite(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-agency'] });
    },
  });
}

export function useAgencyMembers(agencyId: string | undefined) {
  return useQuery({
    queryKey: ['agency-members', agencyId],
    queryFn: () => listAgencyMembers(agencyId as string),
    enabled: !!agencyId,
  });
}

export function useAgencyInvites(agencyId: string | undefined) {
  return useQuery({
    queryKey: ['agency-invites', agencyId],
    queryFn: () => listAgencyInvites(agencyId as string),
    enabled: !!agencyId,
  });
}

export function useCreateAgencyInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, role }: { agencyId: string; role: AgencyRole }) =>
      createAgencyInvite(agencyId, role),
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: ['agency-invites', invite.agencyId] });
    },
  });
}
