import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Palette } from '@/constants/theme';
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

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        count > 0
          ? `${t('notifications.title')}, ${t('accueil.header.unread', { count })}`
          : t('notifications.title')
      }
      className={
        onForest
          ? 'h-11 w-11 items-center justify-center rounded-full border'
          : 'h-10 w-10 items-center justify-center rounded-full bg-card'
      }
      style={({ pressed }) =>
        onForest
          ? { backgroundColor: pressed ? Brand.surfaceOnDark : 'transparent', borderColor: Brand.strokeOnDark }
          : undefined
      }
    >
      <Ionicons
        name={count > 0 && !onForest ? 'notifications' : 'notifications-outline'}
        size={onForest ? 21 : 22}
        color={onForest ? Brand.white : Palette.textPrimary}
      />
      {label ? (
        <View
          className="absolute min-w-5 items-center justify-center rounded-full px-1"
          style={{
            backgroundColor: Palette.primary,
            top: onForest ? -3 : -4,
            end: onForest ? -5 : -4,
            height: onForest ? 18 : 20,
            borderWidth: onForest ? 2 : 1.5,
            borderColor: onForest ? Brand.graphite : Palette.card,
          }}
        >
          <ThemedText
            type="small"
            style={{ color: Brand.white, fontSize: onForest ? 10 : 11, lineHeight: 14, fontWeight: '700' }}
          >
            {label}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}
