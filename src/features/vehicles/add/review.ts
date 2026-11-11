/**
 * Règles de l'écran « Carte grise lue » : quels champs lus sont « à confirmer », pourquoi, avec quelle correction évidente.
 *
 * Un champ est à confirmer quand :
 *  - la lecture le signale peu sûr (confiance « low ») alors qu'une valeur est lue → « Lecture peu sûre » ;
 *  - son format est invalide : VIN qui n'a pas 17 caractères ou contient I, O ou Q ; date impossible ou future ; plaque hors format ;
 *  - un champ essentiel (plaque, marque, modèle) est vide.
 * Une confiance « medium » ne bloque rien : le champ reste dans la liste avec un petit point jaune.
 * Aucune lecture « brute » n'est disponible : « SUR LA CARTE » montre la valeur lue, avec les caractères invalides soulignés.
 */
import { parseFrDate } from '@/features/audit/types';

import { fromIsoDate } from '../validation';
import { FUEL_TYPES, type FuelType } from '../types';
import type { VehicleOcrFields } from '../ocr';

import { formatPlate, isValidVin, plateKind, vinKey } from './plate';

export type ReviewKey = 'immatriculation' | 'marque' | 'modele' | 'genre' | 'vin' | 'carburant' | 'puissanceFiscale' | 'proprietaire' | 'dateMiseEnCirculation';
export type ReviewIssue = 'unreadable_char' | 'length' | 'invalid_date' | 'format' | 'low' | 'missing';

export const REVIEW_GROUPS: { key: 'vehicle' | 'technical' | 'admin'; fields: ReviewKey[] }[] = [
  { key: 'vehicle', fields: ['immatriculation', 'marque', 'modele', 'genre'] },
  { key: 'technical', fields: ['vin', 'carburant', 'puissanceFiscale'] },
  { key: 'admin', fields: ['proprietaire', 'dateMiseEnCirculation'] },
];

/** Champs sans lesquels on ne peut pas continuer : vides, ils sont à confirmer. */
const ESSENTIAL: ReviewKey[] = ['immatriculation', 'marque', 'modele'];

export type ReviewField = {
  key: ReviewKey;
  /** Valeur lue (affichée dans « SUR LA CARTE »). */
  raw: string;
  /** Valeur proposée (avec la correction évidente) : pré-remplit le champ. */
  value: string;
  confidence: 'high' | 'medium' | 'low';
  issue: ReviewIssue | null;
  /** Positions des caractères invalides dans `raw` (soulignés en jaune). */
  badChars: number[];
  /** Confiance moyenne : petit point jaune, sans bloquer. */
  uncertain: boolean;
};

/** Plus grand que l'année courante : date future = impossible pour une première mise en circulation. */
const MIN_YEAR = 1950;

export function isValidFrDate(value: string, now: Date = new Date()): boolean {
  const date = parseFrDate(value);
  return !!date && date.getTime() <= now.getTime() && date.getFullYear() >= MIN_YEAR;
}

/** Positions des caractères qui ne devraient pas être là (I, O, Q dans un VIN ; autre chose qu'un chiffre ou « / » dans une date). */
export function badCharPositions(key: ReviewKey, raw: string): number[] {
  const bad: number[] = [];
  const chars = Array.from(raw);
  chars.forEach((char, index) => {
    if (key === 'vin' && !/[A-HJ-NPR-Z0-9]/i.test(char)) bad.push(index);
    if (key === 'dateMiseEnCirculation' && !/[\d/\-. ]/.test(char)) bad.push(index);
  });
  return bad;
}

/** Correction évidente : VIN → majuscules, « O » et « Q » en « 0 », « I » en « 1 » ; date → lettres ressemblant à un chiffre remplacées. */
export function suggestCorrection(key: ReviewKey, raw: string): string {
  if (key === 'vin') return vinKey(raw).replace(/[OQ]/g, '0').replace(/I/g, '1');
  if (key === 'dateMiseEnCirculation') {
    const fixed = raw.replace(/[OoQ]/g, '0').replace(/[Il|]/g, '1').replace(/[.\-\s]+/g, '/').trim();
    return fixed;
  }
  if (key === 'immatriculation') return formatPlate(raw);
  return raw.trim();
}

