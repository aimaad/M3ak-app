/**
 * Carte véhicule de Ma Flotte : occupation sur 30 jours, ligne de contexte, plaque marocaine, résumé de la frise (lecture à voix
 * haute) et bouton d'action. Fonctions pures : « maintenant » est un paramètre, aucune requête (tout vient des listes déjà chargées).
 */
import { dayKey, parseDayKey } from '@/features/dashboard/availability';
import type { AgencyRole } from '@/features/agency/types';
import type { Customer } from '@/features/customers/types';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';

import type { FleetItem, WeekKind } from './fleet-model';
import { inspectionHref, type FleetHref } from './fleet-routes';

// ------------------------------------------------------------------ occupation sur 30 jours

export const OCCUPANCY_DAYS = 30;
const addDays = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
const startOfLocalDay = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

/**
 * Occupation de chaque véhicule : jours loués sur les 30 derniers jours (aujourd'hui compris) ÷ 30, en %. Compte les locations en
 * cours et terminées, avec les dates RÉELLES quand elles existent (départ et retour réels), sinon les dates prévues ; une location à
 * cheval sur deux périodes ne compte que ses jours dans la fenêtre ; deux locations le même jour ne comptent qu'une fois.
 */
export function occupancyByVehicle(rentals: Rental[], now: Date): Map<string, number> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const first = addDays(today, -(OCCUPANCY_DAYS - 1));
  const days = new Map<string, Set<string>>();
  for (const rental of rentals) {
    if (rental.statut !== 'en_cours' && rental.statut !== 'terminee') continue;
    const start = startOfLocalDay(rental.dateDepartReel ?? rental.dateDebutPrevue);
    const endIso = rental.dateRetourReel ?? (rental.statut === 'en_cours' ? now.toISOString() : rental.dateFinPrevue);
    let end = startOfLocalDay(endIso);
    if (end.getTime() < start.getTime()) end = start;
    const from = start.getTime() < first.getTime() ? first : start;
    const to = end.getTime() > today.getTime() ? today : end;
    if (from.getTime() > to.getTime()) continue;
    const set = days.get(rental.vehicleId) ?? new Set<string>();
    for (let day = from; day.getTime() <= to.getTime(); day = addDays(day, 1)) set.add(dayKey(day));
    days.set(rental.vehicleId, set);
  }
  return new Map([...days].map(([vehicleId, set]) => [vehicleId, Math.round((set.size / OCCUPANCY_DAYS) * 100)]));
}

/** Couleur de la barre d'occupation : ≥ 60 % bon (vert), 30 à 59 % neutre (graphite), < 30 % à surveiller (orange). */
export type OccupancyTone = 'good' | 'neutral' | 'low';
export const occupancyTone = (percent: number): OccupancyTone => (percent >= 60 ? 'good' : percent >= 30 ? 'neutral' : 'low');

// ------------------------------------------------------------------ plaque marocaine

export type PlateParts = { number: string; letter: string; region: string };

/** Marques invisibles de sens d'écriture (souvent collées avec une plaque copiée) : elles brouillent l'ordre d'affichage. */
const BIDI_MARKS = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g;
const cleanPlate = (raw: string) => raw.replace(BIDI_MARKS, '');

/** « 68013 | ب | 72 » (ou « 8921-ب-14 ») → numéro, lettre, région ; null si le format n'est pas reconnu (la plaque s'affiche alors telle quelle). */
export function parsePlate(raw: string): PlateParts | null {
  const match = /^\s*(\d+)\s*[|\-–/ ]\s*([^\d\s|\-–/]+)\s*[|\-–/ ]\s*(\d+)\s*$/u.exec(cleanPlate(raw));
  return match ? { number: match[1], letter: match[2], region: match[3] } : null;
}

/** Texte de la plaque, toujours dans l'ordre numéro | lettre | région (même en arabe). */
export const plateText = (raw: string): string => {
  const parts = parsePlate(raw);
  return parts ? `${parts.number} | ${parts.letter} | ${parts.region}` : cleanPlate(raw).trim();
};

/** Plaque lue à voix haute : « 68013 ب 72 ». */
export const plateSpoken = (raw: string): string => {
  const parts = parsePlate(raw);
  return parts ? `${parts.number} ${parts.letter} ${parts.region}` : cleanPlate(raw).trim();
};

// ------------------------------------------------------------------ ligne de contexte

/** « Youssef Alami » → « Youssef A. » ; un seul mot : tel quel ; vide : null. */
export function customerShortName(fullName: string | null | undefined): string | null {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) return words[0];
  return `${words[0]} ${Array.from(words[words.length - 1])[0]}.`;
}

export type FleetContext =
  | { kind: 'rented'; name: string | null; endDay: string | null; late: boolean }
  | { kind: 'free'; untilDay: string | null }
  | { kind: 'inspect' }
  | { kind: 'maintenance'; returnDay: string | null; planned: boolean }
  | { kind: 'unavailable' };

/**
 * Ligne de contexte d'une carte, avec la même logique que « Disponibilités » : locataire et retour prévu, « libre jusqu'au… » ou
 * « toute la semaine », inspection avant remise, retour d'atelier (sans date : « Au garage »).
 */
