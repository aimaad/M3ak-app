/**
 * Modèle du formulaire « Modifier la fiche technique » (pur, testé) : brouillon, liste des champs modifiés (pour la barre d'enregistrement),
 * validation avec des messages précis, construction de ce qui est enregistré, et application d'un scan de carte grise.
 *
 * Règle d'or : un champ vide reste vide (jamais « 0 » ni « — »), et on n'écrit jamais une valeur qu'on ne connaît pas.
 */
import { colorKey } from '@/components/form/logic';

import type { OcrConfidence, VehicleOcrFields } from '../ocr';
import { FUEL_TYPES, type FuelType, type Vehicle, type VehicleCategory, type VehicleInput, type VehicleStatus, type VehicleTransmission } from '../types';

export type FormDraft = {
  marque: string;
  modele: string;
  immatriculation: string;
  vin: string;
  finition: string;
  /** Année, chiffres. */
  annee: string;
  /** AAAA-MM-JJ ou null. */
  dateMiseEnCirculation: string | null;
  puissanceFiscale: string;
  categorie: VehicleCategory | null;
  couleur: string;
  nombrePlaces: number | null;
  transmission: VehicleTransmission | null;
  carburant: FuelType;
  /** Chiffres ; vide quand le kilométrage enregistré est 0 (on n'affiche pas « 0 km »). */
  kilometrage: string;
  niveauCarburant: string;
  statut: VehicleStatus;
  branchId: string | null;
  description: string;
  prixJour: number | null;
  prixSemaine: string;
  prixMois: string;
};

export type FieldKey = keyof FormDraft;

const text = (value: string | null | undefined) => value ?? '';

export function draftFromVehicle(vehicle: Vehicle): FormDraft {
  return {
    marque: vehicle.marque,
    modele: vehicle.modele,
    immatriculation: vehicle.immatriculation,
    vin: text(vehicle.vin),
    finition: text(vehicle.finition),
    annee: vehicle.annee ? String(vehicle.annee) : '',
    dateMiseEnCirculation: vehicle.dateMiseEnCirculation ? vehicle.dateMiseEnCirculation.slice(0, 10) : null,
    puissanceFiscale: vehicle.puissanceFiscale ? String(vehicle.puissanceFiscale) : '',
    categorie: vehicle.categorie,
    couleur: text(vehicle.couleur),
    nombrePlaces: vehicle.nombrePlaces ?? null,
    transmission: vehicle.transmission ?? null,
    carburant: vehicle.carburant,
    kilometrage: vehicle.kilometrage > 0 ? String(vehicle.kilometrage) : '',
    niveauCarburant: vehicle.niveauCarburant !== null && vehicle.niveauCarburant !== undefined ? String(vehicle.niveauCarburant) : '',
    statut: vehicle.statut,
    branchId: vehicle.branchId ?? null,
    description: text(vehicle.description),
    prixJour: vehicle.prixJour > 0 ? vehicle.prixJour : null,
    prixSemaine: vehicle.prixSemaine ? String(vehicle.prixSemaine) : '',
    prixMois: vehicle.prixMois ? String(vehicle.prixMois) : '',
  };
}

/** Champs dans l'ordre d'affichage (c'est l'ordre de la liste « Boîte, kilométrage, couleur » de la barre d'enregistrement). */
export const FIELD_ORDER: FieldKey[] = ['transmission', 'categorie', 'kilometrage', 'puissanceFiscale', 'couleur', 'nombrePlaces', 'carburant', 'marque', 'modele', 'immatriculation', 'vin', 'finition', 'annee', 'dateMiseEnCirculation', 'niveauCarburant', 'statut', 'branchId', 'description', 'prixJour', 'prixSemaine', 'prixMois'];

const norm = (value: unknown) => (typeof value === 'string' ? value.trim() : (value ?? null));

/** Champs modifiés par rapport au brouillon de départ, dans l'ordre d'affichage. */
export function changedFields(initial: FormDraft, draft: FormDraft): FieldKey[] {
  return FIELD_ORDER.filter((key) => norm(initial[key]) !== norm(draft[key]));
}

// ------------------------------------------------------------------ validation

export type FieldErrorCode = 'marque_required' | 'modele_required' | 'plate_required' | 'year_invalid' | 'km_required' | 'km_invalid' | 'power_invalid' | 'seats_invalid' | 'level_invalid' | 'date_invalid' | 'price_required' | 'price_invalid' | 'optional_price_invalid';
export type DraftErrors = Partial<Record<FieldKey, { code: FieldErrorCode; params?: Record<string, unknown> }>>;

