import type { ComplianceRecord } from '@/features/compliance/types';
import type { MaintenanceItem } from '@/features/maintenance/types';

import type { ArchiveBlock } from '../archive-guard';
import { availabilityAlertList, availabilityAlerts, isStatusLockedError, statusBlockText, statusChangeBlocked } from '../status-guard';
import type { Vehicle } from '../types';

const NOW = new Date(2026, 10, 15, 12);
const vehicle = { id: 'v1', kilometrage: 59_000, documents: [], dateMiseEnCirculation: null } as unknown as Vehicle;
const key = (iso: string) => iso;
const insurance = (validUntil: string): ComplianceRecord => ({ id: 'c', agencyId: 'a', vehicleId: 'v1', kind: 'assurance', validFrom: null, validUntil, reference: null, provider: null, amount: null, documentPath: 'p', notes: null, periodMonths: null, createdBy: null, createdAt: '2026-01-01T00:00:00Z' });
const item = (extra: Partial<MaintenanceItem>): MaintenanceItem => ({ id: 'm', agencyId: 'a', vehicleId: 'v1', type: 'vidange', echeanceDate: null, echeanceKm: null, statut: 'a_venir', notes: null, garage: null, cout: null, piecesRemplacees: null, facturePath: null, dateIntervention: null, repeatKm: null, repeatMonths: null, createdAt: '2026-01-01T00:00:00Z', ...extra });
const t = (k: string, p?: Record<string, unknown>) => `${k}${p ? JSON.stringify(p) : ''}`;

describe('échéances en alerte avant de rendre disponible', () => {
  it('rien en alerte : aucune alerte', () => {
    expect(availabilityAlerts(vehicle, [insurance(key('2027-06-01'))], [], NOW).filter((alert) => alert.type === 'assurance')).toEqual([]);
  });

  it('assurance expirée ou à moins de 7 jours : alerte (expired / urgent)', () => {
    expect(availabilityAlerts(vehicle, [insurance('2026-11-01')], [], NOW)).toContainEqual({ type: 'assurance', state: 'expired' });
    expect(availabilityAlerts(vehicle, [insurance('2026-11-19')], [], NOW)).toContainEqual({ type: 'assurance', state: 'urgent' });
  });

  it('entretien dépassé ou imminent : alerte ; un entretien lointain : rien', () => {
    expect(availabilityAlerts(vehicle, [], [item({ echeanceKm: 58_000 })], NOW)).toContainEqual({ type: 'vidange', state: 'expired' });
    expect(availabilityAlerts(vehicle, [], [item({ type: 'freins', echeanceKm: 90_000 })], NOW).filter((alert) => alert.type === 'freins')).toEqual([]);
  });

  it('la liste est lisible : « Assurance (expirée) »', () => {
    const fr = (k: string) => (({ 'vehicleDetail.compliance.kind.assurance': 'Assurance', 'maintenance.types.vidange': 'Vidange', 'vehicleDetail.availability.state.expired': 'expirée', 'vehicleDetail.availability.state.urgent': 'urgente' }) as Record<string, string>)[k];
    expect(availabilityAlertList([{ type: 'assurance', state: 'expired' }, { type: 'vidange', state: 'urgent' }], fr)).toBe('Assurance (expirée), Vidange (urgente)');
  });
});

describe('statut impossible à changer', () => {
  const block = (extra: Partial<ArchiveBlock>): ArchiveBlock => ({ kind: 'reserved', name: 'Omar T.', day: '2026-11-20', rentalId: 'r1', others: 0, ...extra });

  it('réservée : le client et le jour', () => {
    expect(statusBlockText(block({}), t, 'fr', NOW)).toMatch(/^vehicleDetail\.statusBlock\.reserved\{"name":"Omar T\.","day":".+"\}$/);
  });
  it('en location ; en retard ; sans nom ; incohérence de statut', () => {
    expect(statusBlockText(block({ kind: 'rented' }), t, 'fr', NOW)).toContain('statusBlock.rented{');
    expect(statusBlockText(block({ kind: 'late' }), t, 'fr', NOW)).toContain('statusBlock.late{');
    expect(statusBlockText(block({ name: null }), t, 'fr', NOW)).toContain('statusBlock.reservedNoName');
    expect(statusBlockText(block({ kind: 'status', name: null, day: null }), t, 'fr', NOW)).toBe('vehicleDetail.statusBlock.status');
  });
  it('d’autres réservations sont annoncées', () => {
    expect(statusBlockText(block({ others: 2 }), t, 'fr', NOW)).toContain('vehicleDetail.archive.othersMany{"count":2}');
  });
});

describe('même règle que le serveur', () => {
  const block: ArchiveBlock = { kind: 'reserved', name: 'Omar T.', day: '2026-11-20', rentalId: 'r1', others: 0 };
  it('location ouverte : maintenance, préparation, indisponible refusés ; disponible accepté (panne pendant une location)', () => {
    expect(statusChangeBlocked({ statut: 'disponible' }, 'indisponible', block)).toBe(true);
    expect(statusChangeBlocked({ statut: 'disponible' }, 'maintenance', block)).toBe(true);
    expect(statusChangeBlocked({ statut: 'maintenance' }, 'disponible', block)).toBe(false);
  });
  it('en location : on ne la quitte pas à la main, même vers « disponible »', () => {
    expect(statusChangeBlocked({ statut: 'en_location' }, 'disponible', block)).toBe(true);
  });
  it('aucune location ouverte : rien n’est bloqué', () => {
    expect(statusChangeBlocked({ statut: 'disponible' }, 'indisponible', null)).toBe(false);
  });
  it('erreur du serveur reconnue', () => {
    expect(isStatusLockedError({ message: 'vehicle_status_locked' })).toBe(true);
    expect(isStatusLockedError({ message: 'autre' })).toBe(false);
    expect(isStatusLockedError(null)).toBe(false);
  });
});
