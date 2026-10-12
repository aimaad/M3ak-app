import { vehicleDocumentAlerts } from '../document-alerts';
import type { Vehicle } from '../types';

function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    agencyId: 'a1',
    branchId: null,
    immatriculation: '8921 | ب | 14',
    vin: null,
    marque: 'Dacia',
    modele: 'Logan',
    finition: null,
    annee: null,
    categorie: null,
    couleur: null,
    nombrePlaces: null,
    transmission: null,
    carburant: 'essence',
    kilometrage: 0,
    niveauCarburant: null,
    statut: 'disponible',
    prixJour: 200,
    prixSemaine: null,
    prixMois: null,
    description: null,
    photoUrl: null,
    photos: [],
    documents: [],
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('vehicleDocumentAlerts', () => {
  const today = new Date('2026-06-15T00:00:00Z');

  it('signale un document véhicule expiré ou proche de l\'expiration', () => {
    const vehicle = buildVehicle({
      documents: [
        { type: 'assurance', path: 'p', uploadedAt: 't', expiresAt: '2026-06-01T00:00:00Z' },
        { type: 'visite_technique', path: 'p', uploadedAt: 't', expiresAt: '2027-01-01T00:00:00Z' },
      ],
    });
    const alerts = vehicleDocumentAlerts([vehicle], today);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: 'assurance', urgency: 'expire', vehicleId: 'v1' });
  });

  it('ignore les véhicules archivés', () => {
    const vehicle = buildVehicle({
      archivedAt: '2026-01-01T00:00:00Z',
      documents: [{ type: 'assurance', path: 'p', uploadedAt: 't', expiresAt: '2026-06-01T00:00:00Z' }],
    });
    expect(vehicleDocumentAlerts([vehicle], today)).toEqual([]);
  });
});
