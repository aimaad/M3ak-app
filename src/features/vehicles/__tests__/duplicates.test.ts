import { findDuplicateInList, normalizePlate, normalizeVin } from '../duplicates';
import type { Vehicle } from '../types';

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return { id: 'v1', immatriculation: '8921 | ب | 14', marque: 'DACIA', modele: 'LOGAN', vin: null, archivedAt: null, ...overrides } as Vehicle;
}

describe('doublons de véhicules', () => {
  it('compare les plaques sans tenir compte des espaces, barres, tirets et de la casse', () => {
    expect(normalizePlate('8921 | ب | 14')).toBe('8921ب14');
    expect(normalizePlate('8921-ب-14')).toBe('8921ب14');
    expect(normalizePlate('1234 | a | 5')).toBe(normalizePlate('1234-A-5'));
    expect(normalizeVin('uu1 lsd-aah')).toBe('UU1LSDAAH');
  });

  it('retrouve un véhicule déjà ajouté malgré une écriture légèrement différente', () => {
    const found = findDuplicateInList([vehicle({})], { immatriculation: '8921|ب|14' });
    expect(found?.field).toBe('immatriculation');
    expect(found?.vehicle.id).toBe('v1');
  });

  it('retrouve aussi un véhicule archivé, et par son numéro de série', () => {
    const archived = vehicle({ id: 'v2', immatriculation: '1111 | أ | 1', vin: 'UU1LSDAAH54321876', archivedAt: '2026-01-01T00:00:00Z' });
    expect(findDuplicateInList([archived], { immatriculation: '2222 | ب | 2', vin: 'uu1lsdaah54321876' })).toMatchObject({ field: 'vin', vehicle: { id: 'v2' } });
    expect(findDuplicateInList([archived], { immatriculation: '1111-أ-1' })?.vehicle.archivedAt).toBeTruthy();
  });

  it("ne signale rien pour un véhicule différent, ni pour une plaque vide", () => {
    expect(findDuplicateInList([vehicle({})], { immatriculation: '9999 | ج | 9' })).toBeNull();
    expect(findDuplicateInList([vehicle({})], { immatriculation: '  ' })).toBeNull();
  });

  it("ignore le véhicule en cours de modification", () => {
    expect(findDuplicateInList([vehicle({})], { immatriculation: '8921 | ب | 14' }, 'v1')).toBeNull();
  });
});
