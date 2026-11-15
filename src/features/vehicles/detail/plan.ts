/**
 * Planifier une échéance : date et heure du rendez-vous (obligatoires), durée estimée et garage (facultatifs). Fonctions pures.
 * Durée inconnue : le serveur suppose 2 heures pour détecter les conflits.
 */
export type PlanDraft = { date: string; time: string; hours: string; garage: string };
export type PlanErrors = Partial<Record<'date' | 'time' | 'hours' | 'garage', 'required' | 'past' | 'invalid_number' | 'too_long'>>;

export const emptyPlanDraft = (): PlanDraft => ({ date: '', time: '', hours: '', garage: '' });

/** « 1,5 » → 90 minutes ; vide → null (facultatif). */
export function minutesOf(hours: string): number | null {
  const text = hours.trim().replace(',', '.');
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? Math.round(value * 60) : NaN;
}

const atOf = (date: string, time: string): Date => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

export function validatePlan(draft: PlanDraft, now: Date): PlanErrors {
  const errors: PlanErrors = {};
  if (!draft.date) errors.date = 'required';
  if (!draft.time) errors.time = 'required';
  if (draft.date && draft.time && atOf(draft.date, draft.time).getTime() < now.getTime() - 60 * 60 * 1000) errors.time = 'past';
  const minutes = minutesOf(draft.hours);
  if (minutes !== null && (Number.isNaN(minutes) || minutes < 5 || minutes > 10_080)) errors.hours = 'invalid_number';
  if (draft.garage.trim().length > 120) errors.garage = 'too_long';
  return errors;
}

export function planToInput(draft: PlanDraft) {
  return { at: atOf(draft.date, draft.time).toISOString(), minutes: minutesOf(draft.hours), garage: draft.garage.trim() || null };
}

/** Brouillon d'un rendez-vous déjà planifié (pour le modifier). */
export function draftFromPlanned(plannedAt: string, minutes: number | null | undefined, garage: string | null | undefined): PlanDraft {
  const date = new Date(plannedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    hours: minutes ? String(minutes / 60).replace('.', ',') : '',
    garage: garage ?? '',
  };
}
