import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import type { AgencyRole } from '@/features/agency/types';
import { ContractStatusBadge } from '@/features/contracts/contract-status-badge';
import type { Contract } from '@/features/contracts/types';
import { DepositResolveForm } from '@/features/deposits/deposit-resolve-form';
import type { Deposit } from '@/features/deposits/types';
import { useResumeInspection, useSkipInspection } from '@/features/inspections/hooks';
import { useInspectionPermissions } from '@/features/inspections/permissions';
import type { Inspection } from '@/features/inspections/types';
import { AddPaymentForm } from '@/features/payments/add-payment-form';
import type { Payment } from '@/features/payments/types';
import { useLanguage } from '@/i18n/use-language';

import type { DepartureCheck } from './departure-check';
import { DepartureChecklist } from './departure-checklist';
import { computeJourney, type JourneyStep, type JourneyStepKey, type JourneyStepStatus } from './journey';
import type { Rental } from './types';

type Props = {
  rental: Rental;
  role: AgencyRole | null;
  contract: Contract | null | undefined;
  inspectionDepart: Inspection | null | undefined;
  inspectionRetour: Inspection | null | undefined;
  deposit: Deposit | null | undefined;
  departureCheck: DepartureCheck | undefined;
  payments: Payment[];
  onConfirm: () => void;
  confirming: boolean;
};

const mad = (amount: number) => `${Math.round(amount).toLocaleString('fr-FR')} MAD`;

const COLORS: Record<JourneyStepStatus, { bg: string; fg: string }> = {
  done: { bg: M3akPalette.successLight, fg: M3akPalette.success },
  current: { bg: M3akPalette.mauve, fg: '#FFFFFF' },
  attention: { bg: M3akPalette.warningLight, fg: M3akPalette.warning },
  locked: { bg: '#F3F0FA', fg: '#B3A6C2' },
};

function Bullet({ status, number }: { status: JourneyStepStatus; number: number }) {
  const color = COLORS[status];
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: color.bg }}>
      <ThemedText type="smallBold" style={{ color: color.fg }}>
        {status === 'done' ? '✓' : status === 'attention' ? '!' : String(number)}
      </ThemedText>
    </View>
  );
}

/**
 * Parcours guidé d'une location : une seule étape à la fois est ouverte (celle à faire), les suivantes sont grisées
 * tant que la précédente n'est pas terminée. Avant le départ : confirmation, vérifications, contrat, inspection,
 * acompte, départ. Au retour : inspection, dommages, retour, caution.
 */
