/**
 * Modification des échéances sur place : suggestions de dates et de kilométrage (valeurs d'usage, toujours modifiables), validation, et
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

const addMonths = (now: Date, months: number) => {
  const date = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export type DueSuggestion = { date: string | null; km: number | null };

/** Intervalle habituel : 12 mois pour l'assurance et la visite ; vidange 10 000 km ou 12 mois ; freins 30 000 km ; pneus 40 000 km. */
export function dueSuggestion(type: MaintenanceType, vehicle: Pick<Vehicle, 'kilometrage'>, now: Date): DueSuggestion {
  switch (type) {
    case 'assurance':
    case 'visite_technique':
      return { date: addMonths(now, 12), km: null };
    case 'vidange':
      return { date: addMonths(now, 12), km: vehicle.kilometrage + 10_000 };
    case 'freins':
      return { date: null, km: vehicle.kilometrage + 30_000 };
    case 'pneus':
      return { date: null, km: vehicle.kilometrage + 40_000 };
    default:
      return { date: null, km: null };
  }
}

export type DueDraft = { date: string; km: string; notes: string };
export type DueErrors = Partial<Record<'date' | 'km', 'invalid_date' | 'invalid_number' | 'need_one'>>;

export const emptyDraft = (): DueDraft => ({ date: '', km: '', notes: '' });

export function draftOf(row: DueRow): DueDraft {
  return { date: fromIsoDate(row.date), km: row.targetKm != null ? String(row.targetKm) : '', notes: '' };
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
  if (!hasDate && !hasKm) errors.date = 'need_one';
  return errors;
}

export type DueSavePlan = {
  /** Entretien existant à mettre à jour. */
  updateItem: { id: string; echeanceDate: string | null; echeanceKm: number | null; notes: string | null } | null;
  /** Nouvelle échéance à créer (une ligne sans entretien et sans document). */
  createItem: { type: MaintenanceType; echeanceDate: string | null; echeanceKm: number | null; notes: string | null } | null;
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
  const hasDocument = DOCUMENT_TYPES.includes(row.type) && vehicle.documents.some((doc) => doc.type === row.type);
  const syncDocumentExpiry = hasDocument && echeanceDate ? { type: row.type, expiresAt: echeanceDate } : null;

  if (row.maintenanceId) return { updateItem: { id: row.maintenanceId, echeanceDate, echeanceKm, notes }, createItem: null, syncDocumentExpiry };
  if (hasDocument) return { updateItem: null, createItem: null, syncDocumentExpiry };
  return { updateItem: null, createItem: { type: row.type, echeanceDate, echeanceKm, notes }, syncDocumentExpiry: null };
}
