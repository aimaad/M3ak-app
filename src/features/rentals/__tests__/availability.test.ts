import { bookedDates, hasBookingConflict, vehicleAvailability, type RentalForAvailability } from '../availability';

function makeRental(overrides: Partial<RentalForAvailability>): RentalForAvailability {
  return {
    id: '1',
    dateDebutPrevue: '2026-03-10',
    dateFinPrevue: '2026-03-15',
    statut: 'reservee',
    ...overrides,
  };
}

describe('hasBookingConflict', () => {
  it('détecte un chevauchement complet', () => {
    const existing = [makeRental({})];
    expect(hasBookingConflict(existing, { start: '2026-03-12', end: '2026-03-13' })).toBe(true);
  });

  it('détecte un chevauchement partiel au début', () => {
    const existing = [makeRental({})];
    expect(hasBookingConflict(existing, { start: '2026-03-08', end: '2026-03-11' })).toBe(true);
  });

  it('détecte un chevauchement partiel à la fin', () => {
    const existing = [makeRental({})];
    expect(hasBookingConflict(existing, { start: '2026-03-14', end: '2026-03-20' })).toBe(true);
  });

  it("ne détecte rien pour des dates disjointes", () => {
    const existing = [makeRental({})];
    expect(hasBookingConflict(existing, { start: '2026-03-16', end: '2026-03-20' })).toBe(false);
    expect(hasBookingConflict(existing, { start: '2026-03-01', end: '2026-03-09' })).toBe(false);
  });

  it('ignore les locations annulées ou terminées', () => {
    const existing = [
      makeRental({ statut: 'annulee' }),
      makeRental({ id: '2', statut: 'terminee' }),
    ];
    expect(hasBookingConflict(existing, { start: '2026-03-12', end: '2026-03-13' })).toBe(false);
  });

  it("ignore la location elle-même lors d'une modification (excludeRentalId)", () => {
    const existing = [makeRental({ id: 'self' })];
    expect(
      hasBookingConflict(existing, { start: '2026-03-12', end: '2026-03-13' }, 'self')
    ).toBe(false);
  });

  it('autorise deux réservations successives qui se touchent sans se chevaucher', () => {
    const existing = [makeRental({ dateDebutPrevue: '2026-03-10T09:00:00Z', dateFinPrevue: '2026-03-15T18:00:00Z' })];
    // le retour de la première a lieu exactement quand débute la seconde : pas de chevauchement
    expect(
      hasBookingConflict(existing, { start: '2026-03-15T18:00:00Z', end: '2026-03-20T09:00:00Z' })
    ).toBe(false);
  });

  it('ne bloque pas la disponibilité pour une réservation en attente de confirmation', () => {
    const existing = [makeRental({ statut: 'en_attente_confirmation' })];
    expect(hasBookingConflict(existing, { start: '2026-03-12', end: '2026-03-13' })).toBe(false);
  });
});

describe('bookedDates', () => {
  it('liste tous les jours occupés, sans doublons, triés', () => {
    const existing = [
      makeRental({ dateDebutPrevue: '2026-03-10', dateFinPrevue: '2026-03-12' }),
      makeRental({ id: '2', dateDebutPrevue: '2026-03-11', dateFinPrevue: '2026-03-13' }),
    ];
    expect(bookedDates(existing)).toEqual([
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
    ]);
  });

  it('ignore les locations inactives', () => {
    const existing = [makeRental({ statut: 'annulee' })];
    expect(bookedDates(existing)).toEqual([]);
  });
});

describe('véhicules libres pour une période', () => {
  const range = { start: '2026-06-10T09:00:00Z', end: '2026-06-15T09:00:00Z' };
  const v = (id: string, statut = 'disponible', archivedAt: string | null = null) => ({ id, statut, archivedAt });
  const rental = (vehicleId: string, start: string, end: string, statut: 'confirmee' | 'en_attente_confirmation' | 'annulee' = 'confirmee') => ({
    id: `${vehicleId}-${start}`,
    vehicleId,
    dateDebutPrevue: start,
    dateFinPrevue: end,
    statut,
  });

  it('sépare libres et occupés, avec la date où la voiture se libère', () => {
    const result = vehicleAvailability(
      [v('a'), v('b'), v('c')],
      [rental('b', '2026-06-12T09:00:00Z', '2026-06-20T09:00:00Z'), rental('c', '2026-06-01T09:00:00Z', '2026-06-10T09:00:00Z')],
      range
    );
    expect(result.available.map((x) => x.id)).toEqual(['a', 'c']); // c rentre le jour même où commence la demande : libre
    expect(result.unavailable).toEqual([{ vehicle: v('b'), reason: { kind: 'booked', freeFrom: '2026-06-20T09:00:00Z' } }]);
  });

  it("ne tient pas compte des locations en attente ou annulées (elles ne bloquent pas)", () => {
    const result = vehicleAvailability(
      [v('a'), v('b')],
      [rental('a', '2026-06-11T09:00:00Z', '2026-06-13T09:00:00Z', 'en_attente_confirmation'), rental('b', '2026-06-11T09:00:00Z', '2026-06-13T09:00:00Z', 'annulee')],
      range
    );
    expect(result.available.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('écarte les voitures en maintenance, indisponibles ou archivées, avec la raison', () => {
    const result = vehicleAvailability([v('m', 'maintenance'), v('i', 'indisponible'), v('x', 'disponible', '2026-01-01'), v('ok', 'en_location')], [], range);
    expect(result.unavailable.map((u) => u.reason.kind)).toEqual(['maintenance', 'indisponible', 'archived']);
    expect(result.available.map((x) => x.id)).toEqual(['ok']);
  });
});
