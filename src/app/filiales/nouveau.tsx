import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { useCreateBranch } from '@/features/branches/hooks';
import { isBranchFormValid, validateBranchForm, type BranchFormValues } from '@/features/branches/validation';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_VALUES: BranchFormValues = { nom: '', ville: '', adresse: '' };

export default function NouvelleFilialeScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const createBranch = useCreateBranch(agencyQuery.data?.agencyId);

  const [values, setValues] = useState<BranchFormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validateBranchForm(values);

  function update<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setTouched(true);
    setSubmitError(null);
    if (!isBranchFormValid(errors)) return;

    try {
      await createBranch.mutateAsync({
        nom: values.nom.trim(),
        ville: values.ville.trim() || null,
        adresse: values.adresse.trim() || null,
      });
      router.back();
    } catch {
      setSubmitError(t('filiales.createError'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('filiales.form.newTitle')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          <TextField
            label={t('filiales.fields.nom')}
            value={values.nom}
            onChangeText={(v) => update('nom', v)}
            error={touched && errors.nom ? t('filiales.errors.required') : undefined}
          />
          <TextField label={t('filiales.fields.ville')} value={values.ville} onChangeText={(v) => update('ville', v)} />
          <TextField
            label={t('filiales.fields.adresse')}
            value={values.adresse}
            onChangeText={(v) => update('adresse', v)}
          />

          {submitError ? (
            <ThemedText type="small" style={{ color: M3akPalette.danger }}>
              {submitError}
            </ThemedText>
          ) : null}

          <Button
            label={createBranch.isPending ? t('filiales.saving') : t('filiales.save')}
            onPress={handleSubmit}
            disabled={createBranch.isPending}
            loading={createBranch.isPending}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
