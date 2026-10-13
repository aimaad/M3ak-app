import type { VehicleOcrFields } from '@/features/vehicles/ocr';
import type { FuelType, VehicleCategory } from '@/features/vehicles/types';

import { extractLabeled, type LabelSpec } from './labeled';
import { cleanName, findDate } from './text';

type Key = 'immatriculation' | 'miseEnCirculation' | 'marque' | 'modele' | 'genre' | 'vin' | 'carburant' | 'couleur' | 'places';

const SEP = String.raw`\s*[.):\-]?\s*`;
const ARABIC_LETTER = /[ء-ي]/;

/** `8921 | ب | 14` : 1 à 6 chiffres, une lettre arabe, 1 à 2 chiffres (l'ordre des blocs peut être inversé). */
export function findPlate(text: string): string | null {
  const a = /(\d{1,6})\s*[|/\-]?\s*([ء-ي])\s*[|/\-]?\s*(\d{1,2})(?!\d)/.exec(text);
  if (a) return `${a[1]} | ${a[2]} | ${a[3]}`;
  // Lecture de droite à gauche : « 14 | ب | 8921 ».
  const b = /(\d{1,2})\s*[|/\-]?\s*([ء-ي])\s*[|/\-]?\s*(\d{1,6})(?!\d)/.exec(text);
  return b ? `${b[3]} | ${b[2]} | ${b[1]}` : null;
}

const VIN_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/;

/** VIN de 17 caractères ; O/Q→0 et I→1 (ces lettres n'existent pas dans un VIN). */
export function findVin(text: string): string | null {
  for (const token of text.toUpperCase().split(/[^A-Z0-9]+/)) {
    if (token.length !== 17) continue;
    const fixed = token.replace(/[OQ]/g, '0').replace(/I/g, '1');
    if (VIN_CHARS.test(fixed) && /\d/.test(fixed) && /[A-Z]/.test(fixed)) return fixed;
  }
  return null;
}

function readFuel(text: string): FuelType | null {
  const t = text.toUpperCase();
  if (/GASOIL|DIESEL|GAZOLE/.test(t)) return 'diesel';
  if (/HYBRID/.test(t)) return 'hybride';
  if (/ELECTRI/.test(t)) return 'electrique';
  if (/ESSENCE|SUPER|SANS\s*PLOMB/.test(t)) return 'essence';
  return null;
}

function readCategory(text: string): VehicleCategory | null {
  const t = text.toUpperCase();
  if (/MINIBUS|AUTOCAR|AUTOBUS/.test(t)) return 'minibus';
  if (/CAMIONNETTE|UTILITAIRE|FOURGON|\bVU\b/.test(t)) return 'utilitaire';
  return null; // « VP » (véhicule particulier) ne permet pas de choisir une catégorie commerciale
}

const SPECS: LabelSpec<Key>[] = [
  {
    key: 'immatriculation',
    labels: [new RegExp(String.raw`^(?:NUMERO\s+D'?\s*IMMATRICULATION|N\s*[°O]\s*D'?\s*IMMATRICULATION|IMMATRICULATION)\b${SEP}`)],
    accept: (t) => findPlate(t),
  },
  {
    key: 'miseEnCirculation',
    labels: [new RegExp(String.raw`^(?:1\s*ERE|PREMIERE)\s+MISE\s+EN\s+CIRCULATION\b${SEP}`), new RegExp(String.raw`^MISE\s+EN\s+CIRCULATION\b${SEP}`)],
    accept: findDate,
  },
  { key: 'marque', labels: [new RegExp(String.raw`^MARQUE\b${SEP}`)], accept: (t) => cleanName(t, 40) },
  {
    key: 'modele',
    labels: [new RegExp(String.raw`^TYPE\s*[/\-]?\s*MODELE\b${SEP}`), new RegExp(String.raw`^MODELE\b${SEP}`), new RegExp(String.raw`^TYPE\b${SEP}`)],
    accept: (t) => {
      const value = t.replace(/[^\p{L}\p{N}\s'’./-]/gu, ' ').replace(/\s+/g, ' ').trim();
      return value.length >= 1 && value.length <= 40 && /[\p{L}\p{N}]/u.test(value) ? value : null;
    },
  },
  { key: 'genre', labels: [new RegExp(String.raw`^GENRE\b${SEP}`)], accept: (t) => (/[A-Za-z]/.test(t) ? t.trim().slice(0, 40) : null) },
  {
    key: 'vin',
    labels: [new RegExp(String.raw`^N\s*[°O]\s*DE\s+SERIE\b[^:]*${SEP}`), new RegExp(String.raw`^(?:NUMERO\s+DE\s+SERIE|CHASSIS|N\s*[°O]\s*DE\s+CHASSIS)\b${SEP}`)],
    accept: findVin,
  },
  { key: 'carburant', labels: [new RegExp(String.raw`^(?:CARBURANT|ENERGIE|TYPE\s+DE\s+CARBURANT)\b${SEP}`)], accept: (t) => (readFuel(t) ? t : null) },
  { key: 'couleur', labels: [new RegExp(String.raw`^COULEUR\b${SEP}`)], accept: (t) => cleanName(t, 30) },
  {
    key: 'places',
    labels: [new RegExp(String.raw`^(?:NOMBRE\s+DE\s+PLACES|PLACES)\b${SEP}`)],
    accept: (t) => {
      const match = /\b([1-9])\b/.exec(t);
      return match ? match[1] : null;
    },
  },
];

const EMPTY = { value: null, confidence: 'low' } as const;

/** Lit le texte OCR d'une carte grise. Un champ non trouvé reste null ; rien n'est deviné. */
export function parseRegistrationText(lines: string[]): VehicleOcrFields {
  const found = extractLabeled(lines, SPECS);

  // Repères sans étiquette (plaque, VIN) : cherchés dans tout le texte, confiance moindre.
  const anywhere = <T>(find: (line: string) => T | null): T | null => {
    for (const line of lines) {
      const hit = find(line);
      if (hit) return hit;
    }
    return null;
  };

  const plateLabeled = found.immatriculation?.value ?? null;
  const plate = plateLabeled ?? anywhere((line) => (ARABIC_LETTER.test(line) ? findPlate(line) : null));
  const vinLabeled = found.vin?.value ?? null;
  const vin = vinLabeled ?? anywhere(findVin);

  const date = found.miseEnCirculation?.value ?? null;
  const year = date ? Number(date.slice(0, 4)) : null;
  const fuel = found.carburant ? readFuel(found.carburant.value) : null;
  const places = found.places ? Number(found.places.value) : null;

  return {
    immatriculation: plate ? { value: plate, confidence: plateLabeled ? 'medium' : 'low' } : { ...EMPTY },
    vin: vin ? { value: vin, confidence: vinLabeled ? 'high' : 'medium' } : { ...EMPTY },
    marque: found.marque ? { value: found.marque.value, confidence: 'medium' } : { ...EMPTY },
    modele: found.modele ? { value: found.modele.value, confidence: 'medium' } : { ...EMPTY },
    finition: { ...EMPTY },
    annee: year ? { value: year, confidence: 'high' } : { ...EMPTY },
    couleur: found.couleur ? { value: found.couleur.value, confidence: 'medium' } : { ...EMPTY },
    nombrePlaces: places ? { value: places, confidence: 'medium' } : { ...EMPTY },
    carburant: fuel ? { value: fuel, confidence: 'medium' } : { ...EMPTY },
    categorie: found.genre && readCategory(found.genre.value) ? { value: readCategory(found.genre.value), confidence: 'medium' } : { ...EMPTY },
  };
}
