import { parseVehicleSection } from '../use-section-scroll';

describe('?section= de la fiche véhicule', () => {
  it('accepte photos, documents et entretien', () => {
    expect(parseVehicleSection('photos')).toBe('photos');
    expect(parseVehicleSection('documents')).toBe('documents');
    expect(parseVehicleSection('entretien')).toBe('entretien');
  });
  it('une valeur inconnue ou absente n’a aucun effet', () => {
    expect(parseVehicleSection('autre')).toBeNull();
    expect(parseVehicleSection('')).toBeNull();
    expect(parseVehicleSection(undefined)).toBeNull();
    expect(parseVehicleSection(['entretien', 'photos'])).toBe('entretien'); // adresse répétée : la première
  });
});
