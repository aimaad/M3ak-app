import type { RentalFormErrors } from './validation';

/** Étapes de la création d'une location : une question à la fois, dans cet ordre. */
export type WizardStepKey = 'dates' | 'vehicule' | 'client' | 'conducteurs' | 'prix' | 'recap';

/**
 * Dans l'ordre d'une vraie demande au comptoir : « je voudrais une voiture du … au … » → on saisit d'abord les DATES,
 * on propose seulement les voitures LIBRES à ces dates, puis on choisit le client, les conducteurs et le prix.
 */
export const WIZARD_STEPS: WizardStepKey[] = ['dates', 'vehicule', 'client', 'conducteurs', 'prix', 'recap'];

/** Erreurs de validation qui concernent chaque étape (les conducteurs sont facultatifs ; le récapitulatif reprend tout). */
const STEP_FIELDS: Record<WizardStepKey, (keyof RentalFormErrors)[]> = {
  client: ['customerId'],
  vehicule: ['vehicleId'],
  dates: ['dates'],
  conducteurs: [],
  prix: ['fraisSupplementaires', 'remiseMontant', 'acomptePrevu', 'cautionMontant'],
  recap: ['customerId', 'vehicleId', 'dates', 'fraisSupplementaires', 'remiseMontant', 'acomptePrevu', 'cautionMontant'],
};

export function stepErrorKeys(step: WizardStepKey, errors: RentalFormErrors): (keyof RentalFormErrors)[] {
  return STEP_FIELDS[step].filter((field) => errors[field] !== undefined);
}

export function isStepValid(step: WizardStepKey, errors: RentalFormErrors): boolean {
  return stepErrorKeys(step, errors).length === 0;
}

/** Première étape à corriger (pour revenir dessus depuis le récapitulatif), ou null si tout est valide. */
export function firstInvalidStep(errors: RentalFormErrors): WizardStepKey | null {
  return WIZARD_STEPS.find((step) => step !== 'recap' && !isStepValid(step, errors)) ?? null;
}

/** On ne peut ouvrir une étape que si toutes les précédentes sont valides. */
export function canReachStep(target: WizardStepKey, errors: RentalFormErrors): boolean {
  const index = WIZARD_STEPS.indexOf(target);
  return WIZARD_STEPS.slice(0, index).every((step) => isStepValid(step, errors));
}
