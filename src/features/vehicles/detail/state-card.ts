/**
 * Carte d'état de la fiche véhicule : ce que dit la carte (titre, détail, barre de progression) et les deux boutons, selon la situation du
 * véhicule et le rôle. Fonction pure : « maintenant » est un paramètre, les dates sont formatées par l'appelant (règle de Ma Flotte : le mois
 * apparaît au-delà de 7 jours et dans le passé). Les actions suivent les droits : « Prolonger » est réservé au propriétaire et au responsable ;
 * un bouton sans droit est ABSENT (jamais grisé), et l'autre prend toute la largeur.
 */
import { dayKey } from '@/features/dashboard/availability';
import type { AgencyRole } from '@/features/agency/types';
import type { Customer } from '@/features/customers/types';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';

import { customerShortName, type FleetContext } from '../fleet-card';
import { inspectionHref, lastReturnedRental, type FleetHref } from '../fleet-routes';
import type { FleetItem, LateInfo } from '../fleet-model';
import type { Vehicle } from '../types';

export type Text = { key: string; params?: Record<string, string | number> };

export type ActionId = 'rent' | 'extend' | 'call' | 'inspect' | 'seeMaintenance' | 'finishMaintenance' | 'makeAvailable' | 'makeUnavailable';
export type ActionTone = 'orange' | 'graphite' | 'red' | 'neutral';
/** `href` : écran à ouvrir ; `phone` : numéro à appeler (sans numéro, « Appeler » ouvre la location, `href`) ; `scrollTo` : section de la fiche. */
export type StateAction = { id: ActionId; tone: ActionTone; labelKey: string; labelParams?: Record<string, string>; href?: FleetHref; phone?: string; scrollTo?: 'entretien' };

export type StateKind = 'free' | 'rented' | 'late' | 'inspect' | 'preparation' | 'maintenance' | 'unavailable';

export type StateCard = {
  kind: StateKind;
  title: Text;
  detail: Text | null;
  progress: { percent: number; left: Text; right: Text; tone: 'light' | 'late' } | null;
  /** Les boutons visibles, dans l'ordre : 2 = principal (1,4×) + secondaire ; 1 = pleine largeur ; 0 = aucun. */
  actions: StateAction[];
};

export type StateInput = {
  vehicle: Pick<Vehicle, 'id' | 'statut' | 'statutMotif'>;
  item: FleetItem;
  context: FleetContext;
  rentals: Rental[];
  customers: Map<string, Pick<Customer, 'nomComplet' | 'telephone'>>;
  maintenance: MaintenanceItem[];
  role: AgencyRole | null | undefined;
  now: Date;
  /** Jour court (« lun. 16 », « mer. 28 oct. ») d'un AAAA-MM-JJ. */
  day: (key: string) => string;
  /** « +13 j » : pastille de retard. */
  lateBadge: (late: LateInfo) => string;
  /** « 13 jours » : retard en toutes lettres. */
  lateDuration: (late: LateInfo) => string;
};

const DAY_MS = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const keyOf = (iso: string) => dayKey(new Date(iso));
const nights = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);

const canExtend = (role: AgencyRole | null | undefined) => role === 'owner' || role === 'manager';

/** Durée d'une location en jours (la même que celle de la location quand elle est connue, sinon d'après les dates prévues). */
export function rentalDays(rental: Pick<Rental, 'dureeJours' | 'dateDebutPrevue' | 'dateFinPrevue' | 'dateDepartReel'>): number {
  if (rental.dureeJours && rental.dureeJours > 0) return rental.dureeJours;
  return Math.max(1, nights(new Date(rental.dateDepartReel ?? rental.dateDebutPrevue), new Date(rental.dateFinPrevue)));
}

/** Singulier : « …One » quand le nombre est 1 (« 1 jour » / « 4 jours »). */
const plural = (key: string, n: number) => (n === 1 ? `${key}One` : key);

const action = (id: ActionId, tone: ActionTone, extra: Partial<StateAction> = {}): StateAction => ({ id, tone, labelKey: `vehicleDetail.action.${id}`, ...extra });
const pick = (...actions: (StateAction | null)[]) => actions.filter((entry): entry is StateAction => entry !== null).slice(0, 2);

