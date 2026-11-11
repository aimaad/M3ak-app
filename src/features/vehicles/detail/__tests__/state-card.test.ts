/* eslint-disable import/first -- le « jest.mock » doit précéder les imports */
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';

import { contextOf } from '../../fleet-card';
import { buildFleetItems, lateInfo } from '../../fleet-model';
import type { Vehicle } from '../../types';
import { buildStateCard, rentalDays, statusBadge } from '../state-card';

const NOW = new Date(2030, 5, 10, 12, 0, 0); // lundi 10 juin 2030
const at = (delta: number, hour = 9) => new Date(2030, 5, 10 + delta, hour).toISOString();
const day = (key: string) => `J(${key})`;
const vehicle = (statut: Vehicle['statut'], extra: Partial<Vehicle> = {}) => ({ id: 'v', marque: 'Dacia', modele: 'Logan', immatriculation: '1-A-1', statut, archivedAt: null, ...extra }) as Vehicle;
const rental = (id: string, statut: Rental['statut'], startDelta: number, endDelta: number, extra: Partial<Rental> = {}) =>
  ({ id, vehicleId: 'v', customerId: 'c1', statut, dateDebutPrevue: at(startDelta), dateFinPrevue: at(endDelta, 18), dateDepartReel: statut === 'en_cours' || statut === 'terminee' ? at(startDelta) : null, dateRetourReel: null, dureeJours: null, ...extra }) as Rental;
const customers = new Map([['c1', { nomComplet: 'FOUAD BENNANI', telephone: '+212 6 11 22 33 44' }]]);

function card(v: Vehicle, rentals: Rental[], role: 'owner' | 'manager' | 'employee' | null = 'owner', maintenance: MaintenanceItem[] = []) {
  const item = buildFleetItems({ vehicles: [v], rentals, maintenance, now: NOW })[0];
  const context = contextOf(item, { customers: customers as never, rentals: new Map(rentals.map((r) => [r.id, r])), maintenance });
  return buildStateCard({ vehicle: v, item, context, rentals, customers, maintenance, role, now: NOW, day, lateBadge: (late) => `+${late.amount} ${late.unit}`, lateDuration: (late) => `${late.amount} ${late.unit}` });
}
const ids = (c: ReturnType<typeof card>) => c.actions.map((a) => a.id);

describe('carte d’état : disponible', () => {
  it('libre jusqu’à la veille de la prochaine réservation ; prochain départ avec le client et la durée ; Louer + Rendre indisponible', () => {
    const c = card(vehicle('disponible'), [rental('r', 'reservee', 3, 6)]);
    expect(c.kind).toBe('free');
    expect(c.title).toEqual({ key: 'flotte.card.context.freeUntil', params: { date: 'J(2030-06-12)' } });
    expect(c.detail).toEqual({ key: 'vehicleDetail.state.nextDeparture', params: { date: 'J(2030-06-13)', name: 'Fouad B.', days: 3 } });
    expect(ids(c)).toEqual(['rent', 'makeUnavailable']);
    expect(c.actions[0]).toMatchObject({ tone: 'orange', href: { pathname: '/locations/nouveau', params: { vehicleId: 'v', date: '2030-06-10' } } });
  });
  it('une réservation d’un seul jour : « 1 jour » au singulier', () => {
    const c = card(vehicle('disponible'), [rental('r', 'reservee', 3, 3, { dureeJours: 1 })]);
    expect(c.detail).toMatchObject({ key: 'vehicleDetail.state.nextDepartureOne', params: { days: 1 } });
  });
  it('aucune réservation : « Libre toute la semaine », pas de détail', () => {
    const c = card(vehicle('disponible'), []);
    expect(c.title).toEqual({ key: 'flotte.card.context.freeAll' });
    expect(c.detail).toBeNull();
  });
  it('le même choix d’actions pour tous les rôles (louer et rendre indisponible sont ouverts à tous)', () => {
    for (const role of ['owner', 'manager', 'employee', null] as const) expect(ids(card(vehicle('disponible'), [], role))).toEqual(['rent', 'makeUnavailable']);
  });
});

