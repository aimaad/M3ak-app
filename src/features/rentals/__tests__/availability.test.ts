import { bookedDates, hasBookingConflict, type RentalForAvailability } from '../availability';

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
