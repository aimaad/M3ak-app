/**
 * « Fait » en un geste : tout est déjà rempli (kilométrage de la fiche, date du jour) ; on confirme. Garage et coût sont facultatifs.
 * Fonctions pures (la validation et ce qui part au serveur).
 */
import type { Vehicle } from '../types';

export type QuickDoneDraft = { km: string; date: string; garage: string; cout: string };
export type QuickDoneErrors = Partial<Record<'km' | 'date' | 'cout', 'km_lower' | 'invalid_number' | 'future' | 'invalid_cost'>>;

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKeyOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function quickDoneDraft(vehicle: Pick<Vehicle, 'kilometrage'>, now: Date): QuickDoneDraft {
  return { km: vehicle.kilometrage > 0 ? String(vehicle.kilometrage) : '', date: dayKeyOf(now), garage: '', cout: '' };
}

/** Kilométrage entier, pas inférieur à celui de la fiche (il ne baisse jamais) ; date pas dans le futur ; coût positif. */
export function validateQuickDone(draft: QuickDoneDraft, vehicle: Pick<Vehicle, 'kilometrage'>, now: Date): QuickDoneErrors {
  const errors: QuickDoneErrors = {};
  if (draft.km.trim()) {
    const km = Number(draft.km);
    if (!Number.isInteger(km) || km < 0 || km > 2_000_000) errors.km = 'invalid_number';
    else if (km < vehicle.kilometrage) errors.km = 'km_lower';
  }
  if (draft.date > dayKeyOf(now)) errors.date = 'future';
  if (draft.cout.trim()) {
    const cost = Number(draft.cout.replace(',', '.'));
    if (!Number.isFinite(cost) || cost < 0) errors.cout = 'invalid_cost';
  }
  return errors;
}

/** Ce qui part au serveur ; le coût seulement pour ceux qui voient les montants (propriétaire, responsable). */
export function quickDoneInput(draft: QuickDoneDraft, showCost: boolean) {
  return {
    km: draft.km.trim() ? Number(draft.km) : null,
    date: draft.date || null,
    garage: draft.garage.trim() || null,
    cout: showCost && draft.cout.trim() ? Number(draft.cout.replace(',', '.')) : null,
  };
}
