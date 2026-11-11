/**
 * Règles de l'écran « Finaliser » : avancement 0/3, prix, kilométrage, catégorie pré-choisie, statut « Louable tout de suite »,
 * échéances. Fonctions pures, testées.
 */
import { parseFrDate } from '@/features/audit/types';

import { toIsoDate } from '../validation';
import type { VehicleCategory, VehicleDocument, VehicleDocumentType, VehicleStatus } from '../types';

// ------------------------------------------------------------------ avancement

export type EssentialKey = 'price' | 'km' | 'photo';
export type EssentialItem = { key: EssentialKey; done: boolean };
export type EssentialProgress = { items: EssentialItem[]; done: number; total: number; next: EssentialKey | null };

/**
 * Les infos essentielles : prix (propriétaire seulement : l'employé ne voit aucun montant), kilométrage, photo de face.
 * `next` = la première non remplie : sa carte est mise en avant (bordure orange).
 */
export function essentialProgress(input: { showPrice: boolean; price: string; km: string; hasPhoto: boolean }): EssentialProgress {
  const items: EssentialItem[] = [
    ...(input.showPrice ? [{ key: 'price' as const, done: Number(digitsOf(input.price)) > 0 }] : []),
    { key: 'km', done: digitsOf(input.km) !== '' },
    { key: 'photo', done: input.hasPhoto },
  ];
  const done = items.filter((item) => item.done).length;
  return { items, done, total: items.length, next: items.find((item) => !item.done)?.key ?? null };
}

// ------------------------------------------------------------------ prix et kilométrage

export const digitsOf = (text: string): string => text.replace(/\D/g, '');
export const PRICE_STEP = 50;

/** « − » et « + » : par pas de 50. Sans prix, « + » part de 300 et « − » de 250 (comme la maquette) ; jamais en dessous de 0. */
export function stepPrice(current: number, direction: 1 | -1): number {
  const base = current > 0 ? current : direction === 1 ? 250 : 300;
  return Math.max(0, base + direction * PRICE_STEP);
}

