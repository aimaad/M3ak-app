import type { ComplianceRecord } from '@/features/compliance/types';

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

  describe('avec les périodes (couverture réelle d’aujourd’hui)', () => {
    const period = (kind: ComplianceRecord['kind'], validFrom: string | null, validUntil: string): ComplianceRecord => ({ id: `${kind}-${validUntil}`, agencyId: 'a1', vehicleId: 'v1', kind, validFrom, validUntil, reference: null, provider: null, amount: null, documentPath: null, notes: null, periodMonths: null, createdBy: null, createdAt: '2026-01-01T00:00:00Z' });
    // Le document porte la vraie fin (2029) de la seule période, qui commence en 2028 : sans les périodes, rien n'est signalé.
    const farDocument = buildVehicle({ documents: [{ type: 'assurance', path: 'p', uploadedAt: 't', expiresAt: '2029-11-15T00:00:00Z' }] });

    it('seule une période à venir : l’assurance est signalée « non couverte »', () => {
      expect(vehicleDocumentAlerts([farDocument], today)).toEqual([]);
      const alerts = vehicleDocumentAlerts([farDocument], today, 30, [period('assurance', '2028-11-16', '2029-11-15')]);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ vehicleId: 'v1', type: 'assurance', urgency: 'expire', uncovered: true });
    });
    it('période en cours : rien en plus (pas de doublon avec le document)', () => {
      const alerts = vehicleDocumentAlerts([farDocument], today, 30, [period('assurance', '2026-01-01', '2026-12-31')]);
      expect(alerts).toEqual([]);
    });
    it('document déjà expiré : une seule alerte, pas deux', () => {
      const vehicle = buildVehicle({ documents: [{ type: 'assurance', path: 'p', uploadedAt: 't', expiresAt: '2026-06-01T00:00:00Z' }] });
      expect(vehicleDocumentAlerts([vehicle], today, 30, [period('assurance', '2026-12-01', '2027-11-30')])).toHaveLength(1);
    });
    it('aucune période enregistrée : rien d’inventé (« À compléter » n’est pas une expiration)', () => {
      expect(vehicleDocumentAlerts([farDocument], today, 30, [])).toEqual([]);
    });
    it('véhicule archivé ignoré', () => {
      const archived = buildVehicle({ archivedAt: '2026-01-01T00:00:00Z' });
      expect(vehicleDocumentAlerts([archived], today, 30, [period('assurance', '2028-11-16', '2029-11-15')])).toEqual([]);
    });
  });
});
