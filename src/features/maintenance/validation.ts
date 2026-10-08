import type { MaintenanceType } from './types';

export type MaintenanceFormValues = {
  vehicleId: string;
  type: MaintenanceType;
  echeanceDate: string;
  echeanceKm: string;
  notes: string;
};

export type MaintenanceFormErrorCode = 'required' | 'invalid_date' | 'invalid_number' | 'need_one';

export type MaintenanceFormErrors = Partial<
  Record<'vehicleId' | 'echeanceDate' | 'echeanceKm', MaintenanceFormErrorCode>
>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateMaintenanceForm(values: MaintenanceFormValues): MaintenanceFormErrors {
  const errors: MaintenanceFormErrors = {};

  if (!values.vehicleId) {
    errors.vehicleId = 'required';
  }

  const hasDate = values.echeanceDate.trim() !== '';
  const hasKm = values.echeanceKm.trim() !== '';

  if (hasDate && !DATE_PATTERN.test(values.echeanceDate.trim())) {
    errors.echeanceDate = 'invalid_date';
  }

  if (hasKm) {
    const km = Number(values.echeanceKm);
    if (!Number.isFinite(km) || km < 0) {
      errors.echeanceKm = 'invalid_number';
    }
  }

  if (!hasDate && !hasKm) {
    errors.echeanceDate = 'need_one';
  }

  return errors;
}

export function isMaintenanceFormValid(errors: MaintenanceFormErrors): boolean {
  return Object.keys(errors).length === 0;
}
