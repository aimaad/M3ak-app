/**
 * Modification sur place de la fiche technique et des documents : brouillons (tout en texte, comme les champs), validation avec les MÊMES
 * règles que le formulaire de modification, et patch à enregistrer. Fonctions pures.
 */
import { parseFrDate } from '@/features/audit/types';

import type { VehicleSpecsPatch } from '../api';
import type { FuelType, Vehicle, VehicleCategory, VehicleDocument, VehicleDocumentType, VehicleTransmission } from '../types';
import { fromIsoDate, toIsoDate, validateVehicleForm, type VehicleFormErrorCode, type VehicleFormValues } from '../validation';

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

export type DocumentDraft = { localUri: string | null; /** JJ/MM/AAAA, comme à la saisie */ expiry: string };
export type DocumentsDraft = Record<VehicleDocumentType, DocumentDraft>;

const TYPES: VehicleDocumentType[] = ['carte_grise', 'carte_grise_verso', 'assurance', 'visite_technique'];

export function documentsDraft(vehicle: Vehicle): DocumentsDraft {
  const draft = {} as DocumentsDraft;
  for (const type of TYPES) draft[type] = { localUri: null, expiry: fromIsoDate(vehicle.documents.find((doc) => doc.type === type)?.expiresAt) };
  return draft;
}

/** Une date d'expiration remplie doit être une vraie date JJ/MM/AAAA (le passé est permis : un document expiré se saisit aussi). */
export function validateDocuments(draft: DocumentsDraft): Partial<Record<VehicleDocumentType, 'invalid_date'>> {
  const errors: Partial<Record<VehicleDocumentType, 'invalid_date'>> = {};
  for (const type of TYPES) if (draft[type].expiry.trim() && !parseFrDate(draft[type].expiry)) errors[type] = 'invalid_date';
  return errors;
}

export type DocumentChange = { type: VehicleDocumentType; localUri: string | null; expiresAt: string | null };

/** Documents à enregistrer : nouvelle photo (à envoyer) et/ou nouvelle date d'expiration d'un document déjà là. */
export function documentChanges(existing: VehicleDocument[], draft: DocumentsDraft): DocumentChange[] {
  const changes: DocumentChange[] = [];
  for (const type of TYPES) {
    const current = existing.find((doc) => doc.type === type);
    const expiresAt = toIsoDate(draft[type].expiry);
    const dateChanged = (current?.expiresAt ? current.expiresAt.slice(0, 10) : null) !== expiresAt;
    if (draft[type].localUri || (current && dateChanged)) changes.push({ type, localUri: draft[type].localUri, expiresAt });
  }
  return changes;
}
