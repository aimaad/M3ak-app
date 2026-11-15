/**
 * Modification des échéances sur place : validation (aucune valeur prédéfinie : tout part vide), et
 * « plan d'enregistrement » (quoi modifier, créer ou synchroniser). Fonctions pures.
 */
import { parseFrDate } from '@/features/audit/types';
import { addMonths, daysUntil } from '@/features/compliance/logic';
import type { MaintenanceType } from '@/features/maintenance/types';

import type { Vehicle } from '../types';
import { fromIsoDate, toIsoDate } from '../validation';
import type { DueRow } from './dues';

/** Types qu'on peut ajouter à la main (une panne est un incident, pas une échéance : elle se signale depuis l'entretien). */
export const ADDABLE_DUE_TYPES: MaintenanceType[] = ['vidange', 'freins', 'pneus', 'autre'];
const DOCUMENT_TYPES: MaintenanceType[] = ['assurance', 'visite_technique'];

/** `repeat` : « se répète » ; la périodicité se règle en km et/ou en mois (un seul des deux = l'autre est désactivé). Tout part VIDE : aucune valeur prédéfinie. */
export type DueDraft = {
  /** Prochaine échéance saisie à la main (JJ/MM/AAAA et km) : prioritaire sur la valeur calculée. */
  date: string;
  km: string;
  notes: string;
  /** Nom de l'entretien : obligatoire pour « Autre » (« Courroie de distribution »). */
  titre: string;
  repeat: boolean;
  repeatKm: string;
  repeatMonths: string;
  /** Dernière fois faite (facultatif, seulement avec « se répète ») : la prochaine échéance s'en déduit. */
  lastDate: string;
  lastKm: string;
};

/** Les types qu'on peut répéter (une panne n'est pas périodique). */
export const REPEATABLE_TYPES: MaintenanceType[] = ['vidange', 'freins', 'pneus', 'autre'];

export type DueErrors = Partial<Record<'date' | 'km' | 'repeatKm' | 'repeatMonths' | 'repeat' | 'lastDate' | 'lastKm' | 'titre', 'invalid_date' | 'invalid_number' | 'need_one' | 'need_one_repeat' | 'required'>>;

export const emptyDraft = (): DueDraft => ({ date: '', km: '', notes: '', titre: '', repeat: false, repeatKm: '', repeatMonths: '', lastDate: '', lastKm: '' });

export function draftOf(row: DueRow): DueDraft {
  return { ...emptyDraft(), date: fromIsoDate(row.date), km: row.targetKm != null ? String(row.targetKm) : '' };
}

/**
 * Prochaine échéance EFFECTIVE : celle saisie à la main si elle est renseignée, sinon celle calculée depuis « dernière fois faite » +
 * périodicité (dernier km + tous les N km ; dernière date + tous les N mois). Tout est facultatif : rien n'est jamais prédéfini.
 */
export function computeNext(draft: DueDraft): { date: string | null; km: number | null } {
  if (!draft.repeat) return { date: null, km: null };
  const lastKm = draft.lastKm.trim() ? Number(draft.lastKm) : null;
  const repeatKm = draft.repeatKm.trim() ? Number(draft.repeatKm) : null;
  const lastDate = toIsoDate(draft.lastDate);
  const repeatMonths = draft.repeatMonths.trim() ? Number(draft.repeatMonths) : null;
  return {
    km: lastKm !== null && repeatKm !== null && Number.isFinite(lastKm) && Number.isFinite(repeatKm) ? lastKm + repeatKm : null,
    date: lastDate && repeatMonths !== null && Number.isFinite(repeatMonths) ? addMonths(lastDate, repeatMonths) : null,
  };
}

export function effectiveDue(draft: DueDraft): { date: string | null; km: number | null; dateComputed: boolean; kmComputed: boolean } {
  const manualDate = toIsoDate(draft.date);
  const manualKm = draft.km.trim() ? Number(draft.km) : null;
  const next = computeNext(draft);
  return { date: manualDate ?? next.date, km: manualKm ?? next.km, dateComputed: manualDate === null && next.date !== null, kmComputed: manualKm === null && next.km !== null };
}

/** Alerte NON bloquante : l'échéance qu'on vient d'indiquer est déjà dépassée (kilométrage du véhicule, ou date passée). */
export function dueAlreadyPassed(effective: { date: string | null; km: number | null }, vehicleKm: number, now: Date): { km: number | null; days: number | null } | null {
  const kmOver = effective.km !== null && vehicleKm > 0 && effective.km <= vehicleKm ? vehicleKm - effective.km : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const daysOver = effective.date !== null ? -daysUntil(effective.date, today) : null;
  const dateOver = daysOver !== null && daysOver > 0 ? daysOver : null;
  return kmOver !== null || dateOver !== null ? { km: kmOver, days: dateOver } : null;
}

