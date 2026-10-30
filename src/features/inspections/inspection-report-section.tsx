import * as Print from 'expo-print';
import { canPrintInBrowser, printHtmlInBrowser } from '@/lib/print-html';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useAgencyDetails, useMyAgency } from '@/features/agency/hooks';
import { useCustomer } from '@/features/customers/hooks';
import { useDeposit, useResolveDeposit } from '@/features/deposits/hooks';
import { resolveDeposit } from '@/features/deposits/resolution';
import { useRental } from '@/features/rentals/hooks';
import { loadImageForPdf } from '@/features/storage/api';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

import { chargeableDamages, totalCharge, type Damage } from './damages';
import { parseCost } from './damage-editor';
import { useInspectionForRental, useInspectionPhotos } from './hooks';
import { buildReportHtml, toWhatsappNumber, whatsappMessage, type ReportPhoto } from './report';
import type { Inspection, PhotoAngle } from './types';

const PHOTOS_BUCKET = 'inspection-photos';
/** Au plus 6 angles avec photos dans le PDF : assez de preuves, un fichier qui reste léger à partager. */
const MAX_EVIDENCE_ANGLES = 6;

type Props = { rentalId: string; damages: Damage[]; pendingCount: number; inspection: Inspection };

const mad = (amount: number) => `${Math.round(amount).toLocaleString('fr-FR')} MAD`;

/**
 * Fin de l'inspection de retour : retenue sur la caution (proposée par l'IA, validée ou corrigée par l'employé) puis
 * rapport PDF partageable et message WhatsApp. Rien n'est retenu tant qu'il reste un nouveau dommage non décidé.
 */
