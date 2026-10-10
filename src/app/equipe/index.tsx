import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { Button } from '@/components/button';
import { PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useBranches } from '@/features/branches/hooks';
import {
  useAgencyInvites,
  useAgencyMembers,
  useCreateAgencyInvite,
  useMyAgency,
  useMyProfile,
  useRemoveMember,
  useUpdateMemberRole,
} from '@/features/agency/hooks';
import { useSession } from '@/features/auth/session-context';
import { isInviteExpired } from '@/features/agency/invite-code';
import { canRemoveMember } from '@/features/agency/permissions';
import { INVITABLE_ROLES, type AgencyMember, type AgencyRole } from '@/features/agency/types';
import { useLanguage } from '@/i18n/use-language';

export default function EquipeScreen() {
  const { t } = useLanguage();
  const { session } = useSession();
  const agencyQuery = useMyAgency();
  const membersQuery = useAgencyMembers(agencyQuery.data?.agencyId);
  const invitesQuery = useAgencyInvites(agencyQuery.data?.agencyId);
  const branchesQuery = useBranches(agencyQuery.data?.agencyId);
  const createInvite = useCreateAgencyInvite();
  const profileQuery = useMyProfile(agencyQuery.data?.agencyId);
  const updateRole = useUpdateMemberRole(agencyQuery.data?.agencyId);
  const removeMember = useRemoveMember(agencyQuery.data?.agencyId);

  const [pendingRole, setPendingRole] = useState<AgencyRole | null>(null);

  const canManage = agencyQuery.data?.role === 'owner' || agencyQuery.data?.role === 'manager';
  const isOwner = agencyQuery.data?.role === 'owner';
  const branches = branchesQuery.data ?? [];

  async function sendInvite(role: AgencyRole, branchId: string | null) {
    if (!agencyQuery.data) return;
    setPendingRole(null);

    let invite;
    try {
      invite = await createInvite.mutateAsync({ agencyId: agencyQuery.data.agencyId, role, branchId });
    } catch {
      Alert.alert(t('common.appName'), t('equipe.inviteError'));
      return;
    }

    const message = t('equipe.inviteMessage', { code: invite.code, agency: agencyQuery.data.agencyName });

    Alert.alert(t('equipe.inviteCreatedTitle', { code: invite.code }), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('equipe.copyCode'), onPress: () => Clipboard.setStringAsync(invite.code) },
      {
        text: t('equipe.shareWhatsapp'),
        onPress: () => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`),
      },
    ]);
  }

  function handleInvite(role: AgencyRole) {
    // Un membre rattaché à une filiale (hors admin) invite toujours dans SA filiale.
    const myBranchId = profileQuery.data?.branchId ?? null;
    if (!isOwner && myBranchId) {
      sendInvite(role, myBranchId);
      return;
    }
    if (branches.length === 0) {
      sendInvite(role, null);
      return;
    }
    setPendingRole(role);
  }

  function handleManageMember(member: AgencyMember, canChangeRole: boolean, canRemove: boolean) {
    const otherRole: AgencyRole = member.role === 'manager' ? 'employee' : 'manager';
    const name = member.nomComplet ?? t('equipe.unnamedMember');

    const actions: Parameters<typeof Alert.alert>[2] = [{ text: t('common.cancel'), style: 'cancel' }];
    if (canChangeRole) {
      actions.push({
        text: `${t('equipe.changeRole')} → ${t(`equipe.roles.${otherRole}`)}`,
        onPress: () => {
          updateRole.mutate(
            { memberId: member.id, role: otherRole },
            { onError: () => Alert.alert(t('common.appName'), t('equipe.roleUpdateError')) }
          );
        },
      });
    }
    if (canRemove) {
      actions.push({
        text: t('equipe.removeMember'),
        style: 'destructive',
        onPress: () => confirmRemove(member, name),
      });
    }

    Alert.alert(t('equipe.manageMember'), name, actions);
  }

  function confirmRemove(member: AgencyMember, name: string) {
    Alert.alert(t('equipe.removeConfirmTitle', { name }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('equipe.removeMember'),
        style: 'destructive',
        onPress: () => {
          removeMember.mutate(member.id, {
            onError: (err) => {
              const message =
                err instanceof Error && err.message.includes('last_owner_cannot_be_removed')
                  ? t('equipe.lastOwnerError')
                  : t('equipe.removeError');
              Alert.alert(t('common.appName'), message);
            },
          });
        },
      },
    ]);
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={t('equipe.title')}
          subtitle={t('equipe.subtitle')}
          right={
            <View className="flex-row items-center gap-3">
              {canManage ? (
                <Pressable onPress={() => router.push('/filiales')} hitSlop={8}>
                  <ThemedText type="small" themeColor="primary">
                    {t('equipe.branches')}
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable onPress={() => router.push('/entreprise')} hitSlop={8}>
                <ThemedText type="small" themeColor="primary">
                  {t('equipe.myCompany')}
                </ThemedText>
              </Pressable>
            </View>
          }
        />

        <ScrollView
          contentContainerClassName="gap-6 px-6 pb-28"
          refreshControl={
            <RefreshControl
              refreshing={membersQuery.isFetching || invitesQuery.isFetching}
              onRefresh={() => {
                membersQuery.refetch();
                invitesQuery.refetch();
              }}
              tintColor="#7C3AED"
            />
          }
        >
          <View className="gap-2">
            <ThemedText type="smallBold">{t('equipe.membersSection')}</ThemedText>
            {(membersQuery.data ?? []).map((member) => {
              const isSelf = member.userId === session?.user.id;
              const canChangeRole = isOwner && !isSelf && member.role !== 'owner';
              const canRemove = canRemoveMember(agencyQuery.data?.role ?? 'employee', member.role, isSelf);
              const canAct = canChangeRole || canRemove;
              return (
                <PressableCard
                  key={member.id}
                  onPress={canAct ? () => handleManageMember(member, canChangeRole, canRemove) : undefined}
                  disabled={!canAct}
                  padded={false}
                  className="flex-row items-center justify-between px-4 py-3"
                >
                  <View className="flex-1 gap-0.5">
                    <ThemedText type="small">{member.nomComplet ?? t('equipe.unnamedMember')}</ThemedText>
                    {member.branchNom ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {member.branchNom}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(`equipe.roles.${member.role}`)}
                    </ThemedText>
                    {canAct ? (
                      <ThemedText type="small" themeColor="primary">
                        ⋯
                      </ThemedText>
                    ) : null}
                  </View>
                </PressableCard>
              );
            })}
          </View>

          {canManage ? (
            <View className="gap-3">
              <ThemedText type="smallBold">{t('equipe.inviteSection')}</ThemedText>
              <View className="flex-row gap-2">
                {INVITABLE_ROLES.map((role) => (
                  <Button
                    key={role}
                    label={t('equipe.inviteAs', { role: t(`equipe.roles.${role}`) })}
                    onPress={() => handleInvite(role)}
                    disabled={createInvite.isPending}
                    size="sm"
                    style={{ flex: 1 }}
                  />
                ))}
              </View>

              {pendingRole ? (
                <View className="gap-2 rounded-3xl border border-[#EAE5F2] bg-white p-4">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('equipe.chooseBranch', { role: t(`equipe.roles.${pendingRole}`) })}
                  </ThemedText>
                  <View className="flex-row flex-wrap gap-2">
                    <Pressable
                      onPress={() => sendInvite(pendingRole, null)}
                      className="rounded-full border border-[#EAE5F2] bg-white px-4 py-2"
                    >
                      <ThemedText type="small">{t('equipe.noBranch')}</ThemedText>
                    </Pressable>
                    {branches.map((branch) => (
                      <Pressable
                        key={branch.id}
                        onPress={() => sendInvite(pendingRole, branch.id)}
                        className="rounded-full border border-[#EAE5F2] bg-white px-4 py-2"
                      >
                        <ThemedText type="small">{branch.nom}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={() => setPendingRole(null)} className="items-center py-1">
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('common.cancel')}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}

              {(invitesQuery.data ?? []).length > 0 ? (
                <View className="gap-2">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('equipe.pendingInvites')}
                  </ThemedText>
                  {(invitesQuery.data ?? []).map((invite) => {
                    const expired = isInviteExpired(invite.expiresAt);
                    const status = invite.usedAt
                      ? t('equipe.inviteUsed')
                      : expired
                        ? t('equipe.inviteExpired')
                        : t('equipe.inviteActive');
                    const branchLabel = invite.branchId
                      ? (branches.find((b) => b.id === invite.branchId)?.nom ?? null)
                      : null;
                    return (
                      <View
                        key={invite.id}
                        className="flex-row items-center justify-between rounded-2xl border border-[#EAE5F2] bg-white px-4 py-3"
                      >
                        <View>
                          <ThemedText type="smallBold">{invite.code}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {t(`equipe.roles.${invite.role}`)}
                            {branchLabel ? ` · ${branchLabel}` : ''}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">
                          {status}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <BottomTabBar current="equipe" />
      </SafeAreaView>
    </ThemedView>
  );
}
