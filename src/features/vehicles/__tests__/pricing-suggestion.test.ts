import { suggestDailyPrice } from '../pricing-suggestion';
import type { Vehicle } from '../types';

function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    agencyId: 'a1',
    branchId: null,
    immatriculation: 'TEST',
    vin: null,
    marque: 'Dacia',
    modele: 'Logan',
    finition: null,
    annee: null,
    categorie: 'economique',
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

describe('suggestDailyPrice', () => {
  it('ne suggère rien sans catégorie choisie', () => {
    expect(suggestDailyPrice([buildVehicle()], null)).toBeNull();
  });

  it("ne suggère rien sans véhicule existant de cette catégorie", () => {
    const vehicles = [buildVehicle({ categorie: 'suv', prixJour: 400 })];
    expect(suggestDailyPrice(vehicles, 'economique')).toBeNull();
  });

  it('suggère la médiane des véhicules existants de la même catégorie', () => {
    const vehicles = [
      buildVehicle({ prixJour: 200 }),
      buildVehicle({ prixJour: 250 }),
      buildVehicle({ prixJour: 300 }),
    ];
    expect(suggestDailyPrice(vehicles, 'economique')).toBe(250);
  });

  it('moyenne les deux valeurs centrales quand le nombre est pair', () => {
    const vehicles = [buildVehicle({ prixJour: 200 }), buildVehicle({ prixJour: 300 })];
    expect(suggestDailyPrice(vehicles, 'economique')).toBe(250);
  });

  it('ignore les véhicules archivés et les autres catégories', () => {
    const vehicles = [
      buildVehicle({ prixJour: 200 }),
      buildVehicle({ prixJour: 9999, archivedAt: '2026-01-01T00:00:00Z' }),
      buildVehicle({ prixJour: 500, categorie: 'luxe' }),
    ];
    expect(suggestDailyPrice(vehicles, 'economique')).toBe(200);
  });
});
