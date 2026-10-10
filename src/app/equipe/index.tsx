import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
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
  useMyAgency,
  useRemoveMember,
  useResendAgencyInvite,
  useRevokeAgencyInvite,
  useUpdateMemberRole,
} from '@/features/agency/hooks';
import { useSession } from '@/features/auth/session-context';
import { inviteErrorKey } from '@/features/agency/invite-errors';
import { inviteStatus } from '@/features/agency/invite-code';
import { InviteResultCard } from '@/features/agency/invite-result-card';
import { canRemoveMember } from '@/features/agency/permissions';
import type { AgencyInvite, AgencyMember, AgencyRole, InviteResult } from '@/features/agency/types';
import { useLanguage } from '@/i18n/use-language';

export default function EquipeScreen() {
  const { t } = useLanguage();
  const { session } = useSession();
  const agencyQuery = useMyAgency();
  const membersQuery = useAgencyMembers(agencyQuery.data?.agencyId);
  const invitesQuery = useAgencyInvites(agencyQuery.data?.agencyId);
  const branchesQuery = useBranches(agencyQuery.data?.agencyId);
  const updateRole = useUpdateMemberRole(agencyQuery.data?.agencyId);
  const removeMember = useRemoveMember(agencyQuery.data?.agencyId);
  const resendInvite = useResendAgencyInvite(agencyQuery.data?.agencyId);
  const revokeInvite = useRevokeAgencyInvite(agencyQuery.data?.agencyId);

  const [lastInvite, setLastInvite] = useState<InviteResult | null>(null);

  const canManage = agencyQuery.data?.role === 'owner' || agencyQuery.data?.role === 'manager';
  const isOwner = agencyQuery.data?.role === 'owner';
  const branches = branchesQuery.data ?? [];

  function inviteName(invite: AgencyInvite) {
    return `${invite.prenom ?? ''} ${invite.nom ?? ''}`.trim() || invite.email;
  }

  function handleResend(invite: AgencyInvite) {
    resendInvite.mutate(invite.id, {
      onSuccess: (result) => setLastInvite(result),
      onError: (err) => Alert.alert(t('common.appName'), t(inviteErrorKey(err))),
    });
  }

  function handleRevoke(invite: AgencyInvite) {
    Alert.alert(t('equipe.invite.revokeConfirmTitle', { name: inviteName(invite) }), t('equipe.invite.revokeConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('equipe.invite.revoke'),
        style: 'destructive',
        onPress: () => {
          revokeInvite.mutate(invite.id, {
            onError: (err) => Alert.alert(t('common.appName'), t(inviteErrorKey(err))),
          });
        },
      },
    ]);
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
              <Button label={t('equipe.invite.cta')} icon="person-add-outline" onPress={() => router.push('/equipe/inviter')} />

              {lastInvite ? <InviteResultCard result={lastInvite} onDone={() => setLastInvite(null)} /> : null}

              {(invitesQuery.data ?? []).length > 0 ? (
                <View className="gap-2">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('equipe.pendingInvites')}
                  </ThemedText>
                  {(invitesQuery.data ?? []).map((invite) => {
                    const status = inviteStatus(invite);
                    const branchLabel = invite.branchId
                      ? (branches.find((b) => b.id === invite.branchId)?.nom ?? null)
                      : null;
                    return (
                      <View key={invite.id} className="gap-2 rounded-2xl border border-[#EAE5F2] bg-white px-4 py-3">
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1">
                            <ThemedText type="smallBold">{inviteName(invite)}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {invite.email}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {t(`equipe.roles.${invite.role}`)}
                              {branchLabel ? ` · ${branchLabel}` : ''}
                            </ThemedText>
                          </View>
                          <ThemedText type="small" themeColor="textSecondary">
                            {t(`equipe.invite.status.${status}`)}
                          </ThemedText>
                        </View>
                        {status === 'pending' || status === 'expired' ? (
                          <View className="flex-row gap-2">
                            <Button
                              label={t('equipe.invite.resend')}
                              variant="secondary"
                              size="sm"
                              style={{ flex: 1 }}
                              disabled={resendInvite.isPending}
                              onPress={() => handleResend(invite)}
                            />
                            <Button
                              label={t('equipe.invite.revoke')}
                              variant="danger"
                              size="sm"
                              style={{ flex: 1 }}
                              disabled={revokeInvite.isPending}
                              onPress={() => handleRevoke(invite)}
                            />
                          </View>
                        ) : null}
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