describe('carte d’état : en location', () => {
  const r = rental('r', 'en_cours', -1, 5, { dureeJours: 5 });
  it('« Chez Youssef A. · retour lun. 16 », détail, progression « J2 sur 5 » (40 %)', () => {
    const c = card(vehicle('en_location'), [r]);
    expect(c.kind).toBe('rented');
    expect(c.title).toEqual({ key: 'vehicleDetail.state.rentedTitle', params: { name: 'Fouad B.', date: 'J(2030-06-15)' } });
    expect(c.detail).toEqual({ key: 'vehicleDetail.state.rentedDetail', params: { date: 'J(2030-06-09)', days: 5 } });
    expect(c.progress).toMatchObject({ percent: 40, left: { params: { n: 2, total: 5 } }, tone: 'light' });
  });
  it('propriétaire et responsable : Prolonger (graphite) puis Appeler le client', () => {
    for (const role of ['owner', 'manager'] as const) {
      const c = card(vehicle('en_location'), [r], role);
      expect(ids(c)).toEqual(['extend', 'call']);
      expect(c.actions[0]).toMatchObject({ tone: 'graphite', href: { pathname: '/locations/[id]', params: { id: 'r', prolonger: '1' } } });
      expect(c.actions[1]).toMatchObject({ phone: '+212 6 11 22 33 44', labelParams: { name: 'Fouad B.' } });
    }
  });
  it('employé : « Prolonger » est absent (pas grisé) et « Appeler » prend toute la place', () => {
    const c = card(vehicle('en_location'), [r], 'employee');
    expect(ids(c)).toEqual(['call']);
  });
  it('la progression ne dépasse jamais la durée', () => {
    const c = card(vehicle('en_location'), [rental('r', 'en_cours', -1, 5, { dureeJours: 1 })]);
    expect(c.progress?.percent).toBe(100);
  });
});

describe('carte d’état : en retard', () => {
  const late = rental('r', 'en_cours', -9, -3);
  it('carte rouge : « devait la rendre », retard en toutes lettres, barre pleine avec la pastille', () => {
    const c = card(vehicle('en_location'), [late]);
    expect(c.kind).toBe('late');
    expect(c.title).toEqual({ key: 'vehicleDetail.state.lateTitle', params: { name: 'Fouad B.', date: 'J(2030-06-07)' } });
    expect(c.detail).toEqual({ key: 'vehicleDetail.state.lateDetail', params: { duration: '3 days' } });
    expect(c.progress).toMatchObject({ percent: 100, tone: 'late', right: { params: { text: '+3 days' } } });
  });
  it('« Appeler » (rouge, tous les rôles) puis « Prolonger » (propriétaire et responsable)', () => {
    expect(ids(card(vehicle('en_location'), [late], 'owner'))).toEqual(['call', 'extend']);
    const c = card(vehicle('en_location'), [late], 'owner');
    expect(c.actions[0].tone).toBe('red');
    expect(ids(card(vehicle('en_location'), [late], 'employee'))).toEqual(['call']);
  });
  it('sans numéro : « Appeler » ouvre la location', () => {
    const noPhone = new Map([['c1', { nomComplet: 'Fouad Bennani', telephone: null }]]);
    const item = buildFleetItems({ vehicles: [vehicle('en_location')], rentals: [late], maintenance: [], now: NOW })[0];
    const c = buildStateCard({ vehicle: vehicle('en_location'), item, context: contextOf(item, { customers: noPhone as never, rentals: new Map([['r', late]]), maintenance: [] }), rentals: [late], customers: noPhone, maintenance: [], role: 'owner', now: NOW, day, lateBadge: () => '', lateDuration: () => '' });
    expect(c.actions[0]).toMatchObject({ id: 'call', href: { pathname: '/locations/[id]', params: { id: 'r' } } });
    expect(c.actions[0].phone).toBeUndefined();
  });
});

describe('carte d’état : à inspecter, en préparation', () => {
  const back = rental('old', 'terminee', -8, -1, { dateRetourReel: at(-1) });
  it('« Rendue lun. 9 par Fouad B. », attente depuis N jours, « Démarrer l’inspection » vers l’inspection de retour', () => {
    const c = card(vehicle('a_inspecter'), [back]);
    expect(c.kind).toBe('inspect');
    expect(c.title).toEqual({ key: 'vehicleDetail.state.inspectTitle', params: { date: 'J(2030-06-09)', name: 'Fouad B.' } });
    expect(c.detail).toEqual({ key: 'vehicleDetail.state.inspectDetailOne', params: { days: 1 } });
    expect(c.actions).toEqual([expect.objectContaining({ id: 'inspect', tone: 'orange', href: { pathname: '/locations/[id]/inspection-retour', params: { id: 'old' } } })]);
  });
  it('« Signaler un dommage » n’est pas proposé (aucun écran pour ça) ; sans location rendue, pas d’action', () => {
    expect(ids(card(vehicle('a_inspecter'), [back]))).not.toContain('reportDamage');
    expect(card(vehicle('a_inspecter'), []).actions).toEqual([]);
  });
  it('en préparation : « Rendre disponible »', () => {
    const c = card(vehicle('en_preparation'), []);
    expect(c.kind).toBe('preparation');
    expect(ids(c)).toEqual(['makeAvailable']);
  });
});

