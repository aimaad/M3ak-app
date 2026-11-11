import { archiveBlock, blockingCountFromError, hasActiveRental, isArchiveBlockedError } from '../archive-guard';

describe('hasActiveRental', () => {
  it('bloque si le véhicule est en location', () => {
    expect(hasActiveRental({ statut: 'en_location' }, [])).toBe(true);
  });
  it('bloque si une réservation est en attente, confirmée ou en cours', () => {
    for (const statut of ['en_attente_confirmation', 'confirmee', 'en_cours', 'reservee'] as const) {
      expect(hasActiveRental({ statut: 'disponible' }, [{ statut }])).toBe(true);
    }
  });
  it('autorise si toutes les locations sont terminées ou annulées', () => {
    expect(hasActiveRental({ statut: 'disponible' }, [{ statut: 'terminee' }, { statut: 'annulee' }])).toBe(false);
    expect(hasActiveRental({ statut: 'disponible' }, [])).toBe(false);
  });
});

describe('isArchiveBlockedError', () => {
  it("reconnaît l'erreur du serveur", () => {
    expect(isArchiveBlockedError({ message: 'vehicle_has_active_rentals' })).toBe(true);
    expect(isArchiveBlockedError({ message: 'autre' })).toBe(false);
    expect(isArchiveBlockedError(null)).toBe(false);
  });
});

describe('archiveBlock (raison précise du blocage)', () => {
  const NOW = new Date(2026, 10, 15, 12);
  const at = (delta: number) => new Date(2026, 10, 15 + delta, 9).toISOString();
  const customers = new Map([['c1', { nomComplet: 'FOUAD BENNANI' }], ['c2', { nomComplet: 'Karim Tazi' }]]);
  const rental = (extra: Record<string, unknown>) => ({ id: 'r1', statut: 'en_cours', customerId: 'c1', dateDebutPrevue: at(-2), dateFinPrevue: at(3), ...extra }) as never;

  it('rien ne bloque : null (aussi avec des locations terminées ou annulées)', () => {
    expect(archiveBlock({ statut: 'disponible' }, [], customers, NOW)).toBeNull();
    expect(archiveBlock({ statut: 'disponible' }, [rental({ statut: 'terminee' }), rental({ statut: 'annulee' })], customers, NOW)).toBeNull();
  });

  it('en location : client et jour de retour prévu', () => {
    expect(archiveBlock({ statut: 'en_location' }, [rental({})], customers, NOW)).toEqual({ kind: 'rented', name: 'Fouad B.', day: '2026-11-18', rentalId: 'r1', others: 0 });
  });

  it('en retard passe avant tout, les autres réservations sont comptées', () => {
    const late = rental({ dateFinPrevue: at(-1) });
    const booked = rental({ id: 'r2', statut: 'confirmee', customerId: 'c2', dateDebutPrevue: at(4), dateFinPrevue: at(6) });
    const other = rental({ id: 'r3', statut: 'en_attente_confirmation', dateDebutPrevue: at(9), dateFinPrevue: at(10) });
    expect(archiveBlock({ statut: 'en_location' }, [booked, other, late], customers, NOW)).toMatchObject({ kind: 'late', name: 'Fouad B.', rentalId: 'r1', others: 2 });
  });

  it('réservation à venir : la plus proche, avec son client et son jour de début', () => {
    const near = rental({ id: 'r2', statut: 'confirmee', customerId: 'c2', dateDebutPrevue: at(2), dateFinPrevue: at(5) });
    const far = rental({ id: 'r3', statut: 'reservee', dateDebutPrevue: at(8), dateFinPrevue: at(9) });
    expect(archiveBlock({ statut: 'disponible' }, [far, near], customers, NOW)).toEqual({ kind: 'reserved', name: 'Karim T.', day: '2026-11-17', rentalId: 'r2', others: 1 });
  });

  it('statut « en location » sans location ouverte : blocage par le statut seul', () => {
    expect(archiveBlock({ statut: 'en_location' }, [], customers, NOW)).toMatchObject({ kind: 'status', others: 0 });
  });
});

describe('blockingCountFromError', () => {
  it('lit « count=N » dans le détail de l’erreur du serveur', () => {
    expect(blockingCountFromError({ message: 'vehicle_has_active_rentals', details: 'count=3' })).toBe(3);
  });
  it('null si le détail est absent', () => {
    expect(blockingCountFromError({ message: 'vehicle_has_active_rentals' })).toBeNull();
    expect(blockingCountFromError(null)).toBeNull();
  });
});
