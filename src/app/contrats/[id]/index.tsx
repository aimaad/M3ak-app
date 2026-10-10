import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { generateContractPdf } from '@/features/contracts/contract-pdf';
import { ContractStatusBadge } from '@/features/contracts/contract-status-badge';
import { useCancelContract, useContract, useMarkReadyToSign, useSignContract, useUploadContractPdf } from '@/features/contracts/hooks';
import { useRental } from '@/features/rentals/hooks';
import { useLanguage } from '@/i18n/use-language';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#e1e5f0] py-3">
      <ThemedText type="default" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

export default function ContratDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { data: contract, isLoading, isError } = useContract(id);
  const { data: rental } = useRental(contract?.rentalId);
  const markReadyToSign = useMarkReadyToSign();
  const signContract = useSignContract();
  const cancelContract = useCancelContract();
  const uploadPdf = useUploadContractPdf();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function handleGeneratePdf() {
    if (!contract || !agencyQuery.data) return;
    setPdfError(null);
    setIsGeneratingPdf(true);
    try {
      const localUri = await generateContractPdf(contract, agencyQuery.data.agencyName);
      await uploadPdf.mutateAsync({ agencyId: contract.agencyId, contractId: contract.id, localUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : t('contract.pdfError'));
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  function handleCancel() {
    if (!contract) return;
    Alert.alert(t('contract.cancelAction'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('contract.cancelAction'),
        style: 'destructive',
        onPress: () => cancelContract.mutate(contract.id),
      },
    ]);
  }

  function handleSign() {
    if (!contract) return;
    Alert.alert(t('contract.signConfirmTitle'), t('contract.signConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('contract.signAction'),
        onPress: () =>
          signContract.mutate(contract.id, {
            onError: () => Alert.alert(t('common.appName'), t('contract.signError')),
          }),
      },
    ]);
  }

  if (isLoading || isError || !contract) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('contract.detailsTitle')} showBack />
          <View className="flex-1 items-center justify-center px-8">
            {isLoading ? (
              <ActivityIndicator color="#1f5eff" />
            ) : (
              <ThemedText type="default" themeColor="textSecondary" className="text-center">
                {isError ? t('contract.loadError') : t('contract.notFound')}
              </ThemedText>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const canMarkReady = contract.statut === 'preparation';
  const canSign = contract.statut === 'pret_a_signer';
  const canCancel = contract.statut === 'preparation' || contract.statut === 'pret_a_signer' || contract.statut === 'signe';

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={contract.numero} showBack />

        <ScrollView contentContainerClassName="gap-6 px-6 pb-10">
          <ContractStatusBadge status={contract.statut} />

          <View className="rounded-3xl border border-[#e1e5f0] bg-white px-4">
            <InfoRow label={t('locations.vehicle')} value={`${contract.vehicleMarque} ${contract.vehicleModele} · ${contract.vehicleImmatriculation}`} />
            <InfoRow label={t('locations.customer')} value={contract.customerNom} />
            {contract.driverNom ? <InfoRow label={t('locations.driver')} value={contract.driverNom} /> : null}
            <InfoRow label={t('locations.period')} value={`${formatDateTime(contract.dateDebutPrevue)} → ${formatDateTime(contract.dateFinPrevue)}`} />
            <InfoRow label={t('locations.prixTotal')} value={contract.prixTotal != null ? `${contract.prixTotal.toLocaleString('fr-FR')} MAD` : '—'} />
            <View className="flex-row items-center justify-between py-3">
              <ThemedText type="default" themeColor="textSecondary">
                {t('locations.cautionBlocked')}
              </ThemedText>
              <ThemedText type="smallBold">{`${contract.cautionMontant.toLocaleString('fr-FR')} MAD`}</ThemedText>
            </View>
          </View>

          {contract.conditionsParticulieres ? (
            <View className="gap-2">
              <ThemedText type="smallBold">{t('contract.fields.conditionsParticulieres')}</ThemedText>
              <View className="rounded-3xl border border-[#e1e5f0] bg-white p-4">
                <ThemedText type="default">{contract.conditionsParticulieres}</ThemedText>
              </View>
            </View>
          ) : null}

          {contract.signedAt ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('contract.signedOn', { date: formatDateTime(contract.signedAt) })}
            </ThemedText>
          ) : null}

          <View className="gap-2">
            {canMarkReady ? (
              <Pressable
                onPress={() => markReadyToSign.mutate(contract.id)}
                disabled={markReadyToSign.isPending}
                className="items-center rounded-2xl bg-[#1f5eff] px-4 py-4"
              >
                <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                  {t('contract.markReadyAction')}
                </ThemedText>
              </Pressable>
            ) : null}
            {canSign ? (
              <Pressable onPress={handleSign} disabled={signContract.isPending} className="items-center rounded-2xl bg-[#1f5eff] px-4 py-4">
                <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                  {t('contract.signAction')}
                </ThemedText>
              </Pressable>
            ) : null}
            {contract.statut === 'signe' && rental ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/locations/[id]/depart', params: { id: rental.id, vehicleId: rental.vehicleId } })
                }
                className="items-center rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
              >
                <ThemedText type="small" themeColor="primary">
                  {t('locations.startAction')}
                </ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleGeneratePdf}
              disabled={isGeneratingPdf}
              className="items-center rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
            >
              {isGeneratingPdf ? (
                <ActivityIndicator color="#1f5eff" />
              ) : (
                <ThemedText type="small" themeColor="primary">
                  {contract.pdfPath ? t('contract.regeneratePdf') : t('contract.generatePdf')}
                </ThemedText>
              )}
            </Pressable>
            {pdfError ? (
              <ThemedText type="small" style={{ color: '#dc2626' }}>
                {pdfError}
              </ThemedText>
            ) : null}

            {canCancel ? (
              <Pressable onPress={handleCancel} className="items-center rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3">
                <ThemedText type="small" style={{ color: '#dc2626' }}>
                  {t('contract.cancelAction')}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
