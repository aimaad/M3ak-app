/**
 * Modèle de la page « Ma Flotte » : statut d'AUJOURD'HUI de chaque véhicule et sa frise des 7 prochains jours, tirés de
 * `buildAvailability` (lecture seule, la même source que le bloc « Disponibilités » et le Parc de l'accueil). Les chiffres sont donc
 * identiques à ceux de l'accueil. Fonctions pures : « maintenant » est un paramètre.
 */
import {
  buildAvailability,
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

/** Couleur d'un jour de la frise : libre, loué, immobilisé. */
export type WeekKind = 'free' | 'rented' | 'immobilized';

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

export const weekKindOfStatus = (status: DayStatus): WeekKind => groupOfSection(sectionOfStatus(status));

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
};

/** Un élément par véhicule ACTIF (les archivés ne sont pas dans la flotte affichée). Un seul calcul pour toute la flotte. */
export function buildFleetItems(input: { vehicles: Vehicle[]; rentals: Rental[]; maintenance: MaintenanceItem[]; now: Date }): FleetItem[] {
  const days = buildAvailability(input);
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
      return [{ vehicle, today, section, group: groupOfSection(section), week: byVehicle.get(vehicle.id) ?? [], occupancy: occupancy.get(vehicle.id) ?? 0 }];
    });
}

export type FleetCounts = Record<FleetGroup, number> & { total: number };

export function groupCounts(items: FleetItem[]): FleetCounts {
  const counts: FleetCounts = { free: 0, rented: 0, immobilized: 0, total: items.length };
  for (const item of items) counts[item.group] += 1;
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

export type FleetSectionData = { key: FleetSection; items: FleetItem[] };

/** Sections non vides, dans l'ordre : À inspecter, Entretien, Indisponibles, En location, Disponibles. */
export function buildSections(items: FleetItem[]): FleetSectionData[] {
  return SECTION_ORDER.map((key) => ({ key, items: items.filter((item) => item.section === key) })).filter((section) => section.items.length > 0);
}

/** « Dacia Logan » : nom court d'un véhicule. */
export const fleetName = (vehicle: Pick<Vehicle, 'marque' | 'modele'>) => `${vehicle.marque} ${vehicle.modele}`.trim();
