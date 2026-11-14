/**
 * Modification sur place de la fiche technique et des documents : brouillons (tout en texte, comme les champs), validation avec les MÊMES
 * règles que le formulaire de modification, et patch à enregistrer. Fonctions pures.
 */
import type { VehicleSpecsPatch } from '../api';
import type { FuelType, Vehicle, VehicleCategory, VehicleDocumentType, VehicleTransmission } from '../types';
import { validateVehicleForm, type VehicleFormErrorCode, type VehicleFormValues } from '../validation';

export type SpecsDraft = {
  categorie: VehicleCategory | null;
  transmission: VehicleTransmission | null;
  carburant: FuelType;
  kilometrage: string;
  couleur: string;
  annee: string;
  nombrePlaces: string;
  puissanceFiscale: string;
};

export type SpecsField = keyof SpecsDraft;
export type SpecsErrors = Partial<Record<SpecsField, VehicleFormErrorCode>>;

export function specsDraft(vehicle: Vehicle): SpecsDraft {
  return {
    categorie: vehicle.categorie,
    transmission: vehicle.transmission,
    carburant: vehicle.carburant,
    kilometrage: String(vehicle.kilometrage ?? ''),
    couleur: vehicle.couleur ?? '',
    annee: vehicle.annee ? String(vehicle.annee) : '',
    nombrePlaces: vehicle.nombrePlaces ? String(vehicle.nombrePlaces) : '',
    puissanceFiscale: vehicle.puissanceFiscale ? String(vehicle.puissanceFiscale) : '',
  };
}

const FIELDS: SpecsField[] = ['categorie', 'transmission', 'carburant', 'kilometrage', 'couleur', 'annee', 'nombrePlaces', 'puissanceFiscale'];

/** Règles du formulaire complet appliquées aux seuls champs de la fiche technique (les autres champs sont remplis par des valeurs neutres). */
export function validateSpecs(draft: SpecsDraft): SpecsErrors {
  const values = {
    marque: 'x', modele: 'x', immatriculation: 'x', vin: '', finition: '', dateMiseEnCirculation: '', niveauCarburant: '',
    prixJour: '1', prixSemaine: '', prixMois: '', description: '', statut: 'disponible',
    ...draft,
  } as VehicleFormValues;
  const errors = validateVehicleForm(values);
  const result: SpecsErrors = {};
  for (const field of FIELDS) {
    const code = (errors as Record<string, VehicleFormErrorCode | undefined>)[field];
    if (code) result[field] = code;
  }
  return result;
}

const emptyToNull = (value: string) => (value.trim() ? value.trim() : null);

/** Ce qui est réellement enregistré ; les champs non modifiés ne sont pas envoyés. */
export function specsPatch(vehicle: Vehicle, draft: SpecsDraft): VehicleSpecsPatch {
  const before = specsDraft(vehicle);
  const patch: VehicleSpecsPatch = {};
  if (draft.categorie !== before.categorie) patch.categorie = draft.categorie;
  if (draft.transmission !== before.transmission) patch.transmission = draft.transmission;
  if (draft.carburant !== before.carburant) patch.carburant = draft.carburant;
  if (draft.kilometrage.trim() !== before.kilometrage) patch.kilometrage = Number(draft.kilometrage);
  if (draft.couleur.trim() !== before.couleur) patch.couleur = emptyToNull(draft.couleur);
  if (draft.annee.trim() !== before.annee) patch.annee = draft.annee.trim() ? Number(draft.annee) : null;
  if (draft.nombrePlaces.trim() !== before.nombrePlaces) patch.nombrePlaces = draft.nombrePlaces.trim() ? Number(draft.nombrePlaces) : null;
  if (draft.puissanceFiscale.trim() !== before.puissanceFiscale) patch.puissanceFiscale = draft.puissanceFiscale.trim() ? Number(draft.puissanceFiscale) : null;
  return patch;
}

export const hasSpecsChanges = (vehicle: Vehicle, draft: SpecsDraft) => Object.keys(specsPatch(vehicle, draft)).length > 0;

// ------------------------------------------------------------------ documents

export type DocumentDraft = { localUri: string | null };

/** Documents modifiables ici : la carte grise (recto et verso). L'assurance et la visite technique se gèrent dans « Obligations légales » (périodes, renouvellements, photo du papier). */
export type EditableDocumentType = Extract<VehicleDocumentType, 'carte_grise' | 'carte_grise_verso'>;
export const EDITABLE_DOCUMENT_TYPES: EditableDocumentType[] = ['carte_grise', 'carte_grise_verso'];
export type DocumentsDraft = Record<EditableDocumentType, DocumentDraft>;

const TYPES = EDITABLE_DOCUMENT_TYPES;

export function documentsDraft(): DocumentsDraft {
  return { carte_grise: { localUri: null }, carte_grise_verso: { localUri: null } };
}

export type DocumentChange = { type: EditableDocumentType; localUri: string };

/** Photos à envoyer (la carte grise n'a pas de date d'expiration). */
export function documentChanges(draft: DocumentsDraft): DocumentChange[] {
  return TYPES.flatMap((type) => (draft[type].localUri ? [{ type, localUri: draft[type].localUri as string }] : []));
}