export function RentalJourney({ rental, role, contract, inspectionDepart, inspectionRetour, deposit, departureCheck, payments, onConfirm, confirming }: Props) {
  const { t } = useLanguage();
  const journey = computeJourney({
    rentalStatus: rental.statut,
    departureOk: departureCheck ? departureCheck.ok : null,
    departureEnforced: departureCheck?.enforced ?? false,
    contractStatus: contract?.statut ?? null,
    // Inspection de départ terminée ET « décidée » : ignorée, ou photos prises puis analysées / analyse déclinée.
    inspectionDepartDone:
      (inspectionDepart?.statut === 'terminee' || inspectionDepart?.statut === 'validee') && (inspectionDepart.skipped || inspectionDepart.analysisStatus !== 'aucune'),
    inspectionRetourDone: inspectionRetour?.statut === 'terminee' || inspectionRetour?.statut === 'validee',
    retourAnalyzed:
      !!inspectionRetour && (inspectionRetour.skipped || ['terminee', 'partielle', 'refusee'].includes(inspectionRetour.analysisStatus)),
    acomptePrevu: rental.acomptePrevu,
    acomptePaye: rental.acomptePaye,
    hasDeposit: !!deposit,
    depositOpen: deposit?.statut === 'bloquee',
  });
  const permissions = useInspectionPermissions(rental.agencyId);
  const skipDepart = useSkipInspection(rental.id, 'depart');
  const skipRetour = useSkipInspection(rental.id, 'retour');
  const resumeDepart = useResumeInspection(rental.id, 'depart');
  const resumeRetour = useResumeInspection(rental.id, 'retour');
  const [openKey, setOpenKey] = useState<JourneyStepKey | null | undefined>(undefined);
  if (journey.phase === 'annule' || journey.steps.length === 0) return null;

  // Par défaut, l'étape à faire est ouverte ; toucher une étape non verrouillée l'ouvre ou la ferme.
  const expanded = openKey === undefined ? journey.currentKey : openKey;
  const doneCount = journey.steps.filter((step) => step.status === 'done').length;
  const total = journey.steps.length;
  const allDone = doneCount === total;

  const goInspection = (type: 'depart' | 'retour') =>
    router.push({ pathname: type === 'depart' ? '/locations/[id]/inspection-depart' : '/locations/[id]/inspection-retour', params: { id: rental.id } });
  const goReport = (type: 'depart' | 'retour') => router.push({ pathname: '/locations/[id]/inspection-analyse', params: { id: rental.id, type } });
  const previousTitle = (index: number) => t(`locations.journey.steps.${journey.steps[Math.max(0, index - 1)].key}.title`);

  /** Ignorer l'inspection : aucune photo n'est prise ; on prévient que l'état de la voiture ne sera pas prouvé. */
  function confirmSkip(type: 'depart' | 'retour') {
    Alert.alert(t('locations.journey.skip.title'), t('locations.journey.skip.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('locations.journey.skip.confirm'),
        style: 'destructive',
        onPress: () => (type === 'depart' ? skipDepart : skipRetour).mutate({ agencyId: rental.agencyId, vehicleId: rental.vehicleId }),
      },
    ]);
  }

  function resume(type: 'depart' | 'retour') {
    const inspection = type === 'depart' ? inspectionDepart : inspectionRetour;
    if (!inspection) return goInspection(type);
    (type === 'depart' ? resumeDepart : resumeRetour).mutate(inspection.id, { onSuccess: () => goInspection(type) });
  }

  function summary(step: JourneyStep): string {
    const key = step.key;
    if (key === 'contract' && contract) return contract.numero;
    if (key === 'payment') return rental.acomptePrevu > 0 ? `${mad(rental.acomptePaye)} / ${mad(rental.acomptePrevu)}` : t('locations.journey.steps.payment.noneAsked');
    if (key === 'inspection' && inspectionDepart?.skipped) return t('locations.journey.skip.skippedShort');
    if (key === 'inspection_retour' && inspectionRetour?.skipped) return t('locations.journey.skip.skippedShort');
    if (key === 'inspection' && step.status === 'current' && inspectionDepart?.statut === 'terminee') return t('locations.journey.skip.decideShort');
    if (step.status === 'done') return t('locations.journey.done');
    if (step.status === 'attention') return t('locations.journey.attention');
    return '';
  }

  function body(step: JourneyStep) {
    switch (step.key) {
      case 'confirmation':
        return step.status === 'done' ? null : (
          <>
            <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.confirmation.help')}</ThemedText>
            <Button label={t('locations.confirmAction')} onPress={onConfirm} loading={confirming} />
          </>
        );
      case 'checks':
        return (
          <>
            <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.checks.help')}</ThemedText>
            <DepartureChecklist rentalId={rental.id} customerId={rental.customerId} role={role} />
          </>
        );
      case 'contract':
        return (
          <>
            {contract ? (
              <View className="flex-row items-center justify-between">
                <ThemedText type="small">{contract.numero}</ThemedText>
                <ContractStatusBadge status={contract.statut} />
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.contract.help')}</ThemedText>
            )}
            <Button
              label={t(contract ? (step.status === 'done' ? 'locations.journey.steps.contract.view' : 'locations.journey.steps.contract.open') : 'contract.createAction')}
              variant={step.status === 'done' ? 'secondary' : 'primary'}
              onPress={() => router.push(contract ? `/contrats/${contract.id}` : `/contrats/nouveau?rentalId=${rental.id}`)}
            />
          </>
        );
      case 'inspection':
        return (
          <>
            <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.inspection.help')}</ThemedText>
            {inspectionDepart?.skipped ? (
              <>
                <ThemedText type="small" style={{ color: M3akPalette.warning }}>{t('locations.journey.skip.skippedNote')}</ThemedText>
                <Button label={t('locations.journey.skip.doItAnyway')} variant="secondary" onPress={() => resume('depart')} loading={resumeDepart.isPending} />
              </>
            ) : inspectionDepart?.statut === 'terminee' || inspectionDepart?.statut === 'validee' ? (
              <Button
                label={step.status === 'done' ? t('inspection.openReport') : t('locations.journey.skip.decideAction')}
                variant={step.status === 'done' ? 'secondary' : 'primary'}
                onPress={() => goReport('depart')}
              />
            ) : (
              <>
                <Button label={t('locations.departInspectionRequired.action')} onPress={() => goInspection('depart')} />
                {permissions.canSkip ? (
                  <Button label={t('locations.journey.skip.action')} variant="ghost" size="sm" onPress={() => confirmSkip('depart')} loading={skipDepart.isPending} />
                ) : null}
              </>
            )}
          </>
        );
      case 'payment':
        return (
          <>
            <View className="flex-row items-center justify-between">
              <ThemedText type="small" themeColor="textSecondary">{t('locations.acomptePrevu')}</ThemedText>
              <ThemedText type="smallBold">{mad(rental.acomptePrevu)}</ThemedText>
            </View>
            <View className="flex-row items-center justify-between">
              <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.payment.paid')}</ThemedText>
              <ThemedText type="smallBold">{mad(rental.acomptePaye)}</ThemedText>
            </View>
            {payments.map((payment) => (
              <View key={payment.id} className="flex-row items-center justify-between">
                <ThemedText type="small">{t(`locations.paymentMethods.${payment.methode}`)}</ThemedText>
                <ThemedText type="small">{mad(payment.montant)}</ThemedText>
              </View>
            ))}
            {step.status === 'attention' ? (
              <ThemedText type="small" style={{ color: M3akPalette.warning }}>{t('locations.journey.steps.payment.notRequired')}</ThemedText>
            ) : null}
            <AddPaymentForm agencyId={rental.agencyId} rentalId={rental.id} />
          </>
        );
      case 'start':
        return (
          <>
            <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.start.help')}</ThemedText>
            <Button
              label={t('locations.startAction')}
              onPress={() => router.push({ pathname: '/locations/[id]/depart', params: { id: rental.id, vehicleId: rental.vehicleId } })}
            />
          </>
        );
      case 'inspection_retour':
        return (
          <>
            <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.inspection_retour.help')}</ThemedText>
            {inspectionRetour?.skipped ? (
              <>
                <ThemedText type="small" style={{ color: M3akPalette.warning }}>{t('locations.journey.skip.skippedNote')}</ThemedText>
                <Button label={t('locations.journey.skip.doItAnyway')} variant="secondary" onPress={() => resume('retour')} loading={resumeRetour.isPending} />
              </>
            ) : step.status === 'done' ? (
              <Button label={t('inspection.openReport')} variant="secondary" onPress={() => goReport('retour')} />
            ) : (
              <>
                <Button label={t('inspection.title.retour')} onPress={() => goInspection('retour')} />
                {permissions.canSkip ? (
                  <Button label={t('locations.journey.skip.action')} variant="ghost" size="sm" onPress={() => confirmSkip('retour')} loading={skipRetour.isPending} />
                ) : null}
              </>
            )}
          </>
        );
      case 'damages':
        return (
          <>
            <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.damages.help')}</ThemedText>
            <Button label={t('locations.journey.steps.damages.open')} variant={step.status === 'done' ? 'secondary' : 'primary'} onPress={() => goReport('retour')} />
          </>
        );
      case 'return':
        return step.status === 'done' ? null : (
          <>
            <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.return.help')}</ThemedText>
            <Button
              label={t('locations.completeAction')}
              onPress={() => router.push({ pathname: '/locations/[id]/retour', params: { id: rental.id, vehicleId: rental.vehicleId } })}
            />
          </>
        );
      case 'deposit':
        return deposit && deposit.statut === 'bloquee' && rental.statut === 'terminee' ? (
          <DepositResolveForm deposit={deposit} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">{t('locations.journey.steps.deposit.help')}</ThemedText>
        );
      default:
        return null;
    }
  }

  return (
    <View className="gap-3">
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <ThemedText type="smallBold">{t(`locations.journey.title.${journey.phase}`)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {allDone ? t('locations.journey.allDone') : t('locations.journey.progress', { done: doneCount, total })}
          </ThemedText>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-[#EAE5F2]">
          <View className="h-2 rounded-full" style={{ width: `${(doneCount / total) * 100}%`, backgroundColor: M3akPalette.mauve }} />
        </View>
      </View>

      {journey.steps.map((step, index) => {
        const locked = step.status === 'locked';
        const isOpen = !locked && expanded === step.key;
        const content = isOpen ? body(step) : null;
        return (
          <Card key={step.key} padded={false} className="overflow-hidden" style={{ opacity: locked ? 0.6 : 1, borderColor: step.status === 'current' ? M3akPalette.mauve : undefined, borderWidth: step.status === 'current' ? 1.5 : undefined }}>
            <Pressable
              className="flex-row items-center gap-3 px-4 py-3"
              accessibilityRole="button"
              disabled={locked}
              onPress={() => setOpenKey(isOpen ? null : step.key)}
            >
              <Bullet status={step.status} number={index + 1} />
              <View className="flex-1">
                <ThemedText type="smallBold">{t(`locations.journey.steps.${step.key}.title`)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                  {locked ? t('locations.journey.locked', { step: previousTitle(index) }) : summary(step) || t(`locations.journey.steps.${step.key}.short`)}
                </ThemedText>
              </View>
              {!locked ? <ThemedText type="small" themeColor="textSecondary">{isOpen ? '▲' : '▼'}</ThemedText> : null}
            </Pressable>
            {content ? <View className="gap-3 border-t border-[#EAE5F2] px-4 py-4">{content}</View> : null}
          </Card>
        );
      })}
    </View>
  );
}