describe('carte d’état : entretien et indisponible', () => {
  const open = { id: 'm1', vehicleId: 'v', statut: 'en_cours', echeanceDate: '2030-06-13', echeanceKm: null } as MaintenanceItem;
  it('au garage avec retour prévu : « Voir l’entretien » (défilement) et « Terminer l’entretien » (écran de l’entretien)', () => {
    const c = card(vehicle('maintenance'), [], 'owner', [open]);
    expect(c.kind).toBe('maintenance');
    expect(c.title).toEqual({ key: 'vehicleDetail.state.maintenanceReturn', params: { date: 'J(2030-06-13)' } });
    expect(c.actions).toEqual([expect.objectContaining({ id: 'seeMaintenance', scrollTo: 'entretien' }), expect.objectContaining({ id: 'finishMaintenance', href: { pathname: '/maintenance/[id]', params: { id: 'm1' } } })]);
  });
  it('au garage sans entretien en cours : « Terminer l’entretien » rend le véhicule disponible', () => {
    const c = card(vehicle('maintenance'), []);
    expect(c.title).toEqual({ key: 'vehicleDetail.state.maintenanceTitle' });
    expect(c.actions[1]).toMatchObject({ id: 'makeAvailable', labelKey: 'vehicleDetail.action.finishMaintenance' });
  });
  it('indisponible : motif s’il existe, « Rendre disponible » seul', () => {
    const c = card(vehicle('indisponible', { statutMotif: ' Pare-brise cassé ' }), []);
    expect(c.kind).toBe('unavailable');
    expect(c.detail).toEqual({ key: 'vehicleDetail.state.raw', params: { text: 'Pare-brise cassé' } });
    expect(ids(c)).toEqual(['makeAvailable']);
    expect(card(vehicle('indisponible'), []).detail).toBeNull();
  });
});

describe('badge de statut', () => {
  const badge = (v: Vehicle, rentals: Rental[] = []) => statusBadge(buildFleetItems({ vehicles: [v], rentals, maintenance: [], now: NOW })[0]);
  it('couleur et libellé par statut', () => {
    expect(badge(vehicle('disponible'))).toMatchObject({ labelKey: 'flotte.card.status.free', tone: 'free' });
    expect(badge(vehicle('en_location'), [rental('r', 'en_cours', -1, 5)])).toMatchObject({ labelKey: 'flotte.card.status.rented', tone: 'rented' });
    expect(badge(vehicle('a_inspecter'))).toMatchObject({ labelKey: 'flotte.card.status.inspect', tone: 'warning' });
    expect(badge(vehicle('en_preparation'))).toMatchObject({ tone: 'warning' });
    expect(badge(vehicle('maintenance'))).toMatchObject({ labelKey: 'flotte.card.status.maintenance', tone: 'warning' });
    expect(badge(vehicle('indisponible'))).toMatchObject({ labelKey: 'flotte.card.status.unavailable', tone: 'muted' });
  });
  it('en retard : « En retard » avec la durée du retard', () => {
    const b = badge(vehicle('en_location'), [rental('r', 'en_cours', -9, -3)]);
    expect(b).toMatchObject({ labelKey: 'flotte.card.status.late', tone: 'late' });
    expect(b.late).toEqual(lateInfo('r', at(-3, 18), NOW));
  });
});

describe('durée d’une location', () => {
  it('celle de la location si elle est connue, sinon d’après les dates (au moins 1 jour)', () => {
    expect(rentalDays({ dureeJours: 7, dateDebutPrevue: at(0), dateFinPrevue: at(2), dateDepartReel: null })).toBe(7);
    expect(rentalDays({ dureeJours: null, dateDebutPrevue: at(0), dateFinPrevue: at(4), dateDepartReel: null })).toBe(4);
    expect(rentalDays({ dureeJours: null, dateDebutPrevue: at(0), dateFinPrevue: at(0, 18), dateDepartReel: null })).toBe(1);
  });
});
