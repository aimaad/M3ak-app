/**
 * Disponibilités du parc, jour par jour (bloc « Disponibilités » de l'accueil). Fonctions pures : « maintenant » est un paramètre.
 * Les jours sont des jours civils à l'heure locale du téléphone, comme le reste de l'accueil.
 *
 * Statut d'un véhicule un jour J, par ordre de priorité :
 *   Retard > Inspection / Entretien > Indisponible > Louée > À confirmer > Libre.
 * - Retard : location en cours dont le retour prévu est passé ; occupé « en retard » à partir d'aujourd'hui, tous les jours,
 *   jusqu'au retour réel (on ne propose pas de le relouer).
 * - Entretien : statut « maintenance », un entretien « en cours », ou un entretien non effectué prévu le jour J.
 * - Inspection : statut « à inspecter » ou « en préparation ».
 * - Indisponible : statut « indisponible » (hors parc libre).
 * - Louée : location confirmée, réservée ou en cours qui couvre J. À confirmer : réservation en attente de confirmation.
 * Les statuts du véhicule (inspection, entretien, indisponible) valent pour aujourd'hui et les jours suivants : on ne connaît
 * pas leur fin, et on ne propose jamais à la location un véhicule qui n'est pas prêt.
 */
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '@/features/vehicles/types';

import { startOfDay } from './kpis';

export const AVAILABILITY_DAYS = 7;

export type DayStatus = 'late' | 'inspection' | 'maintenance' | 'unavailable' | 'rented' | 'toConfirm' | 'free';

/** Ordre d'affichage des véhicules occupés (le plus urgent d'abord). */
const BUSY_RANK: Record<Exclude<DayStatus, 'free'>, number> = {
  late: 0,
  maintenance: 1,
  inspection: 2,
  unavailable: 3,
  rented: 4,
  toConfirm: 5,
};

export type VehicleDay = {
  vehicleId: string;
  label: string;
  status: DayStatus;
  /** Location qui occupe le véhicule ce jour-là (louée, à confirmer) ; pour un retard : la location en retard. */
  rentalId?: string;
  /** Jour de fin prévue de la location (louée) / de début (à confirmer), au format AAAA-MM-JJ local. */
  endDay?: string;
  startDay?: string;
  /** Retard seulement : une location prévue chevauche le retard (conflit). */
  conflict?: { rentalId: string; startDay: string };
  /** Entretien : « Au garage » (statut ou entretien en cours) ou « Entretien prévu ». */
  atGarage?: boolean;
  /** Libre seulement : dernier jour libre avant la prochaine occupation (null = aucune réservation à venir). */
  freeUntil?: string | null;
};

export type DaySummary = {
  /** Jour local au format AAAA-MM-JJ. */
  key: string;
  date: Date;
  vehicles: VehicleDay[];
  counts: { free: number; rented: number; late: number; inspectionMaintenance: number; unavailable: number };
};

export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Date locale (minuit) d'une clé AAAA-MM-JJ. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const addDays = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
const dayOf = (iso: string | null | undefined): string | null => (iso ? dayKey(new Date(iso)) : null);

const RENTED_STATUSES: Rental['statut'][] = ['en_cours', 'confirmee', 'reservee'];
const BLOCKING: Rental['statut'][] = ['en_cours', 'confirmee', 'reservee', 'en_attente_confirmation'];

type Context = {
  rentalsByVehicle: Map<string, Rental[]>;
  maintenanceByVehicle: Map<string, MaintenanceItem[]>;
  now: Date;
  today: string;
};

function group<T extends { vehicleId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(item.vehicleId, [...(map.get(item.vehicleId) ?? []), item]);
  return map;
}

const isLate = (rental: Rental, now: Date) => rental.statut === 'en_cours' && new Date(rental.dateFinPrevue).getTime() < now.getTime();

