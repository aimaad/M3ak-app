import { hasActiveRental, isArchiveBlockedError } from '../archive-guard';

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