/** Valeur saisie ou lue : null si elle est valable, sinon la raison. Les champs libres (genre, propriétaire) sont toujours valables. */
export function validateReviewValue(key: ReviewKey, value: string, now: Date = new Date()): ReviewIssue | null {
  const text = value.trim();
  switch (key) {
    case 'immatriculation':
      return !text ? 'missing' : plateKind(text) === 'other' ? 'format' : null;
    case 'marque':
    case 'modele':
      return text ? null : 'missing';
    case 'vin': {
      if (!text) return null; // VIN absent : pas bloquant (il se complète dans la fiche)
      if (isValidVin(text)) return null;
      return vinKey(text).length !== 17 ? 'length' : 'unreadable_char';
    }
    case 'dateMiseEnCirculation':
      return !text ? null : isValidFrDate(text, now) ? null : 'invalid_date';
    case 'puissanceFiscale': {
      if (!text) return null;
      const cv = Number(text);
      return Number.isInteger(cv) && cv >= 1 && cv <= 60 ? null : 'format';
    }
    case 'carburant':
      return !text || (FUEL_TYPES as string[]).includes(text) ? null : 'format';
    default:
      return null;
  }
}

function rawOf(key: ReviewKey, merged: VehicleOcrFields): string {
  switch (key) {
    case 'immatriculation':
      return merged.immatriculation.value ?? '';
    case 'marque':
      return merged.marque.value ?? '';
    case 'modele':
      return merged.modele.value ?? '';
    case 'genre':
      return merged.genre.value ?? '';
    case 'vin':
      return merged.vin.value ?? '';
    case 'carburant':
      return merged.carburant.value ?? '';
    case 'puissanceFiscale':
      return merged.puissanceFiscale.value != null ? String(merged.puissanceFiscale.value) : '';
    case 'proprietaire':
      return merged.proprietaire.value ?? '';
    case 'dateMiseEnCirculation':
      return fromIsoDate(merged.dateMiseEnCirculation.value);
  }
}

const confidenceOf = (key: ReviewKey, merged: VehicleOcrFields) => merged[key].confidence;

/** Les champs de l'écran, avec leur éventuel problème. Une valeur lue valable de confiance « low » est « à confirmer » (lecture peu sûre). */
export function buildReview(merged: VehicleOcrFields, now: Date = new Date()): ReviewField[] {
  return REVIEW_GROUPS.flatMap((group) => group.fields).map((key) => {
    const raw = rawOf(key, merged);
    const confidence = confidenceOf(key, merged);
    const formatIssue = validateReviewValue(key, raw, now);
    const hasValue = raw.trim() !== '';
    const issue: ReviewIssue | null = formatIssue ?? (hasValue && confidence === 'low' ? 'low' : !hasValue && ESSENTIAL.includes(key) ? 'missing' : null);
    return {
      key,
      raw,
      value: hasValue ? suggestCorrection(key, raw) : '',
      confidence,
      issue,
      badChars: hasValue ? badCharPositions(key, raw) : [],
      uncertain: hasValue && confidence === 'medium' && issue === null,
    };
  });
}

/** Champs lus : ceux qui ont une valeur. */
export const readCount = (fields: ReviewField[]): number => fields.filter((field) => field.raw.trim() !== '').length;

export type ReviewState = Record<ReviewKey, { value: string; confirmed: boolean }>;

/** État de départ : tout champ sans problème est confirmé ; les autres attendent la confirmation de l'employé. */
export function initialReviewState(fields: ReviewField[]): ReviewState {
  return Object.fromEntries(fields.map((field) => [field.key, { value: field.value, confirmed: field.issue === null }])) as ReviewState;
}

/** Champs encore à confirmer, dans l'ordre de l'écran. */
export function pendingFields(fields: ReviewField[], state: ReviewState): ReviewKey[] {
  return fields.filter((field) => !state[field.key].confirmed).map((field) => field.key);
}

/** Confirme un champ avec la valeur donnée si elle est valable ; sinon renvoie la raison, sans rien confirmer. */
export function confirmField(state: ReviewState, key: ReviewKey, value: string, now: Date = new Date()): { state: ReviewState; issue: ReviewIssue | null } {
  const cleaned = suggestCorrection(key, value);
  const issue = validateReviewValue(key, cleaned, now);
  if (issue) return { state: { ...state, [key]: { value: cleaned, confirmed: false } }, issue };
  return { state: { ...state, [key]: { value: cleaned, confirmed: true } }, issue: null };
}

/** Valeurs finales pour le brouillon de création. */
export function reviewedFuel(state: ReviewState): FuelType | undefined {
  const value = state.carburant.value;
  return (FUEL_TYPES as string[]).includes(value) ? (value as FuelType) : undefined;
}
