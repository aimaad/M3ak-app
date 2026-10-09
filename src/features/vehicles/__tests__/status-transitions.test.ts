import { canManuallyChangeStatus } from '../status-transitions';

describe('canManuallyChangeStatus', () => {
  it('autorise le changement manuel pour les statuts non pilotés par les locations', () => {
    expect(canManuallyChangeStatus('disponible')).toBe(true);
    expect(canManuallyChangeStatus('maintenance')).toBe(true);
    expect(canManuallyChangeStatus('en_preparation')).toBe(true);
    expect(canManuallyChangeStatus('indisponible')).toBe(true);
  });

  it('interdit le changement manuel pendant une location en cours', () => {
    expect(canManuallyChangeStatus('en_location')).toBe(false);
  });

  it("interdit le changement manuel en attente d'inspection de retour", () => {
    expect(canManuallyChangeStatus('a_inspecter')).toBe(false);
  });
});
