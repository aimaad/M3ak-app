export type RentalFormValues = {
  vehicleId: string;
  customerId: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  prixTotal: string;
  cautionMontant: string;
};

export type RentalFormErrorCode =
  | 'required'
  | 'invalid_date_range'
  | 'invalid_number'
  | 'conflict';

export type RentalFormErrors = Partial<
  Record<'vehicleId' | 'customerId' | 'dates' | 'prixTotal' | 'cautionMontant', RentalFormErrorCode>
>;

export function validateRentalForm(values: RentalFormValues, hasConflict: boolean): RentalFormErrors {
  const errors: RentalFormErrors = {};

  if (!values.vehicleId) errors.vehicleId = 'required';
  if (!values.customerId) errors.customerId = 'required';

  if (!values.dateDebutPrevue || !values.dateFinPrevue) {
    errors.dates = 'required';
  } else if (values.dateFinPrevue < values.dateDebutPrevue) {
    errors.dates = 'invalid_date_range';
  } else if (hasConflict) {
    errors.dates = 'conflict';
  }

  if (values.prixTotal.trim()) {
    const prix = Number(values.prixTotal);
    if (!Number.isFinite(prix) || prix < 0) errors.prixTotal = 'invalid_number';
  }

  const caution = Number(values.cautionMontant);
  if (values.cautionMontant.trim() === '' || !Number.isFinite(caution) || caution < 0) {
    errors.cautionMontant = 'invalid_number';
  }

  return errors;
}

export function isRentalFormValid(errors: RentalFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

export type OdometerFormValues = {
  kilometrage: string;
  carburant: string;
};

export type OdometerFormErrors = Partial<Record<'kilometrage' | 'carburant', RentalFormErrorCode>>;

/**
 * Validation partagée pour les formulaires de départ/retour de location :
 * le kilométrage ne peut pas reculer par rapport au dernier kilométrage connu,
 * le niveau de carburant est un pourcentage entre 0 et 100.
 */
export function validateOdometerForm(
  values: OdometerFormValues,
  minKilometrage: number
): OdometerFormErrors {
  const errors: OdometerFormErrors = {};

  const km = Number(values.kilometrage);
  if (values.kilometrage.trim() === '' || !Number.isFinite(km) || km < minKilometrage) {
    errors.kilometrage = 'invalid_number';
  }

  const carburant = Number(values.carburant);
  if (values.carburant.trim() === '' || !Number.isFinite(carburant) || carburant < 0 || carburant > 100) {
    errors.carburant = 'invalid_number';
  }

  return errors;
}
