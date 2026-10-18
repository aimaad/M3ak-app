import type { OcrField } from './ocr';
import type { FuelType, VehicleCategory, PendingVehicleDocument } from './types';

/**
 * Brouillon en mémoire transmis entre les écrans du parcours de création
 * rapide (identification -> finalisation). Un simple singleton suffit : le
 * parcours est linéaire, dans le même processus JS, jamais persisté ni
 * partagé entre onglets.
 */
export type VehicleCreationDraft = {
  immatriculation?: string;
  vin?: string;
  marque?: string;
  modele?: string;
  finition?: string;
  annee?: number;
  /** Première mise en circulation, « JJ/MM/AAAA ». */
  dateMiseEnCirculation?: string;
  puissanceFiscale?: number;
  couleur?: string;
  nombrePlaces?: number;
  carburant?: FuelType;
  categorie?: VehicleCategory;
  /** Champs dont la confiance OCR était "medium" — à mettre en évidence pour vérification. */
  uncertainFields?: (keyof VehicleCreationDraft)[];
  /** Photos de la carte grise (recto et/ou verso) prises pendant le scan, à proposer comme documents du véhicule. */
  carteGrisePendingDocuments?: PendingVehicleDocument[];
};

let draft: VehicleCreationDraft | null = null;

export function setVehicleCreationDraft(value: VehicleCreationDraft): void {
  draft = value;
}

export function takeVehicleCreationDraft(): VehicleCreationDraft | null {
  const value = draft;
  draft = null;
  return value;
}

/** Transforme le résultat OCR brut en brouillon : ne garde que les champs avec une confiance suffisante. */
export function draftFromOcrFields(fields: {
  immatriculation: OcrField<string>;
  vin: OcrField<string>;
  marque: OcrField<string>;
  modele: OcrField<string>;
  finition: OcrField<string>;
  annee: OcrField<number>;
  couleur: OcrField<string>;
  nombrePlaces: OcrField<number>;
  carburant: OcrField<FuelType>;
  categorie: OcrField<VehicleCategory>;
}): VehicleCreationDraft {
  const result: VehicleCreationDraft = {};
  const uncertain: (keyof VehicleCreationDraft)[] = [];

  for (const [key, field] of Object.entries(fields) as [keyof typeof fields, OcrField<unknown>][]) {
    if (field.value === null || field.confidence === 'low') continue;
    (result as Record<string, unknown>)[key] = field.value;
    if (field.confidence === 'medium') uncertain.push(key);
  }

  if (uncertain.length > 0) result.uncertainFields = uncertain;
  return result;
}
