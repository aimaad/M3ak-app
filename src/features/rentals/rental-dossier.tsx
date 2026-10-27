import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { CollapsibleSection } from '@/components/collapsible-section';
import { ThemedText } from '@/components/themed-text';
import type { Contract } from '@/features/contracts/types';
import type { Deposit } from '@/features/deposits/types';
import { damageLine } from '@/features/inspections/damage-text';
import { useInspectionDamages } from '@/features/inspections/hooks';
import type { Inspection } from '@/features/inspections/types';
import type { Payment } from '@/features/payments/types';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

import { balanceDue, formatDelay, kmDriven } from './dossier';
import type { Rental } from './types';

const money = (value: number | null | undefined) => (value == null ? '—' : `${value.toLocaleString('fr-FR')} MAD`);
const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function Row({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <View className={`flex-row items-start justify-between gap-3 py-3 ${last ? '' : 'border-b border-[#E4DCF5]'}`}>
      <ThemedText type="default" themeColor="textSecondary" className="flex-shrink">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" className="max-w-[60%] text-end">
        {value}
      </ThemedText>
    </View>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} className="self-start py-1">
      <ThemedText type="small" themeColor="primary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

type Props = {
  rental: Rental;
  vehicle: Vehicle | null | undefined;
  contract: Contract | null | undefined;
  inspectionDepart: Inspection | null | undefined;
  inspectionRetour: Inspection | null | undefined;
  deposit: Deposit | null | undefined;
  payments: Payment[];
};

/** Dossier complet de la location, en lecture seule : voiture, conditions et paiement, état avant la location, retour. */
export function RentalDossier({ rental, vehicle, contract, inspectionDepart, inspectionRetour, deposit, payments }: Props) {
  const { t } = useLanguage();
  const departDamagesQuery = useInspectionDamages(inspectionDepart?.id);
  const retourDamagesQuery = useInspectionDamages(inspectionRetour?.id);

  const started = rental.statut === 'en_cours' || rental.statut === 'terminee';
  const finished = rental.statut === 'terminee';
  const paidTotal = payments.filter((payment) => payment.statut === 'paye').reduce((sum, payment) => sum + payment.montant, 0);
  const balance = balanceDue(rental.prixTotal, Math.max(paidTotal, rental.acomptePaye));

  const kmStart = rental.kmDepart ?? inspectionDepart?.kilometrage ?? null;
  const fuelStart = rental.carburantDepart ?? inspectionDepart?.niveauCarburant ?? null;
  const accessories = (contract?.accessoiresDepart ?? []).map((key) => t(`contract.accessory.${key}`)).join(', ');
  const returnAccessories = (contract?.accessoiresRetour ?? []).map((key) => t(`contract.accessory.${key}`)).join(', ');

  // Dommages existants avant la location : ceux que l'employé a confirmés à l'inspection de départ.
  const existingDamages = (departDamagesQuery.data ?? []).filter((damage) => damage.statut === 'confirme').map((damage) => damageLine(damage, t));
  const writtenExisting = contract?.snapshotValues?.dommages_depart;
  const newDamages = (retourDamagesQuery.data ?? []).filter((damage) => damage.statut === 'confirme' && damage.nouveau);
  const kms = kmDriven(rental.kmDepart, rental.kmRetour);
  const delay = formatDelay(contract?.retardMinutes);

  const openInspection = (type: 'depart' | 'retour') => router.push({ pathname: '/locations/[id]/inspection-analyse', params: { id: rental.id, type } });

  return (
    <View className="gap-3">
      <CollapsibleSection title={t('locations.dossier.vehicleSection')}>
        {vehicle ? (
          <>
            <Card padded={false} className="px-4">
              <Row label={t('locations.vehicle')} value={`${vehicle.marque} ${vehicle.modele}${vehicle.finition ? ` ${vehicle.finition}` : ''}`} />
              <Row label={t('vehicle.fields.immatriculation')} value={vehicle.immatriculation} />
              {vehicle.annee ? <Row label={t('vehicle.fields.annee')} value={String(vehicle.annee)} /> : null}
              {vehicle.couleur ? <Row label={t('vehicle.fields.couleur')} value={vehicle.couleur} /> : null}
              <Row label={t('vehicle.fields.carburant')} value={t(`vehicle.fuel.${vehicle.carburant}`)} />
              {vehicle.transmission ? <Row label={t('vehicle.fields.transmission')} value={t(`vehicle.transmission.${vehicle.transmission}`)} /> : null}
              {vehicle.nombrePlaces ? <Row label={t('vehicle.fields.nombrePlaces')} value={String(vehicle.nombrePlaces)} /> : null}
              <Row label={t('locations.dossier.currentKm')} value={`${vehicle.kilometrage.toLocaleString('fr-FR')} km`} />
              <Row label={t('locations.dossier.listPrice')} value={money(vehicle.prixJour)} last />
            </Card>
            <LinkButton label={t('locations.dossier.openVehicle')} onPress={() => router.push({ pathname: '/flotte/[id]', params: { id: vehicle.id } })} />
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('locations.dossier.none')}
          </ThemedText>
        )}
      </CollapsibleSection>

      <CollapsibleSection title={t('locations.dossier.paymentSection')}>
        <Card padded={false} className="px-4">
          <Row label={t('locations.period')} value={`${dateTime(rental.dateDebutPrevue)} → ${dateTime(rental.dateFinPrevue)}`} />
          {rental.dureeJours ? <Row label={t('locations.dossier.duration')} value={t('locations.priceBreakdown.duree', { count: rental.dureeJours })} /> : null}
          <Row label={t('locations.dossier.pricePerDay')} value={money(rental.prixJourApplique)} />
          <Row label={t('locations.priceBreakdown.sousTotal')} value={money(rental.sousTotal)} />
          {rental.fraisSupplementaires > 0 ? <Row label={t('locations.fraisSupplementaires')} value={money(rental.fraisSupplementaires)} /> : null}
          {rental.remiseMontant > 0 ? <Row label={t('locations.remiseMontant')} value={`− ${money(rental.remiseMontant)}`} /> : null}
          <Row label={t('locations.prixTotal')} value={money(rental.prixTotal)} />
          <Row label={t('locations.acomptePrevu')} value={money(rental.acomptePrevu)} />
          <Row label={t('locations.acomptePaye')} value={money(rental.acomptePaye)} />
          <Row label={t('locations.dossier.paymentStatus')} value={t(`locations.paymentStatus.${rental.statutPaiement}`)} />
          <Row label={t('locations.soldeRestant')} value={money(balance)} />
          <Row label={t('locations.cautionBlocked')} value={money(deposit?.montantBloque ?? rental.cautionMontant)} last={!deposit} />
          {deposit ? <Row label={t('locations.cautionRetained')} value={money(deposit.montantRetenu)} /> : null}
          {deposit ? <Row label={t('locations.cautionReturned')} value={money(deposit.montantRestitue)} last /> : null}
        </Card>
        {payments.length > 0 ? (
          <View className="gap-2">
            <ThemedText type="small" themeColor="textSecondary">
              {t('locations.paymentsSection')}
            </ThemedText>
            {payments.map((payment) => (
              <View key={payment.id} className="flex-row items-center justify-between">
                <ThemedText type="small">{`${t(`locations.paymentMethods.${payment.methode}`)} · ${dateTime(payment.datePaiement)}`}</ThemedText>
                <ThemedText type="smallBold">{money(payment.montant)}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        {contract ? <LinkButton label={t('locations.dossier.openContract')} onPress={() => router.push({ pathname: '/contrats/[id]', params: { id: contract.id } })} /> : null}
      </CollapsibleSection>

      <CollapsibleSection title={t('locations.dossier.beforeSection')}>
        {!started && !contract?.etatDepart && !inspectionDepart ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('locations.dossier.notDeparted')}
          </ThemedText>
        ) : (
          <>
            <Card padded={false} className="px-4">
              <Row label={t('locations.dossier.departedAt')} value={dateTime(rental.dateDepartReel)} />
              <Row label={t('locations.depart.kilometrage')} value={kmStart != null ? `${kmStart.toLocaleString('fr-FR')} km` : '—'} />
              <Row label={t('locations.depart.carburant')} value={fuelStart != null ? `${fuelStart} %` : '—'} />
              <Row label={t('contract.fields.etatGeneral')} value={contract?.etatDepart ? t(`contract.condition.${contract.etatDepart}`) : '—'} />
              <Row label={t('contract.fields.accessoires')} value={accessories || '—'} />
              <Row label={t('contract.fields.observations')} value={contract?.observationsDepart || '—'} last />
            </Card>
            <View className="gap-1">
              <ThemedText type="smallBold">{t('locations.dossier.existingDamages')}</ThemedText>
              {inspectionDepart?.skipped ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('locations.dossier.inspectionSkipped')}
                </ThemedText>
              ) : existingDamages.length === 0 && !writtenExisting ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('locations.dossier.noDamage')}
                </ThemedText>
              ) : (
                <>
                  {existingDamages.map((line) => (
                    <ThemedText key={line} type="small">{`• ${line}`}</ThemedText>
                  ))}
                  {writtenExisting && existingDamages.length === 0 ? <ThemedText type="small">{writtenExisting}</ThemedText> : null}
                </>
              )}
            </View>
            {inspectionDepart && !inspectionDepart.skipped ? <LinkButton label={t('locations.dossier.openInspectionDepart')} onPress={() => openInspection('depart')} /> : null}
          </>
        )}
      </CollapsibleSection>

      {finished || inspectionRetour || contract?.etatRetour ? (
        <CollapsibleSection title={t('locations.dossier.afterSection')} defaultOpen={finished}>
          <Card padded={false} className="px-4">
            <Row label={t('locations.dossier.returnedAt')} value={dateTime(rental.dateRetourReel)} />
            {delay ? <Row label={t('locations.dossier.lateBy')} value={delay} /> : null}
            <Row label={t('locations.dossier.kmReturn')} value={rental.kmRetour != null ? `${rental.kmRetour.toLocaleString('fr-FR')} km` : '—'} />
            {kms != null ? <Row label={t('locations.dossier.kmDriven')} value={`${kms.toLocaleString('fr-FR')} km`} /> : null}
            <Row label={t('locations.dossier.fuelReturn')} value={rental.carburantRetour != null ? `${rental.carburantRetour} %` : '—'} />
            <Row label={t('locations.dossier.returnCondition')} value={contract?.etatRetour ? t(`contract.condition.${contract.etatRetour}`) : '—'} />
            <Row label={t('contract.fields.accessoires')} value={returnAccessories || '—'} />
            <Row label={t('contract.fields.observations')} value={contract?.observationsRetour || '—'} last={!(contract && (contract.fraisRetardPropose || contract.fraisCarburantPropose))} />
            {contract?.fraisRetardPropose ? <Row label={t('locations.dossier.lateFee')} value={money(contract.fraisRetardPropose)} /> : null}
            {contract?.fraisCarburantPropose ? <Row label={t('locations.dossier.fuelFee')} value={money(contract.fraisCarburantPropose)} /> : null}
            {contract && (contract.fraisRetardPropose || contract.fraisCarburantPropose) ? (
              <Row label={t('locations.dossier.feesApplied')} value={contract.fraisAppliques ? t('common.yes') : t('common.no')} last />
            ) : null}
          </Card>
          <View className="gap-1">
            <ThemedText type="smallBold">{t('locations.dossier.newDamages')}</ThemedText>
            {inspectionRetour?.skipped ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('locations.dossier.inspectionSkipped')}
              </ThemedText>
            ) : newDamages.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('locations.dossier.noNewDamage')}
              </ThemedText>
            ) : (
              newDamages.map((damage) => (
                <ThemedText key={damage.id} type="small">{`• ${damageLine(damage, t)}${damage.coutValide != null ? ` — ${money(damage.coutValide)}` : ''}`}</ThemedText>
              ))
            )}
          </View>
          {inspectionRetour && !inspectionRetour.skipped ? <LinkButton label={t('locations.dossier.openInspectionRetour')} onPress={() => openInspection('retour')} /> : null}
        </CollapsibleSection>
      ) : null}
    </View>
  );
}
