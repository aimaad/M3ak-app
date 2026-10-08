import { computeMaintenanceUrgency } from '../urgency';

const today = new Date('2026-03-15T00:00:00.000Z');

describe('computeMaintenanceUrgency — par date', () => {
  it('est "en_retard" si la date est passée', () => {
    const urgency = computeMaintenanceUrgency(
      { echeanceDate: '2026-03-10', echeanceKm: null },
      null,
      today
    );
    expect(urgency).toBe('en_retard');
  });

  it('est "due" dans les 7 jours (seuil par défaut)', () => {
    const urgency = computeMaintenanceUrgency(
      { echeanceDate: '2026-03-20', echeanceKm: null },
      null,
      today
    );
    expect(urgency).toBe('due');
  });

  it('est "a_venir" au-delà du seuil', () => {
    const urgency = computeMaintenanceUrgency(
      { echeanceDate: '2026-04-15', echeanceKm: null },
      null,
      today
    );
    expect(urgency).toBe('a_venir');
  });
});

describe('computeMaintenanceUrgency — par kilométrage', () => {
  it('est "en_retard" si le kilométrage actuel dépasse déjà l\'échéance', () => {
    const urgency = computeMaintenanceUrgency(
      { echeanceDate: null, echeanceKm: 50000 },
      50500,
      today
    );
    expect(urgency).toBe('en_retard');
  });

  it('est "due" dans les 500 km (seuil par défaut)', () => {
    const urgency = computeMaintenanceUrgency(
      { echeanceDate: null, echeanceKm: 50000 },
      49700,
      today
    );
    expect(urgency).toBe('due');
  });

  it('est "a_venir" largement avant l\'échéance', () => {
    const urgency = computeMaintenanceUrgency(
      { echeanceDate: null, echeanceKm: 50000 },
      30000,
      today
    );
    expect(urgency).toBe('a_venir');
  });
});

describe('computeMaintenanceUrgency — combiné', () => {
  it('retient la plus pressante des deux échéances', () => {
    const urgency = computeMaintenanceUrgency(
      { echeanceDate: '2026-06-01', echeanceKm: 50000 }, // date lointaine, km en retard
      50200,
      today
    );
    expect(urgency).toBe('en_retard');
  });

  it("par défaut à 'a_venir' si aucune échéance n'est renseignée", () => {
    const urgency = computeMaintenanceUrgency({ echeanceDate: null, echeanceKm: null }, 30000, today);
    expect(urgency).toBe('a_venir');
  });
});
