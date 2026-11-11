/**
 * Modèle de la page « Ma Flotte » : statut d'AUJOURD'HUI de chaque véhicule et sa frise des 7 prochains jours, tirés de
 * `buildAvailability` (lecture seule, la même source que le bloc « Disponibilités » et le Parc de l'accueil). Les chiffres sont donc
 * identiques à ceux de l'accueil. Fonctions pures : « maintenant » est un paramètre.
 */
import {
  buildAvailability,
  dayKey,
  parseDayKey,
  type DayStatus,
  type VehicleDay,
} from '@/features/dashboard/availability';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';

import { occupancyByVehicle } from './fleet-card';
import type { Vehicle } from './types';

/** Les 3 groupes affichés : tuiles, anneau et compteurs. */
export type FleetGroup = 'free' | 'rented' | 'immobilized';
export const FLEET_GROUPS: FleetGroup[] = ['free', 'rented', 'immobilized'];

/** Sections de la liste, dans l'ordre d'affichage. Les immobilisés sont détaillés. */
export type FleetSection = 'inspect' | 'maintenance' | 'unavailable' | 'rented' | 'free';
export const SECTION_ORDER: FleetSection[] = ['inspect', 'maintenance', 'unavailable', 'rented', 'free'];

/** Couleur d'un jour de la frise : libre, loué, immobilisé, ou en retard (rouge tant que le véhicule n'est pas rendu). */
export type WeekKind = FleetGroup | 'late';

/**
 * Retour en retard : ÉTAT CALCULÉ (jamais un statut en base). Une location en cours dont le retour prévu est dépassé.
 * `amount` + `unit` : en jours civils (heure de l'appareil) dès 24 h de retard, sinon en heures (1 h minimum).
 */
export type LateInfo = { rentalId: string; dueAt: string; amount: number; unit: 'days' | 'hours' };

const HOUR_MS = 60 * 60 * 1000;

/** Retard d'une location : null si la date prévue manque, est invalide ou n'est pas encore dépassée. */
export function lateInfo(rentalId: string, dueAt: string | null | undefined, now: Date): LateInfo | null {
  const due = dueAt ? new Date(dueAt) : null;
  if (!due || !Number.isFinite(due.getTime()) || due.getTime() >= now.getTime()) return null;
  const elapsed = now.getTime() - due.getTime();
  if (elapsed < 24 * HOUR_MS) return { rentalId, dueAt: dueAt as string, amount: Math.max(1, Math.floor(elapsed / HOUR_MS)), unit: 'hours' };
  // Jours civils à l'heure locale : insensible au changement d'heure ; au moins 1 puisque 24 h se sont écoulées.
  const days = Math.round((parseDayKey(dayKey(now)).getTime() - parseDayKey(dayKey(due)).getTime()) / (24 * HOUR_MS));
  return { rentalId, dueAt: dueAt as string, amount: Math.max(1, days), unit: 'days' };
}

/** Durée de retard en heures, pour classer (le plus gros retard d'abord). */
export const lateRank = (late: LateInfo | null, now: Date): number => (late ? now.getTime() - new Date(late.dueAt).getTime() : -1);

export function sectionOfStatus(status: DayStatus): FleetSection {
  switch (status) {
    case 'free':
      return 'free';
    case 'rented':
    case 'toConfirm':
    case 'late':
      return 'rented';
    case 'inspection':
      return 'inspect';
    case 'maintenance':
      return 'maintenance';
    case 'unavailable':
      return 'unavailable';
  }
}

export function groupOfSection(section: FleetSection): FleetGroup {
  return section === 'free' ? 'free' : section === 'rented' ? 'rented' : 'immobilized';
}

export const weekKindOfStatus = (status: DayStatus): WeekKind => (status === 'late' ? 'late' : groupOfSection(sectionOfStatus(status)));

export type WeekDay = { key: string; date: Date; kind: WeekKind; status: DayStatus };

export type FleetItem = {
  vehicle: Vehicle;
  /** Le véhicule aujourd'hui (statut, location en cours, fin prévue, « libre jusqu'au »…). */
  today: VehicleDay;
  section: FleetSection;
  group: FleetGroup;
  /** Les 7 prochains jours, aujourd'hui en premier. */
  week: WeekDay[];
  /** Occupation sur les 30 derniers jours, en % (jours loués ÷ 30). */
  occupancy: number;
  /** Retour en retard (le véhicule reste dans « En location »), ou null. */
  late: LateInfo | null;
};

