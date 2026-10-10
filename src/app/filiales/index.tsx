import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Card, PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useBranches, useCreateBranch, useDeleteBranch } from '@/features/branches/hooks';
import { isBranchFormValid, validateBranchForm, type BranchFormValues } from '@/features/branches/validation';
import { useMyAgency } from '@/features/agency/hooks';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_VALUES: BranchFormValues = { nom: '', ville: '', adresse: '' };

export default function FilialesScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const branchesQuery = useBranches(agencyQuery.data?.agencyId);
  const createBranch = useCreateBranch(agencyQuery.data?.agencyId);
  const deleteBranch = useDeleteBranch(agencyQuery.data?.agencyId);

  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState<BranchFormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState(false);

  const errors = validateBranchForm(values);
  const isManager = agencyQuery.data?.role === 'owner' || agencyQuery.data?.role === 'manager';

  function update<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate() {
    setTouched(true);
    if (!isBranchFormValid(errors)) return;

    try {
      await createBranch.mutateAsync({
        nom: values.nom.trim(),
        ville: values.ville.trim() || null,
        adresse: values.adresse.trim() || null,
      });
      setValues(EMPTY_VALUES);
      setTouched(false);
      setShowForm(false);
    } catch {
      Alert.alert(t('common.appName'), t('filiales.createError'));
    }
  }

  function handleDelete(id: string, nom: string) {
    Alert.alert(t('filiales.deleteConfirmTitle', { nom }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('filiales.delete'),
        style: 'destructive',
        onPress: () => {
          deleteBranch.mutate(id, {
            onError: () => Alert.alert(t('common.appName'), t('filiales.deleteError')),
          });
        },
      },
    ]);
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('filiales.title')} subtitle={t('filiales.subtitle')} showBack />

        <ScrollView contentContainerClassName="gap-4 px-6 pb-10">
          {(branchesQuery.data ?? []).length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('filiales.empty')}
            </ThemedText>
          ) : (
            <View className="gap-2">
              {(branchesQuery.data ?? []).map((branch) => (
                <PressableCard
                  key={branch.id}
                  onPress={isManager ? () => handleDelete(branch.id, branch.nom) : undefined}
                  disabled={!isManager}
                  padded={false}
                  className="flex-row items-center justify-between px-4 py-3"
                >
                  <View className="gap-0.5">
                    <ThemedText type="smallBold">{branch.nom}</ThemedText>
                    {branch.ville ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {branch.ville}
                      </ThemedText>
                    ) : null}
                  </View>
                  {isManager ? (
                    <ThemedText type="small" style={{ color: '#DC2626' }}>
                      {t('filiales.delete')}
                    </ThemedText>
                  ) : null}
                </PressableCard>
              ))}
            </View>
          )}

          {isManager ? (
            showForm ? (
              <Card className="gap-3">
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
                <View className="flex-row gap-2">
                  <Button
                    label={t('common.cancel')}
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setShowForm(false);
                      setValues(EMPTY_VALUES);
                      setTouched(false);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={createBranch.isPending ? t('filiales.saving') : t('filiales.save')}
                    size="sm"
                    onPress={handleCreate}
                    disabled={createBranch.isPending}
                    loading={createBranch.isPending}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ) : (
              <Button label={t('filiales.addAction')} variant="secondary" onPress={() => setShowForm(true)} />
            )
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
