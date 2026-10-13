import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { setCustomerCreationDraft } from '@/features/customers/customer-creation-draft';
import { EMPTY_CREATION_DRAFT } from '@/features/customers/licence-ocr';
import { useLanguage } from '@/i18n/use-language';

/** Point d'entrée de « Ajouter un client » : scanner le permis (mis en avant) ou saisir à la main. */
export default function NouveauClientChoixScreen() {
  const { t } = useLanguage();
  function goManual() {
    setCustomerCreationDraft(EMPTY_CREATION_DRAFT);
    router.push('/clients/nouveau/formulaire');
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('customer.form.newTitle')} subtitle={t('customer.create.subtitle')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10">
          <Card className="gap-3">
            <ThemedText type="smallBold">{t('customer.create.scanTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('customer.create.scanBody')}
            </ThemedText>
            <Button
              label={t('customer.create.scanButton')}
              icon="scan-outline"
              onPress={() => router.push('/clients/nouveau/scan')}
            />
          </Card>

          <Card className="gap-3">
            <ThemedText type="smallBold">{t('customer.create.manualTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('customer.create.manualBody')}
            </ThemedText>
            <Button label={t('customer.create.manualButton')} variant="secondary" icon="create-outline" onPress={goManual} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