const MIN_YEAR = 1990;
const KM_MAX = 9_999_999;

/**
 * Contrôles, avec des codes précis (le message dit quoi faire). `showPrices` : seuls ceux qui voient les prix les contrôlent (l'employé ne les voit pas).
 * Un kilométrage vide est accepté tant qu'il n'a pas été vidé : un véhicule enregistré à 0 km (jamais renseigné) ne bloque pas les autres modifications.
 */
export function validateDraft(draft: FormDraft, options: { showPrices: boolean; initialKm: string; now?: Date }): DraftErrors {
  const errors: DraftErrors = {};
  const year = (options.now ?? new Date()).getFullYear();
  if (!draft.marque.trim()) errors.marque = { code: 'marque_required' };
  if (!draft.modele.trim()) errors.modele = { code: 'modele_required' };
  if (!draft.immatriculation.trim()) errors.immatriculation = { code: 'plate_required' };
  if (draft.annee.trim()) {
    const n = Number(draft.annee);
    if (!Number.isInteger(n) || n < MIN_YEAR || n > year + 1) errors.annee = { code: 'year_invalid', params: { min: MIN_YEAR, max: year + 1 } };
  }
  if (draft.kilometrage.trim() === '') {
    if (options.initialKm !== '') errors.kilometrage = { code: 'km_required' };
  } else {
    const n = Number(draft.kilometrage);
    if (!Number.isInteger(n) || n < 0 || n > KM_MAX) errors.kilometrage = { code: 'km_invalid' };
  }
  if (draft.puissanceFiscale.trim()) {
    const n = Number(draft.puissanceFiscale);
    if (!Number.isInteger(n) || n < 1 || n > 60) errors.puissanceFiscale = { code: 'power_invalid' };
  }
  if (draft.nombrePlaces !== null && (draft.nombrePlaces < 1 || draft.nombrePlaces > 9)) errors.nombrePlaces = { code: 'seats_invalid' };
  if (draft.niveauCarburant.trim()) {
    const n = Number(draft.niveauCarburant);
    if (!Number.isInteger(n) || n < 0 || n > 100) errors.niveauCarburant = { code: 'level_invalid' };
  }
  if (draft.dateMiseEnCirculation) {
    const today = (options.now ?? new Date()).toISOString().slice(0, 10);
    if (draft.dateMiseEnCirculation > today || draft.dateMiseEnCirculation < '1950-01-01') errors.dateMiseEnCirculation = { code: 'date_invalid' };
  }
  if (options.showPrices) {
    if (draft.prixJour === null) errors.prixJour = { code: 'price_required' };
    else if (!Number.isFinite(draft.prixJour) || draft.prixJour <= 0) errors.prixJour = { code: 'price_invalid' };
    for (const key of ['prixSemaine', 'prixMois'] as const) {
      if (draft[key].trim() && !(Number(draft[key]) > 0)) errors[key] = { code: 'optional_price_invalid' };
    }
  }
  return errors;
}

/** Premier champ en erreur, dans l'ordre d'affichage : « Enregistrer » défile jusque-là. */
export function firstErrorField(errors: DraftErrors): FieldKey | null {
  return FIELD_ORDER.find((key) => errors[key]) ?? null;
}

// ------------------------------------------------------------------ ce qui est enregistré

const orNull = (value: string) => (value.trim() ? value.trim() : null);

/** Ce qui est enregistré. Les prix ne sont changés que par qui les voit ; un kilométrage resté vide garde la valeur enregistrée. */
export function buildInput(draft: FormDraft, vehicle: Vehicle, options: { showPrices: boolean; canChooseBranch: boolean }): VehicleInput {
  return {
    immatriculation: draft.immatriculation.trim(),
    vin: orNull(draft.vin),
    marque: draft.marque.trim(),
    modele: draft.modele.trim(),
    finition: orNull(draft.finition),
    annee: draft.annee.trim() ? Number(draft.annee) : null,
    dateMiseEnCirculation: draft.dateMiseEnCirculation,
    puissanceFiscale: draft.puissanceFiscale.trim() ? Number(draft.puissanceFiscale) : null,
    categorie: draft.categorie,
    couleur: orNull(draft.couleur),
    nombrePlaces: draft.nombrePlaces,
    transmission: draft.transmission,
    carburant: draft.carburant,
    kilometrage: draft.kilometrage.trim() ? Number(draft.kilometrage) : vehicle.kilometrage,
    niveauCarburant: draft.niveauCarburant.trim() ? Number(draft.niveauCarburant) : null,
    statut: draft.statut,
    prixJour: options.showPrices ? (draft.prixJour as number) : vehicle.prixJour,
    prixSemaine: options.showPrices ? (draft.prixSemaine.trim() ? Number(draft.prixSemaine) : null) : vehicle.prixSemaine,
    prixMois: options.showPrices ? (draft.prixMois.trim() ? Number(draft.prixMois) : null) : vehicle.prixMois,
    description: orNull(draft.description),
    ...(options.canChooseBranch ? { branchId: draft.branchId } : {}),
  };
}