/** Un élément par véhicule ACTIF (les archivés ne sont pas dans la flotte affichée). Un seul calcul pour toute la flotte. */
export function buildFleetItems(input: { vehicles: Vehicle[]; rentals: Rental[]; maintenance: MaintenanceItem[]; now: Date }): FleetItem[] {
  const days = buildAvailability(input);
  const rentalById = new Map(input.rentals.map((rental) => [rental.id, rental]));
  const occupancy = occupancyByVehicle(input.rentals, input.now);
  const byVehicle = new Map<string, WeekDay[]>();
  const todayOf = new Map<string, VehicleDay>();
  for (const [index, day] of days.entries()) {
    for (const entry of day.vehicles) {
      byVehicle.set(entry.vehicleId, [...(byVehicle.get(entry.vehicleId) ?? []), { key: day.key, date: day.date, kind: weekKindOfStatus(entry.status), status: entry.status }]);
      if (index === 0) todayOf.set(entry.vehicleId, entry);
    }
  }
  return input.vehicles
    .filter((vehicle) => !vehicle.archivedAt)
    .flatMap((vehicle) => {
      const today = todayOf.get(vehicle.id);
      if (!today) return [];
      const section = sectionOfStatus(today.status);
      const rental = today.status === 'late' && today.rentalId ? rentalById.get(today.rentalId) : undefined;
      const late = rental ? lateInfo(rental.id, rental.dateFinPrevue, input.now) : null;
      return [{ vehicle, today, section, group: groupOfSection(section), week: byVehicle.get(vehicle.id) ?? [], occupancy: occupancy.get(vehicle.id) ?? 0, late }];
    });
}

/** `rented` compte toutes les locations, retards compris ; `late` est le nombre de retours en retard parmi elles. */
export type FleetCounts = Record<FleetGroup, number> & { total: number; late: number };

export function groupCounts(items: FleetItem[]): FleetCounts {
  const counts: FleetCounts = { free: 0, rented: 0, immobilized: 0, total: items.length, late: 0 };
  for (const item of items) {
    counts[item.group] += 1;
    if (item.late) counts.late += 1;
  }
  return counts;
}

/** Part des véhicules en location (anneau, « EN ROUTE ») ; 0 si la flotte est vide. */
export function rentedPercent(counts: FleetCounts): number {
  return counts.total > 0 ? Math.round((counts.rented / counts.total) * 100) : 0;
}

/** Un tap sur une tuile filtre ; un second tap sur la tuile active revient à « Tous » (null). */
export function toggleGroup(current: FleetGroup | null, tapped: FleetGroup): FleetGroup | null {
  return current === tapped ? null : tapped;
}

export function matchesGroup(item: FleetItem, group: FleetGroup | null): boolean {
  return group === null || item.group === group;
}

/** Lien venu de l'accueil (`/flotte?statut=…`) : le statut du véhicule devient le groupe correspondant. */
export function groupFromStatusParam(statut: string | undefined): FleetGroup | null {
  switch (statut) {
    case 'disponible':
      return 'free';
    case 'en_location':
      return 'rented';
    case 'a_inspecter':
    case 'maintenance':
    case 'en_preparation':
    case 'indisponible':
      return 'immobilized';
    default:
      return null;
  }
}

export type FleetSectionData = { key: FleetSection; items: FleetItem[]; /** Retours en retard dans la section (« En location » seulement). */ late: number };

/**
 * Sections non vides, dans l'ordre : À inspecter, Entretien, Indisponibles, En location, Disponibles. Dans « En location », les retours en
 * retard passent en premier (le plus gros retard en tête) ; le reste garde l'ordre reçu (tri choisi).
 */
export function buildSections(items: FleetItem[], now: Date = new Date()): FleetSectionData[] {
  return SECTION_ORDER.map((key) => {
    const inSection = items.filter((item) => item.section === key);
    const sorted = key === 'rented' ? [...inSection].sort((a, b) => lateRank(b.late, now) - lateRank(a.late, now)) : inSection;
    return { key, items: sorted, late: sorted.filter((item) => item.late).length };
  }).filter((section) => section.items.length > 0);
}

/** « Dacia Logan » : nom court d'un véhicule. */
export const fleetName = (vehicle: Pick<Vehicle, 'marque' | 'modele'>) => `${vehicle.marque} ${vehicle.modele}`.trim();
