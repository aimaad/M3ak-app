import * as Clipboard from 'expo-clipboard';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  useAgencyInvites,
  useAgencyMembers,
  useCreateAgencyInvite,
  useMyAgency,
} from '@/features/agency/hooks';
import { isInviteExpired } from '@/features/agency/invite-code';
import { INVITABLE_ROLES, type AgencyRole } from '@/features/agency/types';
import { useLanguage } from '@/i18n/use-language';

export default function EquipeScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const membersQuery = useAgencyMembers(agencyQuery.data?.agencyId);
  const invitesQuery = useAgencyInvites(agencyQuery.data?.agencyId);
  const createInvite = useCreateAgencyInvite();

  const canManage = agencyQuery.data?.role === 'owner' || agencyQuery.data?.role === 'manager';

  async function handleInvite(role: AgencyRole) {
    if (!agencyQuery.data) return;

    let invite;
    try {
      invite = await createInvite.mutateAsync({ agencyId: agencyQuery.data.agencyId, role });
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

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('equipe.title')} subtitle={t('equipe.subtitle')} />

        <ScrollView
          contentContainerClassName="gap-6 px-6 pb-28"
          refreshControl={
            <RefreshControl
              refreshing={membersQuery.isFetching || invitesQuery.isFetching}
              onRefresh={() => {
                membersQuery.refetch();
                invitesQuery.refetch();
              }}
              tintColor="#1f5eff"
            />
          }
        >
          <View className="gap-2">
            <ThemedText type="smallBold">{t('equipe.membersSection')}</ThemedText>
            {(membersQuery.data ?? []).map((member) => (
              <View
                key={member.id}
                className="flex-row items-center justify-between rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
              >
                <ThemedText type="small">{member.nomComplet ?? t('equipe.unnamedMember')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`equipe.roles.${member.role}`)}
                </ThemedText>
              </View>
            ))}
          </View>

          {canManage ? (
            <View className="gap-3">
              <ThemedText type="smallBold">{t('equipe.inviteSection')}</ThemedText>
              <View className="flex-row gap-2">
                {INVITABLE_ROLES.map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => handleInvite(role)}
                    disabled={createInvite.isPending}
                    className="flex-1 items-center rounded-2xl bg-[#1f5eff] px-4 py-3"
                  >
                    <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                      {t('equipe.inviteAs', { role: t(`equipe.roles.${role}`) })}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

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
                    return (
                      <View
                        key={invite.id}
                        className="flex-row items-center justify-between rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
                      >
                        <View>
                          <ThemedText type="smallBold">{invite.code}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {t(`equipe.roles.${invite.role}`)}
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
