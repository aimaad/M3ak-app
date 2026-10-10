import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  useAgencyDetails,
  useMyAgency,
  useUpdateAgencyDetails,
  useUploadAgencyLogo,
} from '@/features/agency/hooks';
import {
  isAgencyDetailsFormValid,
  toAgencyDetailsInput,
  validateAgencyDetailsForm,
  type AgencyDetailsFormValues,
} from '@/features/agency/validation';
import { AGENCY_ASSETS_BUCKET } from '@/features/agency/api';
import type { AgencyDetails } from '@/features/agency/types';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#EAE5F2] py-3">
      <ThemedText type="default" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
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
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
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
            <ActivityIndicator color="#7C3AED" />
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
  const uploadLogo = useUploadAgencyLogo();
  const { data: logoUrl } = useSignedUrl(AGENCY_ASSETS_BUCKET, details.logoUrl ?? undefined);

  const [values, setValues] = useState<AgencyDetailsFormValues>(() => valuesFromDetails(details));
  const [touched, setTouched] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const errors = validateAgencyDetailsForm(values);

  function update<K extends keyof AgencyDetailsFormValues>(key: K, value: AgencyDetailsFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setTouched(true);
    setFeedback(null);
    if (!isAgencyDetailsFormValid(errors)) return;

    try {
      await updateDetails.mutateAsync({ agencyId, input: toAgencyDetailsInput(values) });
      setFeedback({ type: 'success', message: t('entreprise.saveSuccess') });
    } catch {
      setFeedback({ type: 'error', message: t('entreprise.saveError') });
    }
  }

  async function handlePickLogo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;

    const uri = result.assets[0]?.uri;
    if (!uri) return;

    try {
      await uploadLogo.mutateAsync({ agencyId, localUri: uri });
    } catch {
      setFeedback({ type: 'error', message: t('entreprise.logoError') });
    }
  }

  return (
    <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
      {isOwner ? (
        <Pressable onPress={handlePickLogo} className="items-center gap-2">
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} className="h-24 w-24 rounded-2xl" resizeMode="cover" />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-2xl bg-[#FAF9FF]">
              <ThemedText type="title" themeColor="primary">
                {values.nom.charAt(0).toUpperCase() || '?'}
              </ThemedText>
            </View>
          )}
          <ThemedText type="small" themeColor="primary">
            {t('entreprise.logoChange')}
          </ThemedText>
        </Pressable>
      ) : logoUrl ? (
        <Image source={{ uri: logoUrl }} className="h-24 w-24 self-center rounded-2xl" resizeMode="cover" />
      ) : null}

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
        <View className="rounded-3xl border border-[#EAE5F2] bg-white px-4">
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

      {!isOwner ? (
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          {t('entreprise.readOnlyHint')}
        </ThemedText>
      ) : null}
    </ScrollView>
  );
}
