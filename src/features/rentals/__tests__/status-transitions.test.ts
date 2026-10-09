import { canTransitionRentalStatus, isTerminalRentalStatus } from '../status-transitions';

describe('canTransitionRentalStatus', () => {
  it('autorise la confirmation depuis en attente', () => {
    expect(canTransitionRentalStatus('en_attente_confirmation', 'confirmee')).toBe(true);
  });

  it('autorise le démarrage depuis confirmée ou réservée (legacy)', () => {
    expect(canTransitionRentalStatus('confirmee', 'en_cours')).toBe(true);
    expect(canTransitionRentalStatus('reservee', 'en_cours')).toBe(true);
  });

  it('autorise la fin de location depuis en cours', () => {
    expect(canTransitionRentalStatus('en_cours', 'terminee')).toBe(true);
  });

  it('autorise l’annulation depuis en attente ou confirmée', () => {
    expect(canTransitionRentalStatus('en_attente_confirmation', 'annulee')).toBe(true);
    expect(canTransitionRentalStatus('confirmee', 'annulee')).toBe(true);
  });

  it('interdit de remettre une réservation annulée en cours', () => {
    expect(canTransitionRentalStatus('annulee', 'en_cours')).toBe(false);
    expect(canTransitionRentalStatus('annulee', 'confirmee')).toBe(false);
  });

  it('interdit toute transition depuis un statut terminal (terminee/annulee)', () => {
    expect(canTransitionRentalStatus('terminee', 'en_cours')).toBe(false);
    expect(canTransitionRentalStatus('terminee', 'annulee')).toBe(false);
    expect(canTransitionRentalStatus('annulee', 'terminee')).toBe(false);
  });

  it('interdit de sauter une étape (en attente -> en cours directement)', () => {
    expect(canTransitionRentalStatus('en_attente_confirmation', 'en_cours')).toBe(false);
  });

  it("interdit une transition vers le même statut", () => {
    expect(canTransitionRentalStatus('confirmee', 'confirmee')).toBe(false);
  });
});

describe('isTerminalRentalStatus', () => {
  it('terminee et annulee sont terminaux', () => {
    expect(isTerminalRentalStatus('terminee')).toBe(true);
    expect(isTerminalRentalStatus('annulee')).toBe(true);
  });

  it('les autres statuts ne sont pas terminaux', () => {
    expect(isTerminalRentalStatus('en_attente_confirmation')).toBe(false);
    expect(isTerminalRentalStatus('confirmee')).toBe(false);
    expect(isTerminalRentalStatus('en_cours')).toBe(false);
  });
});