/** Date JJ/MM/AAAA valide si renseignée ; kilométrage ≥ 0 ; au moins une échéance (saisie OU calculée) ; un nom pour « Autre ». */
export function validateDue(draft: DueDraft, type?: MaintenanceType): DueErrors {
  const errors: DueErrors = {};
  if (draft.date.trim() !== '' && !parseFrDate(draft.date)) errors.date = 'invalid_date';
  if (draft.km.trim() !== '') {
    const km = Number(draft.km);
    if (!Number.isFinite(km) || km < 0) errors.km = 'invalid_number';
  }
  if (type === 'autre' && draft.titre.trim() === '') errors.titre = 'required';
  if (draft.repeat) {
    const hasKm = draft.repeatKm.trim() !== '';
    const hasMonths = draft.repeatMonths.trim() !== '';
    if (!hasKm && !hasMonths) errors.repeat = 'need_one_repeat';
    if (hasKm) {
      const repeat = Number(draft.repeatKm);
      if (!Number.isInteger(repeat) || repeat < 1 || repeat > 1_000_000) errors.repeatKm = 'invalid_number';
    }
    if (hasMonths) {
      const months = Number(draft.repeatMonths);
      if (!Number.isInteger(months) || months < 1 || months > 120) errors.repeatMonths = 'invalid_number';
    }
    if (draft.lastDate.trim() !== '' && !parseFrDate(draft.lastDate)) errors.lastDate = 'invalid_date';
    if (draft.lastKm.trim() !== '') {
      const lastKm = Number(draft.lastKm);
      if (!Number.isFinite(lastKm) || lastKm < 0) errors.lastKm = 'invalid_number';
    }
  }
  const effective = effectiveDue(draft);
  if (!errors.date && !errors.km && effective.date === null && effective.km === null) errors.date = 'need_one';
  return errors;
}

export type DueSavePlan = {
  /** Entretien existant à mettre à jour. */
  updateItem: { id: string; echeanceDate: string | null; echeanceKm: number | null; notes: string | null; titre: string | null; repeatKm: number | null; repeatMonths: number | null } | null;
  /** Nouvelle échéance à créer (une ligne sans entretien et sans document). */
  createItem: { type: MaintenanceType; echeanceDate: string | null; echeanceKm: number | null; notes: string | null; titre: string | null; repeatKm: number | null; repeatMonths: number | null } | null;
  /** Date d'expiration à reporter sur le document (assurance, visite technique) pour que les deux restent d'accord. */
  syncDocumentExpiry: { type: MaintenanceType; expiresAt: string } | null;
};

/**
 * Que faire à l'enregistrement d'une ligne :
 *  - elle vient d'un entretien → on le met à jour ;
 *  - elle ne vient que d'un document (assurance, visite) → on met à jour la date du document ;
 *  - elle n'a aucune source → on crée l'échéance.
 * Quand un document existe pour l'assurance ou la visite, sa date suit toujours, pour qu'il ne reste pas une vieille date « expirée ».
 */
export function planDueSave(row: Pick<DueRow, 'type' | 'maintenanceId'>, vehicle: Pick<Vehicle, 'documents'>, draft: DueDraft): DueSavePlan {
  const effective = effectiveDue(draft);
  const echeanceDate = effective.date;
  const echeanceKm = effective.km;
  const notes = draft.notes.trim() || null;
  const titre = row.type === 'autre' ? draft.titre.trim() || null : null;
  const repeatable = REPEATABLE_TYPES.includes(row.type) && draft.repeat;
  const repeatKm = repeatable && draft.repeatKm.trim() ? Number(draft.repeatKm) : null;
  const repeatMonths = repeatable && draft.repeatMonths.trim() ? Number(draft.repeatMonths) : null;
  const hasDocument = DOCUMENT_TYPES.includes(row.type) && vehicle.documents.some((doc) => doc.type === row.type);
  const syncDocumentExpiry = hasDocument && echeanceDate ? { type: row.type, expiresAt: echeanceDate } : null;

  if (row.maintenanceId) return { updateItem: { id: row.maintenanceId, echeanceDate, echeanceKm, notes, titre, repeatKm, repeatMonths }, createItem: null, syncDocumentExpiry };
  if (hasDocument) return { updateItem: null, createItem: null, syncDocumentExpiry };
  return { updateItem: null, createItem: { type: row.type, echeanceDate, echeanceKm, notes, titre, repeatKm, repeatMonths }, syncDocumentExpiry: null };
}