/** Prochaine réservation à venir (pas encore partie), la plus proche. */
function nextBooking(rentals: Rental[], now: Date): Rental | null {
  const today = startOfDay(now).getTime();
  let best: Rental | null = null;
  for (const rental of rentals) {
    if (rental.statut === 'en_cours' || rental.statut === 'terminee' || rental.statut === 'annulee') continue;
    const start = new Date(rental.dateDebutPrevue).getTime();
    if (!Number.isFinite(start) || start < today) continue;
    if (!best || start < new Date(best.dateDebutPrevue).getTime()) best = rental;
  }
  return best;
}

export function buildStateCard(input: StateInput): StateCard {
  const { vehicle, item, context, rentals, customers, maintenance, role, now, day } = input;
  const customerOf = (rental: Rental | undefined) => (rental ? customers.get(rental.customerId) : undefined);
  const rentalById = (id: string | undefined) => rentals.find((rental) => rental.id === id);

  switch (item.section) {
    case 'free': {
      const until = context.kind === 'free' ? context.untilDay : null;
      const next = nextBooking(rentals, now);
      const name = customerShortName(customerOf(next ?? undefined)?.nomComplet);
      const detail: Text | null = next
        ? { key: plural(name ? 'vehicleDetail.state.nextDeparture' : 'vehicleDetail.state.nextDepartureNoName', rentalDays(next)), params: { date: day(keyOf(next.dateDebutPrevue)), name: name ?? '', days: rentalDays(next) } }
        : null;
      return {
        kind: 'free',
        title: until ? { key: 'flotte.card.context.freeUntil', params: { date: day(until) } } : { key: 'flotte.card.context.freeAll' },
        detail,
        progress: null,
        actions: pick(action('rent', 'orange', { href: { pathname: '/locations/nouveau', params: { vehicleId: vehicle.id, date: dayKey(now) } } }), action('makeUnavailable', 'neutral')),
      };
    }

    case 'rented': {
      const rental = rentalById(item.today.rentalId);
      const customer = customerOf(rental);
      const name = customerShortName(customer?.nomComplet);
      const call = rental ? action('call', 'neutral', { labelParams: { name: name ?? '' }, href: { pathname: '/locations/[id]', params: { id: rental.id } }, ...(customer?.telephone?.trim() ? { phone: customer.telephone.trim() } : {}) }) : null;
      const extend = rental && canExtend(role) ? action('extend', 'graphite', { href: { pathname: '/locations/[id]', params: { id: rental.id, prolonger: '1' } } }) : null;
      const dueKey = rental ? keyOf(rental.dateFinPrevue) : context.kind === 'rented' ? context.endDay : null;

      if (item.late && rental) {
        const dueDay = day(keyOf(item.late.dueAt));
        return {
          kind: 'late',
          title: name ? { key: 'vehicleDetail.state.lateTitle', params: { name, date: dueDay } } : { key: 'vehicleDetail.state.lateTitleNoName', params: { date: dueDay } },
          detail: { key: 'vehicleDetail.state.lateDetail', params: { duration: input.lateDuration(item.late) } },
          progress: { percent: 100, left: { key: 'vehicleDetail.state.progressDue', params: { date: dueDay } }, right: { key: 'vehicleDetail.state.raw', params: { text: input.lateBadge(item.late) } }, tone: 'late' },
          // En retard : « Appeler » (rouge) d'abord, « Prolonger » ensuite (réservé aux propriétaire et responsable)
          actions: pick(call ? { ...call, tone: 'red' } : null, extend ? { ...extend, tone: 'neutral' } : null),
        };
      }

      const start = rental ? new Date(rental.dateDepartReel ?? rental.dateDebutPrevue) : null;
      const total = rental ? rentalDays(rental) : 0;
      const index = start && total > 0 ? Math.min(total, Math.max(1, nights(start, now) + 1)) : 0;
      return {
        kind: 'rented',
        title: name ? { key: 'vehicleDetail.state.rentedTitle', params: { name, date: dueKey ? day(dueKey) : '' } } : { key: 'vehicleDetail.state.rentedTitleNoName', params: { date: dueKey ? day(dueKey) : '' } },
        detail: start ? { key: plural('vehicleDetail.state.rentedDetail', total), params: { date: day(dayKey(start)), days: total } } : null,
        progress: start && total > 0 ? { percent: Math.round((index / total) * 100), left: { key: 'vehicleDetail.state.progressDay', params: { n: index, total } }, right: { key: 'vehicleDetail.state.progressReturn', params: { date: dueKey ? day(dueKey) : '' } }, tone: 'light' } : null,
        actions: pick(extend, call),
      };
    }

    case 'inspect': {
      if (vehicle.statut === 'en_preparation') {
        return { kind: 'preparation', title: { key: 'vehicleDetail.state.preparationTitle' }, detail: { key: 'vehicleDetail.state.preparationDetail' }, progress: null, actions: pick(action('makeAvailable', 'orange')) };
      }
      const last = lastReturnedRental(vehicle.id, rentals);
      const name = customerShortName(customerOf(last ?? undefined)?.nomComplet);
      const returnedAt = last?.dateRetourReel ? new Date(last.dateRetourReel) : null;
      const waiting = returnedAt ? Math.max(0, nights(returnedAt, now)) : null;
      return {
        kind: 'inspect',
        title: returnedAt ? { key: name ? 'vehicleDetail.state.inspectTitle' : 'vehicleDetail.state.inspectTitleNoName', params: { date: day(dayKey(returnedAt)), name: name ?? '' } } : { key: 'vehicleDetail.state.inspectTitleNoRental' },
        detail: waiting === null ? null : { key: waiting === 0 ? 'vehicleDetail.state.inspectDetailToday' : waiting === 1 ? 'vehicleDetail.state.inspectDetailOne' : 'vehicleDetail.state.inspectDetailMany', params: { days: waiting } },
        progress: null,
        // « Signaler un dommage » : aucun écran existant, le bouton n'est pas affiché
        actions: pick(last ? action('inspect', 'orange', { href: inspectionHref(vehicle.id, rentals) }) : null),
      };
    }

    case 'maintenance': {
      const open = maintenance.find((entry) => entry.statut === 'en_cours');
      const planned = context.kind === 'maintenance' && context.planned;
      const returnDay = context.kind === 'maintenance' ? context.returnDay : null;
      return {
        kind: 'maintenance',
        title: planned ? { key: 'vehicleDetail.state.maintenancePlanned' } : returnDay ? { key: 'vehicleDetail.state.maintenanceReturn', params: { date: day(returnDay) } } : { key: 'vehicleDetail.state.maintenanceTitle' },
        detail: null,
        progress: null,
        actions: pick(action('seeMaintenance', 'graphite', { scrollTo: 'entretien' }), open ? action('finishMaintenance', 'neutral', { href: { pathname: '/maintenance/[id]', params: { id: open.id } } }) : vehicle.statut === 'maintenance' ? action('makeAvailable', 'neutral', { labelKey: 'vehicleDetail.action.finishMaintenance' }) : null),
      };
    }

    case 'unavailable':
      return { kind: 'unavailable', title: { key: 'vehicleDetail.state.unavailableTitle' }, detail: vehicle.statutMotif?.trim() ? { key: 'vehicleDetail.state.raw', params: { text: vehicle.statutMotif.trim() } } : null, progress: null, actions: pick(action('makeAvailable', 'orange')) };
  }
}

// ------------------------------------------------------------------ badge de statut (sur la photo)

export type BadgeTone = 'free' | 'rented' | 'late' | 'warning' | 'muted';
export type StatusBadge = { labelKey: string; tone: BadgeTone; late: LateInfo | null };

export function statusBadge(item: FleetItem): StatusBadge {
  if (item.late) return { labelKey: 'flotte.card.status.late', tone: 'late', late: item.late };
  const tone: BadgeTone = item.section === 'free' ? 'free' : item.section === 'rented' ? 'rented' : item.section === 'unavailable' ? 'muted' : 'warning';
  return { labelKey: `flotte.card.status.${item.section}`, tone, late: null };
}