export function InspectionReportSection({ rentalId, damages, pendingCount, inspection }: Props) {
  const { t, language } = useLanguage();
  const { data: rental } = useRental(rentalId);
  const { data: vehicle } = useVehicle(rental?.vehicleId);
  const { data: customer } = useCustomer(rental?.customerId);
  const { data: deposit } = useDeposit(rentalId);
  const resolve = useResolveDeposit();
  const membership = useMyAgency();
  const agencyId = membership.data?.agencyId;
  const agencyDetails = useAgencyDetails(agencyId);
  const departInspection = useInspectionForRental(rentalId, 'depart');
  const departPhotos = useInspectionPhotos(departInspection.data?.id);
  const retourPhotos = useInspectionPhotos(inspection.id);

  const proposed = totalCharge(damages);
  const [amountText, setAmountText] = useState<string | null>(null);
  const amount = amountText === null ? proposed : parseCost(amountText);
  const [busy, setBusy] = useState<'pdf' | 'validate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alreadyResolved = !!deposit && deposit.statut !== 'bloquee';
  const blockedByPending = pendingCount > 0;

  function validateDeduction() {
    if (!deposit || amount === null) return;
    const result = resolveDeposit(deposit.montantBloque, amount);
    Alert.alert(
      t('inspection.report.confirmTitle'),
      t('inspection.report.confirmBody', { retenue: mad(result.montantRetenu), restitue: mad(result.montantRestitue) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('inspection.report.confirmAction'),
          onPress: async () => {
            setBusy('validate');
            setError(null);
            try {
              await resolve.mutateAsync({ id: deposit.id, values: result });
            } catch {
              setError(t('inspection.report.validateError'));
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  function reportData(photos: ReportPhoto[]) {
    const details = agencyDetails.data;
    return {
      language: (language === 'ar' ? 'ar' : 'fr') as 'fr' | 'ar',
      agencyName: details?.nom ?? '',
      agencyPhone: details?.telephone ?? null,
      rentalNumber: rental?.numero ?? '',
      vehicleLabel: vehicle ? `${vehicle.marque} ${vehicle.modele}` : '',
      plate: vehicle?.immatriculation ?? '',
      customerName: customer?.nomComplet ?? '',
      dateInspection: inspection.dateInspection,
      kmDepart: rental?.kmDepart ?? null,
      kmRetour: rental?.kmRetour ?? inspection.kilometrage,
      fuelDepart: rental?.carburantDepart ?? departInspection.data?.niveauCarburant ?? null,
      fuelRetour: rental?.carburantRetour ?? inspection.niveauCarburant,
      damages,
      deposit: deposit ? { bloque: deposit.montantBloque, retenu: deposit.statut === 'bloquee' ? (amount ?? proposed) : deposit.montantRetenu } : null,
      photos,
      t: (key: string, options?: Record<string, unknown>) => t(key, options),
      formatDate: (iso: string) => new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR'),
    };
  }

  async function collectEvidence(): Promise<ReportPhoto[]> {
    const evidence = chargeableDamages(damages).filter((damage) => damage.angle);
    const angles = [...new Set(evidence.map((damage) => damage.angle as PhotoAngle))].slice(0, MAX_EVIDENCE_ANGLES);
    const photos: ReportPhoto[] = [];
    for (const angle of angles) {
      const retourPath = (retourPhotos.data ?? []).find((photo) => photo.angle === angle)?.url;
      const departPath = (departPhotos.data ?? []).find((photo) => photo.angle === angle)?.url;
      const [retour, depart] = await Promise.all([loadImageForPdf(PHOTOS_BUCKET, retourPath), loadImageForPdf(PHOTOS_BUCKET, departPath)]);
      if (retour || depart) photos.push({ angle, retour, depart });
    }
    return photos;
  }

  async function handleSharePdf() {
    setBusy('pdf');
    setError(null);
    try {
      const html = buildReportHtml(reportData(await collectEvidence()));
      if (canPrintInBrowser) {
        await printHtmlInBrowser(html);
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch {
      setError(t('inspection.report.pdfError'));
    } finally {
      setBusy(null);
    }
  }

  async function handleWhatsapp() {
    const phone = toWhatsappNumber(customer?.telephone);
    const message = whatsappMessage({
      agencyName: agencyDetails.data?.nom ?? '',
      vehicleLabel: vehicle ? `${vehicle.marque} ${vehicle.modele}` : '',
      plate: vehicle?.immatriculation ?? '',
      damages,
      deposit: deposit ? { bloque: deposit.montantBloque, retenu: deposit.statut === 'bloquee' ? (amount ?? proposed) : deposit.montantRetenu } : null,
      t: (key: string, options?: Record<string, unknown>) => t(key, options),
    });
    const url = `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      setError(t('inspection.report.whatsappError'));
    }
  }

  if (!rental) return <ActivityIndicator color={M3akPalette.mauve} />;

  return (
    <View className="gap-4">
      <Card className="gap-3">
        <ThemedText type="smallBold">{t('inspection.report.depositTitle')}</ThemedText>
        {!deposit ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('inspection.report.noDeposit', { amount: mad(proposed) })}
          </ThemedText>
        ) : (
          <>
            <View className="flex-row justify-between">
              <ThemedText type="small" themeColor="textSecondary">{t('inspection.report.depositBlocked')}</ThemedText>
              <ThemedText type="smallBold">{mad(deposit.montantBloque)}</ThemedText>
            </View>
            {alreadyResolved ? (
              <>
                <View className="flex-row justify-between">
                  <ThemedText type="small" themeColor="textSecondary">{t('inspection.report.deduction')}</ThemedText>
                  <ThemedText type="smallBold" style={{ color: '#B91C1C' }}>{`− ${mad(deposit.montantRetenu)}`}</ThemedText>
                </View>
                <View className="flex-row justify-between">
                  <ThemedText type="small" themeColor="textSecondary">{t('inspection.report.toRefund')}</ThemedText>
                  <ThemedText type="smallBold" style={{ color: '#15803D' }}>{mad(deposit.montantRestitue)}</ThemedText>
                </View>
                <ThemedText type="small" style={{ color: '#15803D' }}>
                  {t('inspection.report.validated')}
                </ThemedText>
              </>
            ) : (
              <>
                <TextField
                  label={t('inspection.report.deductionField', { proposed: mad(proposed) })}
                  value={amountText ?? String(proposed)}
                  onChangeText={setAmountText}
                  keyboardType="numeric"
                  error={amount === null ? t('vehicle.form.errors.invalid_number') : undefined}
                />
                <View className="flex-row justify-between">
                  <ThemedText type="small" themeColor="textSecondary">{t('inspection.report.toRefund')}</ThemedText>
                  <ThemedText type="smallBold" style={{ color: '#15803D' }}>
                    {mad(Math.max(deposit.montantBloque - (amount ?? 0), 0))}
                  </ThemedText>
                </View>
                {amount !== null && amount > deposit.montantBloque ? (
                  <ThemedText type="small" style={{ color: '#B45309' }}>
                    {t('inspection.report.exceedsDeposit', { excess: mad(amount - deposit.montantBloque) })}
                  </ThemedText>
                ) : null}
                {blockedByPending ? (
                  <ThemedText type="small" style={{ color: '#B45309' }}>
                    {t('inspection.analysis.summary.pendingDecision', { count: pendingCount })}
                  </ThemedText>
                ) : null}
                <Button
                  label={t('inspection.report.validate', { amount: mad(amount ?? 0) })}
                  disabled={blockedByPending || amount === null}
                  loading={busy === 'validate'}
                  onPress={validateDeduction}
                />
              </>
            )}
          </>
        )}
      </Card>

      <Card className="gap-3">
        <ThemedText type="smallBold">{t('inspection.report.title')}</ThemedText>
        {error ? (
          <ThemedText type="small" style={{ color: M3akPalette.danger }}>
            {error}
          </ThemedText>
        ) : null}
        <Button label={t('inspection.report.sharePdf')} icon="document-text-outline" loading={busy === 'pdf'} disabled={busy !== null} onPress={handleSharePdf} />
        <Button label={t('inspection.report.whatsapp.button')} variant="secondary" icon="logo-whatsapp" onPress={handleWhatsapp} />
        {!toWhatsappNumber(customer?.telephone) ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('inspection.report.whatsapp.noPhone')}
          </ThemedText>
        ) : null}
      </Card>
    </View>
  );
}