// ------------------------------------------------------------------ scan de la carte grise

const USABLE: Record<OcrConfidence, boolean> = { high: true, medium: true, low: false };
const FRENCH_COLORS: Record<string, string> = { blanc: 'Blanc', noir: 'Noir', gris: 'Gris', argent: 'Argent', rouge: 'Rouge', bleu: 'Bleu', beige: 'Beige' };

export type ScanApplied = { draft: FormDraft; /** champs remplis par la lecture (badge « Lu par l'IA ») */ filled: FieldKey[] };

/**
 * Applique une lecture de carte grise : on ne remplit QUE les champs encore vides, avec une lecture de confiance haute ou moyenne (une
 * lecture douteuse n'est jamais reprise). Une valeur déjà enregistrée n'est jamais écrasée. Renvoie les champs réellement remplis.
 */
export function applyScan(draft: FormDraft, fields: VehicleOcrFields): ScanApplied {
  const next = { ...draft };
  const filled: FieldKey[] = [];
  const read = <T,>(field: { value: T | null; confidence: OcrConfidence }): T | null => (field.value !== null && USABLE[field.confidence] ? field.value : null);
  const fill = <K extends FieldKey>(key: K, value: FormDraft[K] | null, empty: boolean) => {
    if (value !== null && value !== undefined && empty) {
      next[key] = value;
      filled.push(key);
    }
  };

  fill('marque', read(fields.marque), !draft.marque.trim());
  fill('modele', read(fields.modele), !draft.modele.trim());
  fill('immatriculation', read(fields.immatriculation), !draft.immatriculation.trim());
  fill('vin', read(fields.vin), !draft.vin.trim());
  fill('finition', read(fields.finition), !draft.finition.trim());
  const year = read(fields.annee);
  fill('annee', year === null ? null : String(year), !draft.annee.trim());
  fill('dateMiseEnCirculation', read(fields.dateMiseEnCirculation), draft.dateMiseEnCirculation === null);
  const power = read(fields.puissanceFiscale);
  fill('puissanceFiscale', power === null ? null : String(power), !draft.puissanceFiscale.trim());
  const color = read(fields.couleur);
  const key = colorKey(color);
  fill('couleur', color === null ? null : key && key !== 'other' ? FRENCH_COLORS[key] : color, !draft.couleur.trim());
  fill('nombrePlaces', read(fields.nombrePlaces), draft.nombrePlaces === null);
  const fuel = read(fields.carburant);
  // Le carburant a toujours une valeur : on ne la remplace que si elle est « essence » (défaut) et que la lecture est sûre.
  if (fuel !== null && FUEL_TYPES.includes(fuel) && fields.carburant.confidence === 'high' && draft.carburant === 'essence' && fuel !== 'essence') {
    next.carburant = fuel;
    filled.push('carburant');
  }
  fill('categorie', read(fields.categorie), draft.categorie === null);
  return { draft: next, filled };
}

/** Ce qui manque encore après une lecture (pour « Il reste la boîte et le kilométrage ») : toujours la boîte (jamais sur la carte), puis ce qui est vide. */
export function missingAfterScan(draft: FormDraft): ('transmission' | 'kilometrage' | 'puissanceFiscale' | 'couleur' | 'nombrePlaces' | 'categorie')[] {
  const missing: ('transmission' | 'kilometrage' | 'puissanceFiscale' | 'couleur' | 'nombrePlaces' | 'categorie')[] = [];
  if (draft.transmission === null) missing.push('transmission');
  if (!draft.kilometrage.trim()) missing.push('kilometrage');
  if (!draft.puissanceFiscale.trim()) missing.push('puissanceFiscale');
  if (!draft.couleur.trim()) missing.push('couleur');
  if (draft.nombrePlaces === null) missing.push('nombrePlaces');
  if (draft.categorie === null) missing.push('categorie');
  return missing;
}
