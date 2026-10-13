import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useClearOcrKey, useIsPlatformAdmin, useOcrAgencies, useSetOcrKey } from '@/features/admin/hooks';
import { adminErrorKey, maskKey, validateGeminiKey, type AgencyOcrKeyRow } from '@/features/admin/ocr-keys';
import { useLanguage } from '@/i18n/use-language';

function AgencyKeyCard({ row }: { row: AgencyOcrKeyRow }) {
  const { t } = useLanguage();
  const setKey = useSetOcrKey();
  const clearKey = useClearOcrKey();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const formError = touched ? validateGeminiKey(value) : null;

  function close() {
    setEditing(false);
    setValue('');
    setTouched(false);
  }

  function handleSave() {
    setTouched(true);
    if (validateGeminiKey(value)) return;
    setKey.mutate(
      { agencyId: row.agencyId, key: value },
      {
        onSuccess: close,
        onError: (error) => Alert.alert(t('common.appName'), t(adminErrorKey(error))),
      }
    );
  }

  function handleClear() {
    Alert.alert(t('admin.ocr.clearTitle', { nom: row.nom }), t('admin.ocr.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.ocr.clear'),
        style: 'destructive',
        onPress: () => clearKey.mutate(row.agencyId, { onError: (error) => Alert.alert(t('common.appName'), t(adminErrorKey(error))) }),
      },
    ]);
  }

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <ThemedText type="smallBold">{row.nom}</ThemedText>
        {row.ville ? (
          <ThemedText type="small" themeColor="textSecondary">
            {row.ville}
          </ThemedText>
        ) : null}
      </View>

      <ThemedText type="small" style={{ color: row.keySet ? M3akPalette.mauve : '#81778F' }}>
        {row.keySet ? t('admin.ocr.keyConfigured', { masked: maskKey(row.keyLast4) }) : t('admin.ocr.keyMissing')}
      </ThemedText>
      {row.keySet ? (
        <ThemedText type="small" themeColor="textSecondary">
          {row.cloudEnabled ? t('admin.ocr.consentGiven') : t('admin.ocr.consentPending')}
        </ThemedText>
      ) : null}

      {editing ? (
        <View className="gap-3">
          <TextField
            label={t('admin.ocr.keyLabel')}
            placeholder={t('admin.ocr.keyPlaceholder')}
            value={value}
            onChangeText={setValue}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            textContentType="none"
            error={formError ? t(`admin.ocr.errors.${formError}`) : undefined}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('admin.ocr.writeOnly')}
          </ThemedText>
          <View className="flex-row gap-2">
            <Button label={t('common.cancel')} variant="secondary" size="sm" style={{ flex: 1 }} onPress={close} />
            <Button
              label={t('admin.ocr.save')}
              size="sm"
              style={{ flex: 1 }}
              disabled={setKey.isPending}
              loading={setKey.isPending}
              onPress={handleSave}
            />
          </View>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Button
            label={row.keySet ? t('admin.ocr.replace') : t('admin.ocr.configure')}
            size="sm"
            style={{ flex: 1 }}
            onPress={() => setEditing(true)}
          />
          {row.keySet ? (
            <Button
              label={t('admin.ocr.clear')}
              variant="danger"
              size="sm"
              style={{ flex: 1 }}
              disabled={clearKey.isPending}
              loading={clearKey.isPending}
              onPress={handleClear}
            />
          ) : null}
        </View>
      )}
    </Card>
  );
}

/** Administration plateforme : l'opérateur M3AK configure la clé Gemini de chaque entreprise (accès contrôlé côté serveur). */
export default function AdminOcrScreen() {
  const { t } = useLanguage();
  const adminQuery = useIsPlatformAdmin();
  const isAdmin = adminQuery.data === true;
  const agenciesQuery = useOcrAgencies(isAdmin);

  if (adminQuery.isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator color={M3akPalette.mauve} />
      </ThemedView>
    );
  }
  if (!isAdmin) return <Redirect href="/accueil" />;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('admin.ocr.title')} subtitle={t('admin.ocr.subtitle')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          <Card className="gap-1">
            <ThemedText type="small" themeColor="textSecondary">
              {t('admin.ocr.intro')}
            </ThemedText>
          </Card>

          {agenciesQuery.isLoading ? (
            <ActivityIndicator color={M3akPalette.mauve} />
          ) : agenciesQuery.isError ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('admin.ocr.loadError')}
            </ThemedText>
          ) : (agenciesQuery.data ?? []).length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('admin.ocr.empty')}
            </ThemedText>
          ) : (
            (agenciesQuery.data ?? []).map((row) => <AgencyKeyCard key={row.agencyId} row={row} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