/** « 45000 » → « 45 000 » (espace insécable fine) ; seuls les chiffres comptent. */
export function formatThousands(text: string): string {
  const digits = digitsOf(text).replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ------------------------------------------------------------------ statut

/** « Louable tout de suite » : activé = Disponible ; désactivé = En préparation. */
export const statusForRentable = (rentable: boolean): VehicleStatus => (rentable ? 'disponible' : 'en_preparation');

// ------------------------------------------------------------------ catégorie pré-choisie

const KEYWORDS: [VehicleCategory, RegExp][] = [
  ['minibus', /minibus|autocar|autobus|transport de personnes|vito|sprinter|hiace|crafter.*bus/i],
  ['utilitaire', /utilitaire|camionnette|fourgon|camion|pick-?up|kangoo|berlingo|partner|doblo|transit|boxer|ducato|jumpy|expert|master|hilux/i],
  ['luxe', /s-?class|classe s|serie 7|série 7|\ba8\b|\bq8\b|range rover|cayenne|panamera|\bs8\b|maybach|bentley|ghibli|quattroporte/i],
  ['suv', /suv|4x4|tout.?terrain|duster|tucson|sportage|kuga|qashqai|captur|creta|tiguan|kodiaq|karoq|t-?roc|tcross|t-cross|c3 aircross|3008|2008|5008|x1\b|x3\b|q3\b|q5\b|glc|gla|rav4|c-?hr|sorento|santa fe|stepway|arkana|kadjar|koleos|seltos|stonic|sonet|venue|juke|ateca|arona|tarraco|ecosport|puma|bronco|compass|renegade|wrangler|grand vitara|jimny|vitara/i],
  ['berline', /berline|sedan|passat|\b508\b|\b408\b|\b301\b|accent|elantra|symbol|logan|megane sedan|octavia|superb|jetta|corolla sedan|camry|civic|a4\b|a6\b|classe c|serie 3|série 3|serie 5|série 5|c-?class|e-?class|classe e|fluence|taliant|rio sedan|cerato|sonata/i],
  ['compacte', /compacte|golf|\b308\b|\b208\b|\b207\b|clio|polo|i20|i30|ibiza|leon|fiesta|focus|corsa|astra|yaris|c3\b|c4\b|megane|mégane|picanto|i10|sandero|rio\b|spark|aveo|swift|ignis|up!?\b|fabia|a3\b|serie 1|série 1|classe a/i],
];

/**
 * Catégorie pré-choisie d'après le genre lu sur la carte grise et le modèle (« à ajuster » : jamais imposée). Sans indice, rien n'est choisi.
 * Les règles sont testées dans l'ordre : minibus, utilitaire, luxe, SUV, berline, compacte.
 */
export function suggestCategory(input: { genre?: string | null; marque?: string | null; modele?: string | null }): VehicleCategory | null {
  const genre = (input.genre ?? '').trim();
  const model = `${input.marque ?? ''} ${input.modele ?? ''}`.trim();
  // Le genre de la carte grise (« Camionnette », « Autocar »…) est plus sûr que le nom du modèle.
  for (const [category, pattern] of KEYWORDS.slice(0, 2)) if (genre && pattern.test(genre)) return category;
  for (const [category, pattern] of KEYWORDS) if (model && pattern.test(model)) return category;
  return null;
}

// ------------------------------------------------------------------ échéances

export type DeadlineType = Extract<VehicleDocumentType, 'assurance' | 'visite_technique'>;
export const DEADLINE_TYPES: DeadlineType[] = ['assurance', 'visite_technique'];
/** Le rappel réel : les alertes préviennent 30 jours avant l'échéance (« À surveiller », notifications). */
export const REMINDER_DAYS = 30;

/** Saisie d'une date au fil de la frappe : « 15062031 » → « 15/06/2031 ». */
export function formatDateInput(raw: string): string {
  const digits = digitsOf(raw).slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('/');
}

/** Une date de fin valable : jour réel, année plausible (2000 à 2100). Une date passée est permise : l'alerte « expirée » la signalera. */
export function isValidDeadline(text: string): boolean {
  const date = parseFrDate(text);
  return !!date && date.getFullYear() >= 2000 && date.getFullYear() <= 2100;
}

/**
 * Documents « sans fichier » pour les échéances saisies : l'attestation n'est pas encore photographiée (chemin vide), mais la date alimente déjà
 * les rappels. Les dates vides sont ignorées.
 */
export function deadlineDocuments(dates: Partial<Record<DeadlineType, string>>, now: Date = new Date()): VehicleDocument[] {
  return DEADLINE_TYPES.flatMap((type) => {
    const iso = dates[type] ? toIsoDate(dates[type]) : null;
    return iso ? [{ type, path: '', uploadedAt: now.toISOString(), expiresAt: iso }] : [];
  });
}

// ------------------------------------------------------------------ ce qu'il reste à compléter

export type MissingKey = 'price' | 'km' | 'photo' | DeadlineType;

/**
 * Ce qui manque après l'ajout (encart « À compléter plus tard » de l'écran de succès). Le prix manque toujours à l'employé : il est créé
 * à 0 MAD et le propriétaire le complète.
 */
export function missingAfterCreate(input: { isOwner: boolean; price: string; km: string; hasPhoto: boolean; deadlines: Partial<Record<DeadlineType, string>> }): MissingKey[] {
  return [
    ...(Number(digitsOf(input.price)) > 0 && input.isOwner ? [] : (['price'] as MissingKey[])),
    ...(digitsOf(input.km) === '' ? (['km'] as MissingKey[]) : []),
    ...(input.hasPhoto ? [] : (['photo'] as MissingKey[])),
    ...DEADLINE_TYPES.filter((type) => !isValidDeadline(input.deadlines[type] ?? '')),
  ];
}
