import { router } from 'expo-router';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import type { AgencyRole } from '@/features/agency/types';
import { documentExpiryStatus } from '@/features/customers/documents';
import { useLanguage } from '@/i18n/use-language';

import {
  canConfirmCheck,
  confirmationState,
  departureErrorKey,
  issueMessageKey,
  summarizeCheck,
  type CheckSummary,
  type DepartureCheck,
  type DepartureParty,
} from './departure-check';
import { useConfirmDepartureCheck, useDepartureCheck } from './hooks';

const SUMMARY_COLORS: Record<CheckSummary, { bg: string; fg: string }> = {
  blocked: { bg: M3akPalette.dangerLight, fg: M3akPalette.danger },
  confirmation_needed: { bg: M3akPalette.warningLight, fg: M3akPalette.warning },
  ready_with_warnings: { bg: M3akPalette.warningLight, fg: M3akPalette.warning },
  ready: { bg: M3akPalette.successLight, fg: M3akPalette.success },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PartyCard({ party, customerId }: { party: DepartureParty; customerId: string }) {
  const { t } = useLanguage();

  return (
    <View className="gap-2 rounded-2xl border border-[#EAE5F2] bg-white p-3">
      <View className="flex-row items-center justify-between gap-2">
        <ThemedText type="smallBold" style={{ flex: 1 }}>
          {party.name}
        </ThemedText>
        <View className="rounded-full bg-[#EDE9FE] px-2 py-0.5">
          <ThemedText type="small" themeColor="primary" style={{ fontSize: 11 }}>
            {t(`locations.departureCheck.party.${party.kind}`)}
          </ThemedText>
        </View>
      </View>

      {party.documents.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('locations.departureCheck.noDocuments')}
        </ThemedText>
      ) : (
        party.documents.map((doc) => {
          const status = documentExpiryStatus({ expiresAt: doc.expiresAt });
          const color =
            status === 'expired' ? M3akPalette.danger : status === 'expiring_soon' ? M3akPalette.warning : '#81778F';
          return (
            <ThemedText key={doc.id} type="small" style={{ color }}>
              {`${t(`customer.documentTypes.${doc.type}`)} · ${
                doc.expiresAt ? t('locations.departureCheck.expiresOn', { date: formatDate(doc.expiresAt) }) : t('locations.departureCheck.noExpiry')
              }${doc.hasFile ? '' : ` · ${t('locations.departureCheck.noFile')}`}`}
            </ThemedText>
          );
        })
      )}

      {party.issues.map((issue) => (
        <View key={issue.code} className="flex-row items-start gap-2">
          <ThemedText type="small" style={{ color: issue.severity === 'blocking' ? M3akPalette.danger : M3akPalette.warning }}>
            {issue.severity === 'blocking' ? '●' : '▲'}
          </ThemedText>
          <ThemedText
            type="small"
            style={{ flex: 1, color: issue.severity === 'blocking' ? M3akPalette.danger : M3akPalette.warning }}
          >
            {t(issueMessageKey(issue))}
          </ThemedText>
        </View>
      ))}
      {party.issues.length === 0 ? (
        <ThemedText type="small" style={{ color: M3akPalette.success }}>
          {t('locations.departureCheck.nothingToReport')}
        </ThemedText>
      ) : null}

      <Button
        label={party.kind === 'client' ? t('locations.departureCheck.openCustomer') : t('locations.departureCheck.openDrivers')}
        variant="ghost"
        size="sm"
        onPress={() => router.push(`/clients/${customerId}`)}
      />
    </View>
  );
}

/**
 * Liste de contrôle avant départ : documents présents et manquants, dates d'expiration à vérifier,
 * confirmation humaine. Une photo n'est jamais une preuve de validité et l'OCR ne certifie rien :
 * seule la confirmation d'un employé autorisé atteste que le document original a été vérifié.
 */
export function DepartureChecklist({
  rentalId,
  customerId,
  role,
}: {
  rentalId: string;
  customerId: string;
  role: AgencyRole | null;
}) {
  const { t } = useLanguage();
  const checkQuery = useDepartureCheck(rentalId);
  const confirm = useConfirmDepartureCheck(rentalId);

  if (checkQuery.isLoading) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator color={M3akPalette.mauve} />
      </View>
    );
  }
  if (checkQuery.isError || !checkQuery.data) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {t('locations.departureCheck.loadError')}
      </ThemedText>
    );
  }

  const check: DepartureCheck = checkQuery.data;
  const summary = summarizeCheck(check);
  const state = confirmationState(check);
  const colors = SUMMARY_COLORS[summary];

  async function handleConfirm() {
    try {
      await confirm.mutateAsync();
    } catch (error) {
      Alert.alert(t('common.appName'), t(departureErrorKey(error)));
    }
  }

  return (
    <View className="gap-3">
      <ThemedText type="smallBold">{t('locations.departureCheck.title')}</ThemedText>

      <View className="gap-1 rounded-2xl px-4 py-3" style={{ backgroundColor: colors.bg }}>
        <ThemedText type="smallBold" style={{ color: colors.fg }}>
          {t(`locations.departureCheck.summary.${summary}`)}
        </ThemedText>
        <ThemedText type="small" style={{ color: colors.fg }}>
          {check.enforced ? t('locations.departureCheck.enforced') : t('locations.departureCheck.informationOnly')}
        </ThemedText>
      </View>

      {check.parties.map((party) => (
        <PartyCard key={party.key + party.kind} party={party} customerId={customerId} />
      ))}

      {check.policy.requireManualConfirmation ? (
        <Card className="gap-2">
          <ThemedText type="smallBold">{t('locations.departureCheck.confirmationTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {state === 'confirmed' || state === 'stale'
              ? t(`locations.departureCheck.confirmation.${state}`, {
                  name: check.confirmation.confirmedByName ?? t('customer.documentsManager.unknownMember'),
                  date: check.confirmation.confirmedAt ? formatDate(check.confirmation.confirmedAt) : '—',
                })
              : t('locations.departureCheck.confirmation.pending')}
          </ThemedText>
          {canConfirmCheck(check, role) ? (
            <Button
              label={state === 'stale' ? t('locations.departureCheck.reconfirm') : t('locations.departureCheck.confirm')}
              onPress={handleConfirm}
              disabled={confirm.isPending}
              loading={confirm.isPending}
            />
          ) : check.blockingCount > 0 ? (
            <ThemedText type="small" style={{ color: M3akPalette.danger }}>
              {t('locations.departureCheck.fixBlockingFirst')}
            </ThemedText>
          ) : check.policy.confirmationRole === 'manager' && role === 'employee' && state !== 'confirmed' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('locations.departureCheck.managerOnly')}
            </ThemedText>
          ) : state !== 'confirmed' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {role ? t('locations.departureCheck.cannotConfirm') : t('locations.departureCheck.roleLoading')}
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
        {t('locations.departureCheck.disclaimer')}
      </ThemedText>
    </View>
  );
}
