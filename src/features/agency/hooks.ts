import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-context';

import {
  createAgency,
  createAgencyInvite,
  getAgencyDetails,
  getMyAgencyMembership,
  listAgencyInvites,
  listAgencyMembers,
  redeemInvite,
  removeMember,
  updateAgencyDetails,
  updateMemberRole,
  uploadAgencyLogo,
} from './api';
import type { AgencyDetailsInput, AgencyRole } from './types';

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

export function useAgencyDetails(agencyId: string | undefined) {
  return useQuery({
    queryKey: ['agency-details', agencyId],
    queryFn: () => getAgencyDetails(agencyId as string),
    enabled: !!agencyId,
  });
}

export function useUpdateAgencyDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, input }: { agencyId: string; input: AgencyDetailsInput }) =>
      updateAgencyDetails(agencyId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agency-details', data.id] });
      queryClient.invalidateQueries({ queryKey: ['my-agency'] });
    },
  });
}

export function useUploadAgencyLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, localUri }: { agencyId: string; localUri: string }) =>
      uploadAgencyLogo(agencyId, localUri),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agency-details', data.id] });
    },
  });
}

export function useUpdateMemberRole(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: AgencyRole }) =>
      updateMemberRole(memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-members', agencyId] });
    },
  });
}

export function useRemoveMember(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-members', agencyId] });
    },
  });
}
