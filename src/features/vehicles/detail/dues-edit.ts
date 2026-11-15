/**
 * Modification des échéances sur place : validation (aucune valeur prédéfinie : tout part vide), et
 * « plan d'enregistrement » (quoi modifier, créer ou synchroniser). Fonctions pures.
 */
import { parseFrDate } from '@/features/audit/types';
import type { MaintenanceType } from '@/features/maintenance/types';

import type { Vehicle } from '../types';
import { fromIsoDate, toIsoDate } from '../validation';
import type { DueRow } from './dues';

/** Types qu'on peut ajouter à la main (une panne est un incident, pas une échéance : elle se signale depuis l'entretien). */
export const ADDABLE_DUE_TYPES: MaintenanceType[] = ['vidange', 'freins', 'pneus', 'autre'];
const DOCUMENT_TYPES: MaintenanceType[] = ['assurance', 'visite_technique'];

/** `repeat` : « se répète » ; la périodicité se règle en km et/ou en mois (un seul des deux = l'autre est désactivé). Tout part VIDE : aucune valeur prédéfinie. */
export type DueDraft = { date: string; km: string; notes: string; repeat: boolean; repeatKm: string; repeatMonths: string };

/** Les types qu'on peut répéter (une panne n'est pas périodique). */
export const REPEATABLE_TYPES: MaintenanceType[] = ['vidange', 'freins', 'pneus', 'autre'];

export type DueErrors = Partial<Record<'date' | 'km' | 'repeatKm' | 'repeatMonths' | 'repeat', 'invalid_date' | 'invalid_number' | 'need_one' | 'need_one_repeat'>>;

export const emptyDraft = (): DueDraft => ({ date: '', km: '', notes: '', repeat: false, repeatKm: '', repeatMonths: '' });

export function draftOf(row: DueRow): DueDraft {
  return { date: fromIsoDate(row.date), km: row.targetKm != null ? String(row.targetKm) : '', notes: '', repeat: false, repeatKm: '', repeatMonths: '' };
}

/** Date JJ/MM/AAAA valide si renseignée ; kilométrage ≥ 0 ; au moins un des deux (sauf une panne, jamais ajoutée ici). */
export function validateDue(draft: DueDraft): DueErrors {
  const errors: DueErrors = {};
  const hasDate = draft.date.trim() !== '';
  const hasKm = draft.km.trim() !== '';
  if (hasDate && !parseFrDate(draft.date)) errors.date = 'invalid_date';
  if (hasKm) {
    const km = Number(draft.km);
    if (!Number.isFinite(km) || km < 0) errors.km = 'invalid_number';
  }
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
  }
  if (!hasDate && !hasKm) errors.date = 'need_one';
  return errors;
}

export type DueSavePlan = {
  /** Entretien existant à mettre à jour. */
  updateItem: { id: string; echeanceDate: string | null; echeanceKm: number | null; notes: string | null; repeatKm: number | null; repeatMonths: number | null } | null;
  /** Nouvelle échéance à créer (une ligne sans entretien et sans document). */
  createItem: { type: MaintenanceType; echeanceDate: string | null; echeanceKm: number | null; notes: string | null; repeatKm: number | null; repeatMonths: number | null } | null;
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
  const echeanceDate = toIsoDate(draft.date);
  const echeanceKm = draft.km.trim() ? Number(draft.km) : null;
  const notes = draft.notes.trim() || null;
  const repeatable = REPEATABLE_TYPES.includes(row.type) && draft.repeat;
  const repeatKm = repeatable && draft.repeatKm.trim() ? Number(draft.repeatKm) : null;
  const repeatMonths = repeatable && draft.repeatMonths.trim() ? Number(draft.repeatMonths) : null;
  const hasDocument = DOCUMENT_TYPES.includes(row.type) && vehicle.documents.some((doc) => doc.type === row.type);
  const syncDocumentExpiry = hasDocument && echeanceDate ? { type: row.type, expiresAt: echeanceDate } : null;

  if (row.maintenanceId) return { updateItem: { id: row.maintenanceId, echeanceDate, echeanceKm, notes, repeatKm, repeatMonths }, createItem: null, syncDocumentExpiry };
  if (hasDocument) return { updateItem: null, createItem: null, syncDocumentExpiry };
  return { updateItem: null, createItem: { type: row.type, echeanceDate, echeanceKm, notes, repeatKm, repeatMonths }, syncDocumentExpiry: null };
}
