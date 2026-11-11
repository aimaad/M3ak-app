/**
 * « Conseil BIBIP » de Ma Flotte : calculé localement, sans IA, un seul conseil à la fois, par priorité :
 *   0. un retour en retard (le plus gros retard d'abord) → « RETOUR EN RETARD », bouton « Appeler {client} ». Visible de TOUS les rôles :
 *      il ne contient aucun montant. Les conseils 1 et 2 sont réservés au propriétaire ;
 *   1. un véhicule disponible sans aucune réservation sur les 7 prochains jours → « Une offre week-end ? » ;
 *   2. un véhicule à inspecter depuis plus de 2 jours (depuis le retour réel de sa dernière location) → « Inspecter ».
 * Sans location terminée, on ne peut pas dater l'attente : pas de conseil 2. « Plus tard » masque un conseil 24 h.
 */
import { dayKey } from '@/features/dashboard/availability';
import type { Customer } from '@/features/customers/types';
import type { Rental } from '@/features/rentals/types';

import { customerShortName } from './fleet-card';
import { fleetName, lateRank, type FleetItem, type LateInfo } from './fleet-model';

const DAY_MS = 24 * 60 * 60 * 1000;
export const SNOOZE_MS = DAY_MS;
/** Au-delà de ce délai (strictement), un véhicule « à inspecter » déclenche le conseil. */
export const INSPECTION_WAIT_DAYS = 2;

export type Advice =
  | {
      kind: 'late';
      key: string;
      vehicleId: string;
      vehicleName: string;
      late: LateInfo;
      /** Jour du retour prévu (AAAA-MM-JJ, heure locale). */
      dueDay: string;
      customerName: string | null;
      phone: string | null;
    }
  | { kind: 'noBooking'; key: string; vehicleId: string; vehicleName: string }
  | { kind: 'waitingInspection'; key: string; vehicleId: string; vehicleName: string; days: number };

/** Conseils possibles, du plus prioritaire au moins prioritaire (à l'intérieur d'une règle : par nom, ou le plus ancien d'abord). */
export function adviceCandidates(input: { items: FleetItem[]; rentals: Rental[]; customers?: Pick<Customer, 'id' | 'nomComplet' | 'telephone'>[]; now: Date }): Advice[] {
  const { items, rentals, now } = input;
  const customerById = new Map((input.customers ?? []).map((customer) => [customer.id, customer]));
  const rentalById = new Map(rentals.map((rental) => [rental.id, rental]));

  const late: Advice[] = items
    .filter((item) => item.late)
    .sort((a, b) => lateRank(b.late, now) - lateRank(a.late, now) || fleetName(a.vehicle).localeCompare(fleetName(b.vehicle)))
    .map((item): Advice => {
      const info = item.late as LateInfo;
      const customer = customerById.get(rentalById.get(info.rentalId)?.customerId ?? '');
      return {
        kind: 'late',
        key: `late:${item.vehicle.id}`,
        vehicleId: item.vehicle.id,
        vehicleName: fleetName(item.vehicle),
        late: info,
        dueDay: dayKey(new Date(info.dueAt)),
        customerName: customerShortName(customer?.nomComplet),
        phone: customer?.telephone?.trim() || null,
      };
    });

  const noBooking: Advice[] = items
    .filter((item) => item.section === 'free' && item.week.length > 0 && item.week.every((day) => day.kind === 'free'))
    .map((item) => ({ kind: 'noBooking' as const, key: `noBooking:${item.vehicle.id}`, vehicleId: item.vehicle.id, vehicleName: fleetName(item.vehicle) }))
    .sort((a, b) => a.vehicleName.localeCompare(b.vehicleName));

  const lastReturn = new Map<string, number>();
  for (const rental of rentals) {
    if (rental.statut !== 'terminee' || !rental.dateRetourReel) continue;
    const time = new Date(rental.dateRetourReel).getTime();
    if (Number.isFinite(time) && time > (lastReturn.get(rental.vehicleId) ?? 0)) lastReturn.set(rental.vehicleId, time);
  }
  const waiting = items
    .filter((item) => item.section === 'inspect' && item.vehicle.statut === 'a_inspecter' && lastReturn.has(item.vehicle.id))
    .map((item) => ({ item, since: lastReturn.get(item.vehicle.id) as number }))
    .filter(({ since }) => now.getTime() - since > INSPECTION_WAIT_DAYS * DAY_MS)
    .sort((a, b) => a.since - b.since)
    .map(({ item, since }): Advice => ({ kind: 'waitingInspection', key: `waitingInspection:${item.vehicle.id}`, vehicleId: item.vehicle.id, vehicleName: fleetName(item.vehicle), days: Math.floor((now.getTime() - since) / DAY_MS) }));

  return [...late, ...noBooking, ...waiting];
}

/** Le propriétaire voit tous les conseils ; les autres rôles ne voient que le retard (aucun montant). */
export const visibleAdvice = (candidates: Advice[], isOwner: boolean): Advice[] => (isOwner ? candidates : candidates.filter((advice) => advice.kind === 'late'));

/** Conseils masqués par « Plus tard » : identifiant du conseil → fin du masquage (ms). */
export type SnoozeMap = Record<string, number>;

export const isSnoozed = (map: SnoozeMap, key: string, now: Date): boolean => (map[key] ?? 0) > now.getTime();

/** Masque un conseil 24 h ; les masquages expirés sont oubliés. */
export function snoozeAdvice(map: SnoozeMap, key: string, now: Date): SnoozeMap {
  const next: SnoozeMap = {};
  for (const [existing, until] of Object.entries(map)) if (until > now.getTime()) next[existing] = until;
  next[key] = now.getTime() + SNOOZE_MS;
  return next;
}

/** Le conseil à afficher : le premier qui n'est pas masqué. Aucun = pas de carte. */
export function pickAdvice(candidates: Advice[], snoozed: SnoozeMap, now: Date): Advice | null {
  return candidates.find((advice) => !isSnoozed(snoozed, advice.key, now)) ?? null;
}

/** Lecture sûre de la mémoire locale (valeur inconnue ou abîmée = rien de masqué). */
export function parseSnoozeMap(raw: string | null): SnoozeMap {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])));
  } catch {
    return {};
  }
}
