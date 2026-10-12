import type { FuelType, VehicleCategory, VehicleStatus, VehicleTransmission } from './types';

export type VehicleFormValues = {
  marque: string;
  modele: string;
  immatriculation: string;
  vin: string;
  finition: string;
  annee: string;
  categorie: VehicleCategory | null;
  couleur: string;
  nombrePlaces: string;
  transmission: VehicleTransmission | null;
  carburant: FuelType;
  kilometrage: string;
  niveauCarburant: string;
  prixJour: string;
  prixSemaine: string;
  prixMois: string;
  description: string;
  statut: VehicleStatus;
};

export type VehicleFormErrorCode =
  | 'required'
  | 'invalid_number'
  | 'invalid_year'
  | 'invalid_price'
  | 'invalid_seats'
  | 'invalid_fuel_level';

export type VehicleFormErrors = Partial<
  Record<
    | 'marque'
    | 'modele'
    | 'immatriculation'
    | 'annee'
    | 'kilometrage'
    | 'prixJour'
    | 'prixSemaine'
    | 'prixMois'
    | 'nombrePlaces'
    | 'niveauCarburant',
    VehicleFormErrorCode
  >
>;

const MIN_YEAR = 1990;

function parseOptionalPositiveNumber(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return 'invalid';
  return n;
}

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

  if (parseOptionalPositiveNumber(values.prixSemaine) === 'invalid') errors.prixSemaine = 'invalid_price';
  if (parseOptionalPositiveNumber(values.prixMois) === 'invalid') errors.prixMois = 'invalid_price';

  if (values.nombrePlaces.trim()) {
    const places = Number(values.nombrePlaces);
    if (!Number.isInteger(places) || places < 1 || places > 9) {
      errors.nombrePlaces = 'invalid_seats';
    }
  }

  if (values.niveauCarburant.trim()) {
    const niveau = Number(values.niveauCarburant);
    if (!Number.isInteger(niveau) || niveau < 0 || niveau > 100) {
      errors.niveauCarburant = 'invalid_fuel_level';
    }
  }

  return errors;
}

export function isFormValid(errors: VehicleFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalNumber(value: string): number | null {
  const result = parseOptionalPositiveNumber(value);
  return result === 'invalid' ? null : result;
}

export function toVehicleInput(values: VehicleFormValues) {
  return {
    marque: values.marque.trim(),
    modele: values.modele.trim(),
    immatriculation: values.immatriculation.trim(),
    vin: emptyToNull(values.vin),
    finition: emptyToNull(values.finition),
    annee: values.annee.trim() ? Number(values.annee) : null,
    categorie: values.categorie,
    couleur: emptyToNull(values.couleur),
    nombrePlaces: values.nombrePlaces.trim() ? Number(values.nombrePlaces) : null,
    transmission: values.transmission,
    carburant: values.carburant,
    kilometrage: Number(values.kilometrage),
    niveauCarburant: values.niveauCarburant.trim() ? Number(values.niveauCarburant) : null,
    prixJour: Number(values.prixJour),
    prixSemaine: optionalNumber(values.prixSemaine),
    prixMois: optionalNumber(values.prixMois),
    description: emptyToNull(values.description),
    statut: values.statut,
  };
}

/** Code d'erreur Postgres pour une violation de contrainte unique (ex. immatriculation en double). */
const POSTGRES_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): error is { code: string; message?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

export function isDuplicatePlateError(error: unknown): boolean {
  return isUniqueViolation(error);
}

/** Distingue quelle contrainte unique a été violée, pour afficher le bon message. */
export function duplicateVehicleField(error: unknown): 'immatriculation' | 'vin' | null {
  if (!isUniqueViolation(error)) return null;
  const message = error.message ?? '';
  if (message.includes('vehicles_agency_vin_unique')) return 'vin';
  if (message.includes('immatriculation')) return 'immatriculation';
  return 'immatriculation';
}
