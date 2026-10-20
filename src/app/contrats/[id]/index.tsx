import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAgencyDetails, useAgencyMembers, useMyAgency } from '@/features/agency/hooks';
import { useContractTemplate } from '@/features/contracts/template-hooks';
import { generateContractPdf } from '@/features/contracts/contract-pdf';
import { ContractStatusBadge } from '@/features/contracts/contract-status-badge';
import { useCancelContract, useContract, useMarkReadyToSign, useUploadContractPdf } from '@/features/contracts/hooks';
import { usePaymentsForRental } from '@/features/payments/hooks';
import { useRental } from '@/features/rentals/hooks';
import { AGENCY_ASSETS_BUCKET } from '@/features/agency/api';
import { loadImageForPdf } from '@/features/storage/api';
import { loadSignature } from '@/features/signatures/api';
import { useSignature } from '@/features/signatures/hooks';
import { SignatureView } from '@/features/signatures/signature-pad';
import { useLanguage } from '@/i18n/use-language';
import { friendlyErrorKey } from '@/lib/user-errors';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

export default function ContratDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { data: contract, isLoading, isError } = useContract(id);
  const { data: rental } = useRental(contract?.rentalId);
  const detailsQuery = useAgencyDetails(agencyQuery.data?.agencyId);
  const templateQuery = useContractTemplate(agencyQuery.data?.agencyId);
  const paymentsQuery = usePaymentsForRental(contract?.rentalId);
  const membersQuery = useAgencyMembers(agencyQuery.data?.agencyId);
  const clientSignature = useSignature(contract?.clientSignaturePath);
  const agencySignature = useSignature(contract?.agencySignaturePath);
  const markReadyToSign = useMarkReadyToSign();
  const cancelContract = useCancelContract();
  const uploadPdf = useUploadContractPdf();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function handleGeneratePdf() {
    if (!contract || !agencyQuery.data) return;
    setPdfError(null);
    setIsGeneratingPdf(true);
    try {
      const details = detailsQuery.data;
      const signer = membersQuery.data?.find((member) => member.userId === contract.signedBy);
      const [client, agency, stampDataUri, logoDataUri] = await Promise.all([
        loadSignature(contract.clientSignaturePath),
        loadSignature(contract.agencySignaturePath),
        loadImageForPdf(AGENCY_ASSETS_BUCKET, details?.stampPath).catch(() => null),
        loadImageForPdf(AGENCY_ASSETS_BUCKET, details?.logoUrl).catch(() => null),
      ]);
      // Le logo est obligatoire sur le contrat : on ne génère jamais un PDF sans lui en silence.
      if (!details?.logoUrl) {
        setPdfError(t('contract.logoMissingPdf'));
        return;
      }
      if (!logoDataUri) {
        setPdfError(t('contract.logoLoadError'));
        return;
      }
      const localUri = await generateContractPdf(
        contract,
        {
          nom: details?.nom ?? agencyQuery.data.agencyName,
          raisonSociale: details?.raisonSociale,
          adresse: details?.adresse,
          ville: details?.ville ?? agencyQuery.data.agencyCity,
          telephone: details?.telephone,
          email: details?.email,
        },
        { client, agency, stampDataUri, stampConfig: details?.stampConfig ?? null, logoDataUri, agencySignerName: signer?.nomComplet ?? null },
        templateQuery.data?.template,
        {
          payments: paymentsQuery.data,
          kmDepart: rental?.kmDepart,
          kmRetour: rental?.kmRetour,
          carburantDepart: rental?.carburantDepart,
        }
      );
      await uploadPdf.mutateAsync({ agencyId: contract.agencyId, contractId: contract.id, localUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch (error) {
      setPdfError(t(friendlyErrorKey(error, 'contract.pdfError')));
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

  if (isLoading || isError || !contract) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('contract.detailsTitle')} showBack />
          <View className="flex-1 items-center justify-center px-8">
            {isLoading ? (
              <ActivityIndicator color="#7C3AED" />
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

          <Card padded={false} className="px-4">
            <InfoRow label={t('locations.vehicle')} value={`${contract.vehicleMarque} ${contract.vehicleModele} · ${contract.vehicleImmatriculation}`} />
            <InfoRow label={t('locations.customer')} value={contract.customerNom} />
            {contract.driverNom ? <InfoRow label={t('locations.driver')} value={contract.driverNom} /> : null}
            {contract.autresConducteurs.length > 0 ? (
              <InfoRow label={t('contract.additionalDrivers')} value={contract.autresConducteurs.join(', ')} />
            ) : null}
            <InfoRow label={t('locations.period')} value={`${formatDateTime(contract.dateDebutPrevue)} → ${formatDateTime(contract.dateFinPrevue)}`} />
            <InfoRow label={t('locations.prixTotal')} value={contract.prixTotal != null ? `${contract.prixTotal.toLocaleString('fr-FR')} MAD` : '—'} />
            <View className="flex-row items-center justify-between py-3">
              <ThemedText type="default" themeColor="textSecondary">
                {t('locations.cautionBlocked')}
              </ThemedText>
              <ThemedText type="smallBold">{`${contract.cautionMontant.toLocaleString('fr-FR')} MAD`}</ThemedText>
            </View>
          </Card>

          {contract.conditionsParticulieres ? (
            <View className="gap-2">
              <ThemedText type="smallBold">{t('contract.fields.conditionsParticulieres')}</ThemedText>
              <Card>
                <ThemedText type="default">{contract.conditionsParticulieres}</ThemedText>
              </Card>
            </View>
          ) : null}

          {contract.signedAt ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('contract.signedOn', { date: formatDateTime(contract.signedAt) })}
            </ThemedText>
          ) : null}

          {contract.clientSignaturePath ? (
            <View className="gap-2">
              <ThemedText type="smallBold">{t('contract.sign.signatures')}</ThemedText>
              <Card className="flex-row items-center justify-around gap-3">
                <View className="items-center gap-1">
                  {clientSignature.data ? <SignatureView signature={clientSignature.data} height={70} /> : <ActivityIndicator color="#7C3AED" />}
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('contract.sign.clientLabel')}
                  </ThemedText>
                </View>
                {contract.agencySignaturePath ? (
                  <View className="items-center gap-1">
                    {agencySignature.data ? <SignatureView signature={agencySignature.data} height={70} /> : <ActivityIndicator color="#7C3AED" />}
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('contract.sign.agencyLabel')}
                    </ThemedText>
                  </View>
                ) : null}
              </Card>
            </View>
          ) : null}

          <View className="gap-2">
            {canMarkReady ? (
              <Button
                label={t('contract.markReadyAction')}
                onPress={() => markReadyToSign.mutate(contract.id)}
                disabled={markReadyToSign.isPending}
                loading={markReadyToSign.isPending}
              />
            ) : null}
            {canSign ? (
              <Button
                label={t('contract.sign.start')}
                onPress={() => router.push({ pathname: '/contrats/[id]/signer', params: { id: contract.id } })}
              />
            ) : null}
            {contract.statut === 'signe' && rental ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('contract.nextStepHint')}
                </ThemedText>
                <Button
                  label={t('contract.continueRental')}
                  onPress={() => router.push({ pathname: '/locations/[id]', params: { id: rental.id } })}
                />
              </>
            ) : null}

            <Button
              label={contract.pdfPath ? t('contract.regeneratePdf') : t('contract.generatePdf')}
              variant="secondary"
              onPress={handleGeneratePdf}
              disabled={isGeneratingPdf}
              loading={isGeneratingPdf}
            />
            {pdfError ? (
              <ThemedText type="small" style={{ color: '#DC2626' }}>
                {pdfError}
              </ThemedText>
            ) : null}

            {canCancel ? <Button label={t('contract.cancelAction')} variant="danger" onPress={handleCancel} /> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
