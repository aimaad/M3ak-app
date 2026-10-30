import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { useLanguage } from '@/i18n/use-language';

import { badgeLabel } from '@/features/dashboard/header-format';

import { useNotifications } from './hooks';

/** Cloche avec le nombre de notifications ; ouvre la page des notifications. */
export function NotificationBell({ tone = 'default' }: { tone?: 'default' | 'onForest' }) {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { data } = useNotifications(agencyQuery.data?.agencyId);
  const count = data?.length ?? 0;
  const onForest = tone === 'onForest';
  const label = badgeLabel(count);
  const hasUrgent = (data ?? []).some((item) => item.severity === 'urgent');

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0 ? `${t('notifications.title')}, ${t('accueil.header.unread', { count })}` : t('notifications.title')
      }
      className={
        onForest
          ? 'h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 active:bg-white/20'
          : 'h-10 w-10 items-center justify-center rounded-full bg-white'
      }
    >
      <Ionicons
        name={count > 0 && !onForest ? 'notifications' : 'notifications-outline'}
        size={onForest ? 21 : 22}
        color={onForest ? '#FFFFFF' : M3akPalette.mauve}
      />
      {label ? (
        <View
          className="absolute min-w-5 items-center justify-center rounded-full px-1"
          style={{
            backgroundColor: hasUrgent ? '#DC2626' : '#F59E0B',
            top: onForest ? -2 : -4,
            end: onForest ? -2 : -4,
            height: 20,
            borderWidth: onForest ? 2 : 0,
            borderColor: M3akPalette.mauveDeep,
          }}
        >
          <ThemedText type="small" style={{ color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
            {label}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}
