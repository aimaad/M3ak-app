import { describeSaveError, isSchemaOutdatedError, saveErrorDetail } from '../save-error';

const t = (key: string, params?: Record<string, unknown>) => (params?.detail ? `${key}:${params.detail}` : key);

describe('raison d’un échec d’enregistrement', () => {
  it('colonne absente de la base (migration pas appliquée) : reconnue', () => {
    expect(isSchemaOutdatedError({ code: 'PGRST204', message: "Could not find the 'repeat_km' column of 'maintenance_items' in the schema cache" })).toBe(true);
    expect(isSchemaOutdatedError({ code: '42703', message: 'column "period_months" of relation "vehicle_compliance" does not exist' })).toBe(true);
    expect(isSchemaOutdatedError({ message: 'autre erreur' })).toBe(false);
    expect(isSchemaOutdatedError(null)).toBe(false);
  });

  it('base pas à jour : message qui dit quoi faire', () => {
    expect(describeSaveError({ code: 'PGRST204', message: 'x repeat_km' }, t, 'generic')).toBe('vehicleDetail.saveErrors.schemaOutdated');
  });

  it('autre erreur : message générique + détail technique (jamais un message vide)', () => {
    expect(describeSaveError({ message: 'permission denied for table maintenance_items' }, t, 'generic')).toBe('generic vehicleDetail.saveErrors.detail:permission denied for table maintenance_items');
    expect(describeSaveError(undefined, t, 'generic')).toBe('generic');
  });

  it('détail : première ligne, 140 caractères au plus', () => {
    expect(saveErrorDetail({ message: 'a'.repeat(300) })?.length).toBe(138);
    expect(saveErrorDetail({ message: 'ligne 1\nligne 2' })).toBe('ligne 1');
    expect(saveErrorDetail({ message: '   ' })).toBeNull();
  });
});