/** Locations non commencées (réservées, confirmées, à confirmer) qui couvrent le jour `key`. */
function futureCovering(rentals: Rental[], key: string): Rental | undefined {
  return rentals
    .filter((r) => r.statut !== 'en_cours' && BLOCKING.includes(r.statut))
    .filter((r) => (dayOf(r.dateDebutPrevue) as string) <= key && key <= (dayOf(r.dateFinPrevue) as string))
    .sort((a, b) => a.dateDebutPrevue.localeCompare(b.dateDebutPrevue))[0];
}

/** Premier jour (après `key`) où le véhicule cesse d'être libre : location prévue ou entretien prévu. null = jamais. */
function nextBusyDay(vehicleId: string, key: string, ctx: Context): string | null {
  const days: string[] = [];
  for (const r of ctx.rentalsByVehicle.get(vehicleId) ?? []) {
    if (!BLOCKING.includes(r.statut)) continue;
    const start = dayOf(r.dateDebutPrevue) as string;
    if (start > key) days.push(start);
  }
  for (const m of ctx.maintenanceByVehicle.get(vehicleId) ?? []) {
    if (m.statut !== 'effectuee' && m.echeanceDate && m.echeanceDate.slice(0, 10) > key) days.push(m.echeanceDate.slice(0, 10));
  }
  return days.sort()[0] ?? null;
}

export function vehicleDay(vehicle: Vehicle, key: string, ctx: Context): VehicleDay {
  const label = `${vehicle.marque} ${vehicle.modele}`.trim();
  const base = { vehicleId: vehicle.id, label };
  const rentals = ctx.rentalsByVehicle.get(vehicle.id) ?? [];
  const isTodayOrLater = key >= ctx.today;

  // 1. Retard : occupé en retard à partir d'aujourd'hui jusqu'au retour réel.
  const late = rentals.find((r) => isLate(r, ctx.now));
  if (late && isTodayOrLater) {
    const threatened = futureCovering(rentals, key);
    return {
      ...base,
      status: 'late',
      rentalId: late.id,
      ...(threatened ? { conflict: { rentalId: threatened.id, startDay: dayOf(threatened.dateDebutPrevue) as string } } : {}),
    };
  }

  // 2. Entretien / Inspection.
  const items = ctx.maintenanceByVehicle.get(vehicle.id) ?? [];
  const inProgress = items.some((m) => m.statut === 'en_cours');
  const plannedToday = items.some((m) => m.statut !== 'effectuee' && m.statut !== 'en_cours' && m.echeanceDate?.slice(0, 10) === key);
  if (isTodayOrLater && (vehicle.statut === 'maintenance' || inProgress)) return { ...base, status: 'maintenance', atGarage: true };
  if (plannedToday) return { ...base, status: 'maintenance', atGarage: false };
  if (isTodayOrLater && (vehicle.statut === 'a_inspecter' || vehicle.statut === 'en_preparation')) return { ...base, status: 'inspection' };

  // 3. Indisponible.
  if (isTodayOrLater && vehicle.statut === 'indisponible') return { ...base, status: 'unavailable' };

  // 4. Louée / À confirmer.
  const covering = rentals
    .filter((r) => BLOCKING.includes(r.statut) && !isLate(r, ctx.now))
    .filter((r) => (dayOf(r.statut === 'en_cours' ? (r.dateDepartReel ?? r.dateDebutPrevue) : r.dateDebutPrevue) as string) <= key && key <= (dayOf(r.dateFinPrevue) as string))
    .sort((a, b) => (RENTED_STATUSES.includes(a.statut) ? 0 : 1) - (RENTED_STATUSES.includes(b.statut) ? 0 : 1))[0];
  if (covering) {
    const rented = RENTED_STATUSES.includes(covering.statut);
    return {
      ...base,
      status: rented ? 'rented' : 'toConfirm',
      rentalId: covering.id,
      endDay: dayOf(covering.dateFinPrevue) as string,
      startDay: dayOf(covering.dateDebutPrevue) as string,
    };
  }

  // 5. Libre.
  const next = nextBusyDay(vehicle.id, key, ctx);
  return { ...base, status: 'free', freeUntil: next ? dayKey(addDays(parseDayKey(next), -1)) : null };
}

