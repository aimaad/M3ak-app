import { Redirect } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useAuditLog, useMyAgency } from '@/features/agency/hooks';
import type { AuditLogEntry } from '@/features/agency/types';
import { useLanguage } from '@/i18n/use-language';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function describeEntry(entry: AuditLogEntry, t: (key: string, params?: Record<string, unknown>) => string): string {
  const actor = entry.actorName ?? t('journal.unknownActor');
  switch (entry.action) {
    case 'branch_created':
      return t('journal.actions.branch_created', { actor, target: entry.targetLabel ?? '—' });
    case 'branch_updated':
      return t('journal.actions.branch_updated', { actor, target: entry.targetLabel ?? '—' });
    case 'branch_deleted':
      return t('journal.actions.branch_deleted', { actor, target: entry.targetLabel ?? '—' });
    case 'invite_created':
      return t('journal.actions.invite_created', { actor, code: entry.targetLabel ?? '—' });
    case 'member_joined':
      return t('journal.actions.member_joined', { actor: entry.targetLabel ?? t('journal.unknownActor') });
    case 'member_role_changed':
      return t('journal.actions.member_role_changed', { actor, target: entry.targetLabel ?? '—' });
    case 'member_removed':
      return t('journal.actions.member_removed', { actor, target: entry.targetLabel ?? t('journal.unknownActor') });
    default:
      return entry.action;
  }
}

export default function JournalScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const auditQuery = useAuditLog(agencyQuery.data?.agencyId);

  if (agencyQuery.data && agencyQuery.data.role !== 'owner') {
    return <Redirect href="/entreprise" />;
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('journal.title')} subtitle={t('journal.subtitle')} showBack />

        {auditQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : auditQuery.isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('journal.loadError')}
            </ThemedText>
          </View>
        ) : (auditQuery.data ?? []).length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('journal.empty')}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={auditQuery.data ?? []}
            keyExtractor={(entry) => entry.id}
            contentContainerClassName="gap-2 px-6 pb-10"
            renderItem={({ item }) => (
              <Card padded={false} className="px-4 py-3 gap-0.5">
                <ThemedText type="small">{describeEntry(item, t)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                  {formatDateTime(item.createdAt)}
                </ThemedText>
              </Card>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
