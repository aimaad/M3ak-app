import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { useLanguage } from '@/i18n/use-language';

import { useNotifications } from './hooks';

/** Cloche avec le nombre de notifications ; ouvre la page des notifications. */
export function NotificationBell() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { data } = useNotifications(agencyQuery.data?.agencyId);
  const count = data?.length ?? 0;
  const hasUrgent = (data ?? []).some((item) => item.severity === 'urgent');

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('notifications.title')}
      className="h-10 w-10 items-center justify-center rounded-full bg-white"
    >
      <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={22} color={M3akPalette.mauve} />
      {count > 0 ? (
        <View
          className="absolute -top-1 min-w-5 items-center justify-center rounded-full px-1"
          style={{ backgroundColor: hasUrgent ? '#DC2626' : '#F59E0B', end: -4, height: 20 }}
        >
          <ThemedText type="small" style={{ color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
            {count > 99 ? '99+' : String(count)}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}
