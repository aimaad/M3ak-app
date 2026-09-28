import type { FuelType, VehicleStatus } from './types';

export type VehicleFormValues = {
  marque: string;
  modele: string;
  immatriculation: string;
  annee: string;
  carburant: FuelType;
  kilometrage: string;
  prixJour: string;
  statut: VehicleStatus;
};

export type VehicleFormErrorCode = 'required' | 'invalid_number' | 'invalid_year' | 'invalid_price';

export type VehicleFormErrors = Partial<
  Record<'marque' | 'modele' | 'immatriculation' | 'annee' | 'kilometrage' | 'prixJour', VehicleFormErrorCode>
>;

const MIN_YEAR = 1990;

export function validateVehicleForm(values: VehicleFormValues): VehicleFormErrors {
  const errors: VehicleFormErrors = {};
  const currentYear = new Date().getFullYear();

  if (!values.marque.trim()) errors.marque = 'required';
  if (!values.modele.trim()) errors.modele = 'required';
  if (!values.immatriculation.trim()) errors.immatriculation = 'required';

  if (values.annee.trim()) {
    const annee = Number(values.annee);
    if (!Number.isInteger(annee) || annee < MIN_YEAR || annee > currentYear + 1) {
      errors.annee = 'invalid_year';
    }
  }

  const kilometrage = Number(values.kilometrage);
  if (values.kilometrage.trim() === '' || !Number.isFinite(kilometrage) || kilometrage < 0) {
    errors.kilometrage = 'invalid_number';
  }

  const prixJour = Number(values.prixJour);
  if (values.prixJour.trim() === '' || !Number.isFinite(prixJour) || prixJour <= 0) {
    errors.prixJour = 'invalid_price';
  }

  return errors;
}

export function isFormValid(errors: VehicleFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

export function toVehicleInput(values: VehicleFormValues) {
  return {
    marque: values.marque.trim(),
    modele: values.modele.trim(),
    immatriculation: values.immatriculation.trim(),
    annee: values.annee.trim() ? Number(values.annee) : null,
    carburant: values.carburant,
    kilometrage: Number(values.kilometrage),
    prixJour: Number(values.prixJour),
    statut: values.statut,
  };
}
