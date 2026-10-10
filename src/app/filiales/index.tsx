import { router } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { useBranches, useDeleteBranch } from '@/features/branches/hooks';
import { useLanguage } from '@/i18n/use-language';

export default function FilialesScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const branchesQuery = useBranches(agencyQuery.data?.agencyId);
  const deleteBranch = useDeleteBranch(agencyQuery.data?.agencyId);

  const isManager = agencyQuery.data?.role === 'owner' || agencyQuery.data?.role === 'manager';

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
          {isManager ? (
            <Button label={t('filiales.addAction')} onPress={() => router.push('/filiales/nouveau')} />
          ) : null}

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
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
