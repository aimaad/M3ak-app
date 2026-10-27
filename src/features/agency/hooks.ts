import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-context';
import type { UploadProgress } from '@/features/storage/api';

import {
  createAgencyInvite,
  getAgencyDetails,
  getMyAgencyAccess,
  getMyAgencyMembership,
  getMyMemberProfile,
  listAgencyInvites,
  listAgencyMembers,
  redeemInvite,
  removeMember,
  resendAgencyInvite,
  revokeAgencyInvite,
  updateAgencyDetails,
  updateMemberRole,
  updateMyProfile,
  uploadAgencyLogo,
  uploadAgencyStamp,
  removeAgencyStamp,
  saveAgencyStampConfig,
  uploadMemberAvatar,
} from './api';
import type { StampConfig } from './stamp';
import type { AgencyDetailsInput, AgencyRole, CreateInviteInput, MemberProfileInput } from './types';

export function useMyAgency() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['my-agency', session?.user.id],
    queryFn: getMyAgencyMembership,
    enabled: !!session,
  });
}

export function useAgencyAccess() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['agency-access', session?.user.id],
    queryFn: getMyAgencyAccess,
    enabled: !!session,
    // Revérifie régulièrement : l'essai peut se terminer pendant que l'app est ouverte.
    refetchInterval: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });
}

export function useRedeemInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => redeemInvite(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-agency'] });
      queryClient.invalidateQueries({ queryKey: ['agency-access'] });
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
    mutationFn: (input: CreateInviteInput) => createAgencyInvite(input),
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ['agency-invites', input.agencyId] });
    },
  });
}

export function useResendAgencyInvite(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => resendAgencyInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-invites', agencyId] });
    },
  });
}

export function useRevokeAgencyInvite(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => revokeAgencyInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-invites', agencyId] });
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
    mutationFn: ({ agencyId, localUri, onProgress, signal }: { agencyId: string; localUri: string; onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal }) =>
      uploadAgencyLogo(agencyId, localUri, onProgress, signal),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agency-details', data.id] });
      queryClient.invalidateQueries({ queryKey: ['signed-url'] });
      queryClient.invalidateQueries({ queryKey: ['my-agency'] });
    },
  });
}

export function useUploadAgencyStamp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, localUri }: { agencyId: string; localUri: string }) => uploadAgencyStamp(agencyId, localUri),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agency-details', data.id] });
      queryClient.invalidateQueries({ queryKey: ['signed-url'] });
    },
  });
}

export function useSaveAgencyStampConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, config }: { agencyId: string; config: StampConfig }) => saveAgencyStampConfig(agencyId, config),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agency-details', data.id] });
      queryClient.invalidateQueries({ queryKey: ['signed-url'] });
    },
  });
}

export function useRemoveAgencyStamp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agencyId: string) => removeAgencyStamp(agencyId),
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

export function useMyProfile(agencyId: string | undefined) {
  const { session } = useSession();

  return useQuery({
    queryKey: ['my-profile', agencyId, session?.user.id],
    queryFn: () => getMyMemberProfile(agencyId as string),
    enabled: !!agencyId && !!session,
  });
}

export function useUpdateMyProfile(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, input }: { memberId: string; input: MemberProfileInput }) =>
      updateMyProfile(memberId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile', agencyId] });
      queryClient.invalidateQueries({ queryKey: ['my-agency'] });
      queryClient.invalidateQueries({ queryKey: ['agency-members', agencyId] });
    },
  });
}

export function useUploadMemberAvatar(agencyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, localUri }: { memberId: string; localUri: string }) =>
      uploadMemberAvatar(agencyId as string, memberId, localUri),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile', agencyId] });
      queryClient.invalidateQueries({ queryKey: ['agency-members', agencyId] });
    },
  });
}
