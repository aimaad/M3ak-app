import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { InfoRow } from '@/components/info-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  useAgencyDetails,
  useMyAgency,
  useUpdateAgencyDetails,
} from '@/features/agency/hooks';
import {
  isAgencyDetailsFormValid,
  isAgencyFormDirty,
  toAgencyDetailsInput,
  validateAgencyDetailsForm,
  type AgencyDetailsFormValues,
} from '@/features/agency/validation';
import { useOcrSettings, useSetAiChatEnabled, useSetAiInsightsEnabled, useSetOcrCloudEnabled } from '@/features/ocr/hooks';
import { LogoField } from '@/features/agency/logo-field';
import { AgencyStampSettings } from '@/features/agency/stamp-settings';
import type { AgencyDetails } from '@/features/agency/types';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useLanguage } from '@/i18n/use-language';
import { M3akPalette } from '@/constants/theme';

function valuesFromDetails(details: AgencyDetails): AgencyDetailsFormValues {
  return {
    nom: details.nom,
    raisonSociale: details.raisonSociale ?? '',
    email: details.email ?? '',
    telephone: details.telephone ?? '',
    adresse: details.adresse ?? '',
    ville: details.ville ?? '',
    pays: details.pays,
    devise: details.devise,
  };
}

export default function EntrepriseScreen() {
  const { t } = useLanguage();
  const membershipQuery = useMyAgency();
  const agencyId = membershipQuery.data?.agencyId;
  const isOwner = membershipQuery.data?.role === 'owner';
  const detailsQuery = useAgencyDetails(agencyId);

  const isLoading = membershipQuery.isLoading || detailsQuery.isLoading;
  const isError = membershipQuery.isError || detailsQuery.isError;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={t('entreprise.title')}
          subtitle={t('entreprise.subtitle')}
          showBack
          right={
            isOwner ? (
              <Pressable onPress={() => router.push('/journal')} hitSlop={8}>
                <ThemedText type="small" themeColor="primary">
                  {t('entreprise.journal')}
                </ThemedText>
              </Pressable>
            ) : undefined
          }
        />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : isError || !agencyId || !detailsQuery.data ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('entreprise.loadError')}
            </ThemedText>
          </View>
        ) : (
          <EntrepriseForm
            agencyId={agencyId}
            isOwner={isOwner}
            details={detailsQuery.data}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Lecture des documents : sur l'appareil par défaut. L'analyse par Gemini n'existe que si l'opérateur M3AK
 * a configuré une clé pour l'entreprise ; le propriétaire doit alors l'autoriser explicitement.
 */
function DocumentReadingSettings({ agencyId, isOwner }: { agencyId: string; isOwner: boolean }) {
  const { t } = useLanguage();
  const { settings } = useOcrSettings();
  const setEnabled = useSetOcrCloudEnabled(agencyId);

  function fail() {
    Alert.alert(t('common.appName'), t('ocr.settingsError'));
  }

  function handleToggle() {
    if (settings.cloudEnabled) {
      setEnabled.mutate(false, { onError: fail });
      return;
    }
    Alert.alert(t('ocr.enableConfirmTitle'), t('ocr.enableConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('ocr.enable'), onPress: () => setEnabled.mutate(true, { onError: fail }) },
    ]);
  }

  return (
    <View className="gap-2 rounded-3xl border border-line bg-white p-4">
      <ThemedText type="smallBold">{t('ocr.settingsTitle')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {!settings.cloudAvailable
          ? t('ocr.settingsCloudUnavailable')
          : settings.cloudEnabled
            ? t('ocr.settingsCloudOn')
            : t('ocr.settingsCloudOff')}
      </ThemedText>
      {settings.cloudAvailable ? (
        isOwner ? (
          <Button
            label={settings.cloudEnabled ? t('ocr.disable') : t('ocr.enable')}
            variant={settings.cloudEnabled ? 'danger' : 'primary'}
            size="sm"
            disabled={setEnabled.isPending}
            loading={setEnabled.isPending}
            onPress={handleToggle}
          />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('ocr.ownerOnly')}
          </ThemedText>
        )
      ) : null}
    </View>
  );
}

/** Recommandations IA de l'accueil : mêmes règles (clé configurée par M3AK + accord du propriétaire), accord distinct. */
function AiInsightsSettings({ agencyId, isOwner }: { agencyId: string; isOwner: boolean }) {
  const { t } = useLanguage();
  const { settings } = useOcrSettings();
  const setEnabled = useSetAiInsightsEnabled(agencyId);

  function fail() {
    Alert.alert(t('common.appName'), t('ocr.settingsError'));
  }

  function handleToggle() {
    if (settings.insightsEnabled) {
      setEnabled.mutate(false, { onError: fail });
      return;
    }
    Alert.alert(t('ocr.insights.confirmTitle'), t('ocr.insights.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('ocr.insights.enable'), onPress: () => setEnabled.mutate(true, { onError: fail }) },
    ]);
  }

  return (
    <View className="gap-2 rounded-3xl border border-line bg-white p-4">
      <ThemedText type="smallBold">{t('ocr.insights.title')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {!settings.cloudAvailable ? t('ocr.insights.unavailable') : settings.insightsEnabled ? t('ocr.insights.on') : t('ocr.insights.off')}
      </ThemedText>
      {settings.cloudAvailable ? (
        isOwner ? (
          <Button
            label={settings.insightsEnabled ? t('ocr.insights.disable') : t('ocr.insights.enable')}
            variant={settings.insightsEnabled ? 'danger' : 'primary'}
            size="sm"
            disabled={setEnabled.isPending}
            loading={setEnabled.isPending}
            onPress={handleToggle}
          />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('ocr.ownerOnly')}
          </ThemedText>
        )
      ) : null}
    </View>
  );
}

/** Chat M3ak : mêmes règles (clé configurée par M3AK + accord du propriétaire), accord distinct (des noms de clients sont transmis à l'IA). */
function AiChatSettings({ agencyId, isOwner }: { agencyId: string; isOwner: boolean }) {
  const { t } = useLanguage();
  const { settings } = useOcrSettings();
  const setEnabled = useSetAiChatEnabled(agencyId);

  function fail() {
    Alert.alert(t('common.appName'), t('ocr.settingsError'));
  }

  function handleToggle() {
    if (settings.chatEnabled) {
      setEnabled.mutate(false, { onError: fail });
      return;
    }
    Alert.alert(t('ocr.chat.confirmTitle'), t('ocr.chat.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('ocr.chat.enable'), onPress: () => setEnabled.mutate(true, { onError: fail }) },
    ]);
  }

  return (
    <View className="gap-2 rounded-3xl border border-line bg-white p-4">
      <ThemedText type="smallBold">{t('ocr.chat.title')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {!settings.cloudAvailable ? t('ocr.chat.unavailable') : settings.chatEnabled ? t('ocr.chat.on') : t('ocr.chat.off')}
      </ThemedText>
      {settings.cloudAvailable ? (
        isOwner ? (
          <Button
            label={settings.chatEnabled ? t('ocr.chat.disable') : t('ocr.chat.enable')}
            variant={settings.chatEnabled ? 'danger' : 'primary'}
            size="sm"
            disabled={setEnabled.isPending}
            loading={setEnabled.isPending}
            onPress={handleToggle}
          />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('ocr.ownerOnly')}
          </ThemedText>
        )
      ) : null}
    </View>
  );
}

function EntrepriseForm({
  agencyId,
  isOwner,
  details,
}: {
  agencyId: string;
  isOwner: boolean;
  details: AgencyDetails;
}) {
  const { t } = useLanguage();
  const updateDetails = useUpdateAgencyDetails();

  const [values, setValues] = useState<AgencyDetailsFormValues>(() => valuesFromDetails(details));
  const [touched, setTouched] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const errors = validateAgencyDetailsForm(values);

  function update<K extends keyof AgencyDetailsFormValues>(key: K, value: AgencyDetailsFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(): Promise<boolean> {
    setTouched(true);
    setFeedback(null);
    if (!isAgencyDetailsFormValid(errors)) return false;

    try {
      await updateDetails.mutateAsync({ agencyId, input: toAgencyDetailsInput(values) });
      setFeedback({ type: 'success', message: t('entreprise.saveSuccess') });
      return true;
    } catch {
      setFeedback({ type: 'error', message: t('entreprise.saveError') });
      return false;
    }
  }

  // Avertit avant de quitter avec des modifications non enregistrées (propriétaire seulement : seul lui peut modifier).
  const dirty = isOwner && isAgencyFormDirty(values, valuesFromDetails(details));
  useUnsavedChangesGuard(dirty, handleSave);

  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
      <LogoField agencyId={agencyId} logoPath={details.logoUrl} canEdit={isOwner} initial={values.nom.charAt(0).toUpperCase() || '?'} />

      {isOwner ? (
        <>
          <TextField
            label={t('entreprise.fields.nom')}
            value={values.nom}
            onChangeText={(v) => update('nom', v)}
            error={touched && errors.nom ? t(`entreprise.errors.${errors.nom}`) : undefined}
          />
          <TextField
            label={t('entreprise.fields.raisonSociale')}
            value={values.raisonSociale}
            onChangeText={(v) => update('raisonSociale', v)}
          />
          <TextField
            label={t('entreprise.fields.email')}
            value={values.email}
            onChangeText={(v) => update('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={touched && errors.email ? t(`entreprise.errors.${errors.email}`) : undefined}
          />
          <TextField
            label={t('entreprise.fields.telephone')}
            value={values.telephone}
            onChangeText={(v) => update('telephone', v)}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('entreprise.fields.adresse')}
            value={values.adresse}
            onChangeText={(v) => update('adresse', v)}
          />
          <TextField
            label={t('entreprise.fields.ville')}
            value={values.ville}
            onChangeText={(v) => update('ville', v)}
          />
          <TextField
            label={t('entreprise.fields.pays')}
            value={values.pays}
            onChangeText={(v) => update('pays', v)}
          />
          <TextField
            label={t('entreprise.fields.devise')}
            value={values.devise}
            onChangeText={(v) => update('devise', v)}
          />

          {feedback ? (
            <ThemedText type="small" style={{ color: feedback.type === 'success' ? '#15803D' : '#DC2626' }}>
              {feedback.message}
            </ThemedText>
          ) : null}

          <Button
            label={updateDetails.isPending ? t('entreprise.saving') : t('entreprise.save')}
            onPress={handleSave}
            disabled={updateDetails.isPending}
            loading={updateDetails.isPending}
            style={{ marginTop: 8 }}
          />
        </>
      ) : (
        <View className="rounded-3xl border border-line bg-white px-4">
          <InfoRow label={t('entreprise.fields.nom')} value={values.nom || '—'} />
          <InfoRow label={t('entreprise.fields.raisonSociale')} value={values.raisonSociale || '—'} />
          <InfoRow label={t('entreprise.fields.email')} value={values.email || '—'} />
          <InfoRow label={t('entreprise.fields.telephone')} value={values.telephone || '—'} />
          <InfoRow label={t('entreprise.fields.adresse')} value={values.adresse || '—'} />
          <InfoRow label={t('entreprise.fields.ville')} value={values.ville || '—'} />
          <InfoRow label={t('entreprise.fields.pays')} value={values.pays} />
          <View className="flex-row items-center justify-between py-3">
            <ThemedText type="default" themeColor="textSecondary">
              {t('entreprise.fields.devise')}
            </ThemedText>
            <ThemedText type="smallBold">{values.devise}</ThemedText>
          </View>
        </View>
      )}

      <AgencyStampSettings key={`${details.stampPath ?? ''}|${JSON.stringify(details.stampConfig)}`} agencyId={agencyId} isOwner={isOwner} details={details} />
      <DocumentReadingSettings agencyId={agencyId} isOwner={isOwner} />
      <AiInsightsSettings agencyId={agencyId} isOwner={isOwner} />
      <AiChatSettings agencyId={agencyId} isOwner={isOwner} />

      {isOwner ? (
        <Button
          label={t('contractTemplate.open')}
          variant="secondary"
          icon="document-text-outline"
          onPress={() => router.push('/entreprise/editeur-contrat')}
        />
      ) : null}

      {isOwner ? (
        <Button
          label={t('entreprise.departurePolicy.open')}
          variant="secondary"
          icon="shield-checkmark-outline"
          onPress={() => router.push('/entreprise/depart')}
        />
      ) : null}

      {!isOwner ? (
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {t('entreprise.readOnlyHint')}
        </ThemedText>
      ) : null}
    </ScrollView>
  );
}
