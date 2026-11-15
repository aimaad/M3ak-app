import { maintenanceLabel, maintenancePhrase } from '../label';

const t = (key: string, params?: Record<string, unknown>) => (params?.name ? `${key}:${params.name}` : key);

describe('nom d’un entretien', () => {
  it('« Autre » nommé : son nom ; sinon le nom du type', () => {
    expect(maintenanceLabel({ type: 'autre', titre: ' Courroie de distribution ' }, t)).toBe('Courroie de distribution');
    expect(maintenanceLabel({ type: 'autre', titre: null }, t)).toBe('maintenance.types.autre');
    expect(maintenanceLabel({ type: 'autre', titre: '   ' }, t)).toBe('maintenance.types.autre');
    expect(maintenanceLabel({ type: 'vidange', titre: 'ignoré' }, t)).toBe('maintenance.types.vidange');
  });
  it('dans une phrase : « l’entretien « … » » pour un « Autre » nommé', () => {
    expect(maintenancePhrase({ type: 'autre', titre: 'Courroie' }, t)).toBe('notifications.maintenance.named:Courroie');
    expect(maintenancePhrase({ type: 'freins' }, t)).toBe('notifications.maintenance.freins');
  });
});
