import { Alert, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { useNotificationPreferences, useSaveNotificationPreferences } from './hooks';
import { isPushSupported } from './push';
import { DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_CATEGORIES, type NotificationCategory } from './types';

function SwitchRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-2" style={{ opacity: disabled ? 0.5 : 1 }}>
      <View className="flex-1 gap-0.5">
        <ThemedText type="smallBold">{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: M3akPalette.mauve }} />
    </View>
  );
}

/** Réglages des notifications de l'utilisateur : tout, le push sur ce téléphone, et chaque type. */
export function NotificationSettings({ agencyId }: { agencyId: string | undefined }) {
  const { t } = useLanguage();
  const prefsQuery = useNotificationPreferences(agencyId);
  const save = useSaveNotificationPreferences(agencyId);
  const prefs = prefsQuery.data ?? DEFAULT_NOTIFICATION_PREFERENCES;

  function update(next: Partial<typeof prefs>) {
    save.mutate({ ...prefs, ...next }, { onError: () => Alert.alert(t('common.appName'), t('notifications.prefs.saveError')) });
  }

  function toggleCategory(category: NotificationCategory, on: boolean) {
    update({ mutedCategories: on ? prefs.mutedCategories.filter((c) => c !== category) : [...prefs.mutedCategories, category] });
  }

  return (
    <View className="gap-3">
      <ThemedText type="smallBold">{t('notifications.prefs.title')}</ThemedText>
      <Card className="gap-1">
        <SwitchRow label={t('notifications.prefs.enabled')} hint={t('notifications.prefs.enabledHint')} value={prefs.enabled} onChange={(enabled) => update({ enabled })} />
        <SwitchRow
          label={t('notifications.prefs.push')}
          hint={isPushSupported() ? t('notifications.prefs.pushHint') : t('notifications.prefs.pushUnavailable')}
          value={prefs.pushEnabled}
          onChange={(pushEnabled) => update({ pushEnabled })}
          disabled={!prefs.enabled}
        />
        <ThemedText type="small" themeColor="textSecondary" className="pt-2">
          {t('notifications.prefs.categories')}
        </ThemedText>
        {NOTIFICATION_CATEGORIES.map((category) => (
          <SwitchRow
            key={category}
            label={t(`notifications.categories.${category}`)}
            value={!prefs.mutedCategories.includes(category)}
            onChange={(on) => toggleCategory(category, on)}
            disabled={!prefs.enabled}
          />
        ))}
      </Card>
    </View>
  );
}