const COMPARE_FREE = (a: VehicleDay, b: VehicleDay) => {
  // Libre le plus longtemps d'abord ; sans limite (null) avant tout.
  if (a.freeUntil === b.freeUntil) return a.label.localeCompare(b.label);
  if (a.freeUntil === null) return -1;
  if (b.freeUntil === null) return 1;
  return (b.freeUntil as string).localeCompare(a.freeUntil as string);
};

export function sortFree(vehicles: VehicleDay[]): VehicleDay[] {
  return vehicles.filter((v) => v.status === 'free').sort(COMPARE_FREE);
}

export function sortBusy(vehicles: VehicleDay[]): VehicleDay[] {
  return vehicles
    .filter((v) => v.status !== 'free')
    .sort((a, b) => BUSY_RANK[a.status as Exclude<DayStatus, 'free'>] - BUSY_RANK[b.status as Exclude<DayStatus, 'free'>] || a.label.localeCompare(b.label));
}

export function buildAvailability(input: {
  vehicles: Vehicle[];
  rentals: Rental[];
  maintenance: MaintenanceItem[];
  now: Date;
  days?: number;
}): DaySummary[] {
  const fleet = input.vehicles.filter((v) => !v.archivedAt);
  const today = startOfDay(input.now);
  const ctx: Context = {
    rentalsByVehicle: group(input.rentals),
    maintenanceByVehicle: group(input.maintenance),
    now: input.now,
    today: dayKey(today),
  };
  return Array.from({ length: input.days ?? AVAILABILITY_DAYS }, (_, i) => {
    const date = addDays(today, i);
    const key = dayKey(date);
    const vehicles = fleet.map((v) => vehicleDay(v, key, ctx));
    const count = (pred: (v: VehicleDay) => boolean) => vehicles.filter(pred).length;
    return {
      key,
      date,
      vehicles,
      counts: {
        free: count((v) => v.status === 'free'),
        rented: count((v) => v.status === 'rented' || v.status === 'toConfirm'),
        late: count((v) => v.status === 'late'),
        inspectionMaintenance: count((v) => v.status === 'inspection' || v.status === 'maintenance'),
        unavailable: count((v) => v.status === 'unavailable'),
      },
    };
  });
}

/**
 * Véhicules libres aujourd'hui : la SEULE source du chiffre « N véhicules disponibles » de l'en-tête, de « Disponibles » du
 * Parc et du badge d'aujourd'hui dans Disponibilités. Prend la journée d'aujourd'hui de `buildAvailability`.
 */
export function freeToday(days: DaySummary[]): number {
  return days[0]?.counts.free ?? 0;
}

/** Répartition du parc aujourd'hui pour le bloc Parc (même calcul : les trois lignes couvrent tout le parc). */
export function parcCounts(days: DaySummary[]): { free: number; rented: number; toInspect: number; total: number } {
  const c = days[0]?.counts;
  if (!c) return { free: 0, rented: 0, toInspect: 0, total: 0 };
  const rented = c.rented + c.late;
  const toInspect = c.inspectionMaintenance + c.unavailable;
  return { free: c.free, rented, toInspect, total: c.free + rented + toInspect };
}

export type ConflictSummary = { count: number; firstRentalId: string | null };

/**
 * Conflits : réservations prévues dans les 7 jours sur un véhicule dont la location en cours est en retard. Le véhicule reste
 * « Retard » et la réservation est menacée : à réaffecter. `firstRentalId` = la réservation la plus proche.
 */
export function conflicts(days: DaySummary[]): ConflictSummary {
  const found = new Map<string, string>();
  for (const day of days) {
    for (const v of day.vehicles) {
      if (v.status === 'late' && v.conflict) found.set(v.conflict.rentalId, v.conflict.startDay);
    }
  }
  const ordered = [...found.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  return { count: ordered.length, firstRentalId: ordered[0]?.[0] ?? null };
}
