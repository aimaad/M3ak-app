import { fromIsoDate } from '../validation';
import { emptyVehicleFields, mergeVehicleFields, yearFromFields, type OcrConfidence, type ScanErrorCode, type VehicleOcrFields } from '../ocr';
import type { VehicleCreationDraft } from '../creation-draft';
import type { PendingVehicleDocument } from '../types';

import { formatPlate, vinKey } from './plate';
import { reviewedFuel, type ReviewKey, type ReviewState } from './review';

export type Face = 'recto' | 'verso';
export type ScanItem = { face: Face; uri: string; fields: VehicleOcrFields };

/**
 * Résultat d'une lecture de carte grise, transmis du scanner à l'écran « Carte grise lue » (en mémoire, jamais enregistré) :
 * les photos prises, les champs lus et fusionnés, la vraie durée de lecture, et le choix de garder les photos dans le dossier.
 */
export type ScanSession = {
  photos: Record<Face, string | null>;
  scans: ScanItem[];
  merged: VehicleOcrFields;
  durationMs: number;
  fromCache: boolean;
  keepPhoto: boolean;
  /** Première erreur d'une face (l'autre a pu être lue). */
  errorCode: ScanErrorCode | null;
};

let session: ScanSession | null = null;

export const setScanSession = (value: ScanSession | null) => {
  session = value;
};
export const getScanSession = (): ScanSession | null => session;

export function mergeScans(scans: ScanItem[]): VehicleOcrFields {
  return scans.reduce<VehicleOcrFields>((acc, item) => mergeVehicleFields(acc, item.fields), emptyVehicleFields());
}

/** Photos de la carte grise rangées par face : le recto porte la date de fin de validité (alerte d'expiration), le verso a son propre document. */
export function pendingCardDocuments(scans: Pick<ScanItem, 'face' | 'uri'>[], expiresAt: string | null): PendingVehicleDocument[] {
  return scans.map((item) => (item.face === 'recto' ? { type: 'carte_grise', localUri: item.uri, expiresAt } : { type: 'carte_grise_verso', localUri: item.uri, expiresAt: null }));
}

const CONFIDENCE_FIELDS: (keyof VehicleOcrFields & keyof VehicleCreationDraft)[] = ['immatriculation', 'vin', 'marque', 'modele', 'finition', 'annee', 'dateMiseEnCirculation', 'puissanceFiscale', 'couleur', 'nombrePlaces', 'carburant', 'categorie'];

/**
 * Brouillon de création à partir de la lecture : toutes les valeurs lues sont reprises (la plaque au format enregistré) ; les champs lus avec
 * une confiance moyenne sont signalés dans `uncertainFields`. Une valeur de confiance faible est reprise aussi : l'écran « Carte grise lue »
 * la fait confirmer avant de continuer.
 */
export function draftFromScan(session: Pick<ScanSession, 'merged' | 'scans' | 'keepPhoto'>): VehicleCreationDraft {
  const { merged } = session;
  const year = yearFromFields(merged);
  const draft: VehicleCreationDraft = {
    immatriculation: merged.immatriculation.value ? formatPlate(merged.immatriculation.value) : undefined,
    vin: merged.vin.value ?? undefined,
    marque: merged.marque.value ?? undefined,
    modele: merged.modele.value ?? undefined,
    finition: merged.finition.value ?? undefined,
    annee: year ?? undefined,
    dateMiseEnCirculation: merged.dateMiseEnCirculation.value ? fromIsoDate(merged.dateMiseEnCirculation.value) : undefined,
    puissanceFiscale: merged.puissanceFiscale.value ?? undefined,
    couleur: merged.couleur.value ?? undefined,
    nombrePlaces: merged.nombrePlaces.value ?? undefined,
    carburant: merged.carburant.value ?? undefined,
    categorie: merged.categorie.value ?? undefined,
    source: 'scan',
    carteGrisePendingDocuments: session.keepPhoto && session.scans.length > 0 ? pendingCardDocuments(session.scans, merged.dateFinValidite.value) : undefined,
  };
  const confidence = (key: keyof VehicleOcrFields): OcrConfidence => merged[key].confidence;
  const uncertain = CONFIDENCE_FIELDS.filter((key) => merged[key].value !== null && confidence(key) !== 'high');
  if (uncertain.length > 0) draft.uncertainFields = uncertain;
  // Nettoie les clés non lues : un brouillon ne garde que ce qui a été lu.
  return Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== undefined)) as VehicleCreationDraft;
}

const REVIEWED_DRAFT_KEYS: (keyof VehicleCreationDraft)[] = ['immatriculation', 'marque', 'modele', 'vin', 'carburant', 'puissanceFiscale', 'dateMiseEnCirculation'];

/**
 * Brouillon final après l'écran « Carte grise lue » : les valeurs vérifiées ou corrigées par l'employé remplacent celles de la lecture, et
 * ces champs ne sont plus signalés (il les a vus). Seuls restent signalés ceux que l'écran ne montre pas.
 */
export function draftFromReview(session: Pick<ScanSession, 'merged' | 'scans' | 'keepPhoto'>, state: ReviewState): VehicleCreationDraft {
  const base = draftFromScan(session);
  const text = (key: ReviewKey) => state[key].value.trim();
  const cv = Number(text('puissanceFiscale'));
  const reviewed: VehicleCreationDraft = {
    immatriculation: text('immatriculation') ? formatPlate(text('immatriculation')) : undefined,
    marque: text('marque') || undefined,
    modele: text('modele') || undefined,
    vin: text('vin') ? vinKey(text('vin')) : undefined,
    carburant: reviewedFuel(state),
    puissanceFiscale: Number.isInteger(cv) && cv > 0 ? cv : undefined,
    dateMiseEnCirculation: text('dateMiseEnCirculation') || undefined,
    genre: text('genre') || undefined,
  };
  const draft = { ...base, ...Object.fromEntries(Object.entries(reviewed).filter(([, value]) => value !== undefined)) } as VehicleCreationDraft;
  for (const key of REVIEWED_DRAFT_KEYS) if (reviewed[key] === undefined) delete draft[key];
  const stillUncertain = (base.uncertainFields ?? []).filter((key) => !REVIEWED_DRAFT_KEYS.includes(key));
  if (stillUncertain.length > 0) draft.uncertainFields = stillUncertain;
  else delete draft.uncertainFields;
  return draft;
}