export function contextOf(
  item: FleetItem,
  data: { customers: Map<string, Pick<Customer, 'nomComplet'>>; rentals: Map<string, Rental>; maintenance: MaintenanceItem[] }
): FleetContext {
  const { today, section, week } = item;
  switch (section) {
    case 'rented': {
      const rental = today.rentalId ? data.rentals.get(today.rentalId) : undefined;
      const name = rental ? customerShortName(data.customers.get(rental.customerId)?.nomComplet) : null;
      const endDay = today.endDay ?? (rental ? dayKey(new Date(rental.dateFinPrevue)) : null);
      return { kind: 'rented', name, endDay, late: today.status === 'late' };
    }
    case 'free': {
      const lastWeekDay = week[week.length - 1]?.key;
      // « Libre jusqu'au ven. 13 » seulement si la fin de la disponibilité tombe dans les 7 jours affichés.
      const untilDay = today.freeUntil && (!lastWeekDay || today.freeUntil < lastWeekDay) ? today.freeUntil : null;
      return { kind: 'free', untilDay };
    }
    case 'inspect':
      return { kind: 'inspect' };
    case 'maintenance': {
      const open = data.maintenance.find((entry) => entry.vehicleId === item.vehicle.id && entry.statut === 'en_cours');
      return { kind: 'maintenance', returnDay: open?.echeanceDate ? open.echeanceDate.slice(0, 10) : null, planned: today.atGarage === false };
    }
    case 'unavailable':
      return { kind: 'unavailable' };
  }
}

// ------------------------------------------------------------------ résumé de la frise (lecture à voix haute)

export type WeekRun = { kind: WeekKind; lastDay: string };

/** Plages consécutives de même couleur, avec le dernier jour de chacune. */
export function weekRuns(week: { key: string; kind: WeekKind }[]): WeekRun[] {
  const runs: WeekRun[] = [];
  for (const day of week) {
    const last = runs[runs.length - 1];
    if (last && last.kind === day.kind) last.lastDay = day.key;
    else runs.push({ kind: day.kind, lastDay: day.key });
  }
  return runs;
}

/**
 * Phrase de la frise : « libre jusqu'au vendredi 13 puis loué » ; une seule plage : « libre toute la semaine ».
 * Les mots viennent de `words` (traductions) ; `formatDay` écrit la date (« vendredi 13 »).
 */
export function weekSummary(
  week: { key: string; kind: WeekKind }[],
  words: { state: Record<WeekKind, string>; until: (state: string, date: string) => string; allWeek: (state: string) => string; then: string },
  formatDay: (dayKey: string) => string
): string {
  const runs = weekRuns(week);
  if (runs.length === 0) return '';
  if (runs.length === 1) return words.allWeek(words.state[runs[0].kind]);
  return runs.map((run, index) => (index < runs.length - 1 ? words.until(words.state[run.kind], formatDay(run.lastDay)) : words.state[run.kind])).join(words.then);
}

/** « lun. 16 » / « lundi 16 » d'un jour AAAA-MM-JJ, dans la langue de l'app. */
export function formatDayLabel(key: string, language: string, style: 'short' | 'long' = 'short'): string {
  return parseDayKey(key).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { weekday: style, day: 'numeric' });
}

// ------------------------------------------------------------------ bouton d'action

export type FleetActionKind = 'rent' | 'extend' | 'inspect' | 'maintenance';
export type FleetAction = { kind: FleetActionKind; href: FleetHref };

/**
 * Bouton d'action d'une carte, choisi par la section du véhicule et le rôle :
 *  - disponible → « Louer » (nouvelle location préremplie) ;
 *  - en location → « Prolonger » : propriétaire et responsable seulement ;
 *  - à inspecter → « Inspecter » ; entretien → « Voir l'entretien » ; indisponible → aucun.
 * Une action que l'utilisateur n'a pas le droit de faire n'apparaît pas.
 */
export function actionFor(item: FleetItem, role: AgencyRole | null | undefined, rentals: Rental[], now: Date): FleetAction | null {
  switch (item.section) {
    case 'free':
      return { kind: 'rent', href: { pathname: '/locations/nouveau', params: { vehicleId: item.vehicle.id, date: dayKey(now) } } };
    case 'rented':
      if ((role !== 'owner' && role !== 'manager') || !item.today.rentalId) return null;
      return { kind: 'extend', href: { pathname: '/locations/[id]', params: { id: item.today.rentalId, prolonger: '1' } } };
    case 'inspect':
      return { kind: 'inspect', href: inspectionHref(item.vehicle.id, rentals) };
    case 'maintenance':
      return { kind: 'maintenance', href: { pathname: '/flotte/[id]', params: { id: item.vehicle.id, section: 'entretien' } } };
    case 'unavailable':
      return null;
  }
}

/** Ajout de photo depuis la carte : réservé aux membres de l'agence (comme la sécurité du serveur : écriture de la photo et mise à jour du véhicule). */
export const canAddVehiclePhoto = (role: AgencyRole | null | undefined): boolean => role === 'owner' || role === 'manager' || role === 'employee';

/** Les montants (prix, offre) ne sont visibles que du propriétaire. */
export const canSeePrices = (role: AgencyRole | null | undefined): boolean => role === 'owner';
