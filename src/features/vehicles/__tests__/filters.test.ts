import {
  countByStatus,
  countExpiringSoonDocuments,
  countImmobilized,
  DEFAULT_VEHICLE_FILTERS,
  filterVehicles,
  sortVehicles,
  uniqueBrands,
  type VehicleFilters,
} from '../filters';
import type { Vehicle } from '../types';

function makeVehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    id: overrides.id ?? '1',
    agencyId: 'agency-1',
    branchId: null,
    immatriculation: '1234-أ-14',
    marque: 'Dacia',
    modele: 'Logan',
    annee: 2022,
    categorie: null,
    couleur: null,
    nombrePlaces: null,
    transmission: null,
    carburant: 'diesel',
    kilometrage: 10000,
    niveauCarburant: null,
    statut: 'disponible',
    prixJour: 250,
    prixSemaine: null,
    prixMois: null,
    description: null,
    photoUrl: null,
    photos: [],
    documents: [],
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function filters(overrides: Partial<VehicleFilters> = {}): VehicleFilters {
  return { ...DEFAULT_VEHICLE_FILTERS, ...overrides };
}

describe('filterVehicles', () => {
  const vehicles: Vehicle[] = [
    makeVehicle({ id: '1', marque: 'Dacia', modele: 'Logan', immatriculation: '8921-أ-14', statut: 'disponible', categorie: 'economique' }),
    makeVehicle({ id: '2', marque: 'Renault', modele: 'Clio', immatriculation: '7765-ج-14', statut: 'en_location', categorie: 'compacte' }),
    makeVehicle({ id: '3', marque: 'Peugeot', modele: '208', immatriculation: '5561-ه-14', statut: 'maintenance', categorie: 'compacte' }),
    makeVehicle({ id: '4', marque: 'Dacia', modele: 'Duster', immatriculation: '1122-أ-14', statut: 'disponible', archivedAt: '2026-01-02T00:00:00.000Z' }),
  ];

  it('masque les véhicules archivés par défaut', () => {
    expect(filterVehicles(vehicles, filters()).map((v) => v.id)).toEqual(['1', '2', '3']);
  });

  it('affiche uniquement les archivés quand includeArchived est vrai', () => {
    expect(filterVehicles(vehicles, filters({ includeArchived: true })).map((v) => v.id)).toEqual(['4']);
  });

  it('filtre par statut', () => {
    const result = filterVehicles(vehicles, filters({ statusFilter: 'en_location' }));
    expect(result.map((v) => v.id)).toEqual(['2']);
  });

  it('filtre par recherche sur la marque, insensible à la casse', () => {
    const result = filterVehicles(vehicles, filters({ query: 'renault' }));
    expect(result.map((v) => v.id)).toEqual(['2']);
  });

  it("filtre par recherche sur l'immatriculation", () => {
    const result = filterVehicles(vehicles, filters({ query: '5561' }));
    expect(result.map((v) => v.id)).toEqual(['3']);
  });

  it('filtre par catégorie', () => {
    const result = filterVehicles(vehicles, filters({ categorie: 'economique' }));
    expect(result.map((v) => v.id)).toEqual(['1']);
  });

  it('filtre par marque', () => {
    const result = filterVehicles(vehicles, filters({ marque: 'Peugeot' }));
    expect(result.map((v) => v.id)).toEqual(['3']);
  });

  it('combine statut et recherche', () => {
    const result = filterVehicles(vehicles, filters({ statusFilter: 'disponible', query: 'logan' }));
    expect(result.map((v) => v.id)).toEqual(['1']);
  });
});

describe('sortVehicles', () => {
  const vehicles: Vehicle[] = [
    makeVehicle({ id: '1', marque: 'Renault', immatriculation: 'B-200', prixJour: 300, kilometrage: 50000 }),
    makeVehicle({ id: '2', marque: 'Dacia', immatriculation: 'A-100', prixJour: 200, kilometrage: 10000 }),
  ];

  it('trie par marque', () => {
    expect(sortVehicles(vehicles, 'marque').map((v) => v.id)).toEqual(['2', '1']);
  });

  it('trie par prix croissant', () => {
    expect(sortVehicles(vehicles, 'prixJour').map((v) => v.id)).toEqual(['2', '1']);
  });

  it('trie par kilométrage croissant', () => {
    expect(sortVehicles(vehicles, 'kilometrage').map((v) => v.id)).toEqual(['2', '1']);
  });

  it("ne modifie pas le tableau d'origine", () => {
    const copy = [...vehicles];
    sortVehicles(vehicles, 'marque');
    expect(vehicles).toEqual(copy);
  });
});

describe('countByStatus', () => {
  it('compte correctement chaque statut, le total et exclut les archivés', () => {
    const vehicles: Vehicle[] = [
      makeVehicle({ id: '1', statut: 'disponible' }),
      makeVehicle({ id: '2', statut: 'disponible' }),
      makeVehicle({ id: '3', statut: 'en_location' }),
      makeVehicle({ id: '4', statut: 'maintenance' }),
      makeVehicle({ id: '5', statut: 'a_inspecter' }),
      makeVehicle({ id: '6', statut: 'disponible', archivedAt: '2026-01-02T00:00:00.000Z' }),
    ];

    expect(countByStatus(vehicles)).toEqual({
      tous: 5,
      disponible: 2,
      en_location: 1,
      maintenance: 1,
      a_inspecter: 1,
      en_preparation: 0,
      indisponible: 0,
    });
  });
});

describe('countImmobilized', () => {
  it('compte maintenance, à inspecter, en préparation et indisponible', () => {
    const vehicles: Vehicle[] = [
      makeVehicle({ id: '1', statut: 'disponible' }),
      makeVehicle({ id: '2', statut: 'maintenance' }),
      makeVehicle({ id: '3', statut: 'a_inspecter' }),
      makeVehicle({ id: '4', statut: 'en_preparation' }),
      makeVehicle({ id: '5', statut: 'indisponible' }),
      makeVehicle({ id: '6', statut: 'en_location' }),
      makeVehicle({ id: '7', statut: 'maintenance', archivedAt: '2026-01-02T00:00:00.000Z' }),
    ];

    expect(countImmobilized(vehicles)).toBe(4);
  });
});

describe('countExpiringSoonDocuments', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('compte les documents expirant dans la fenêtre donnée', () => {
    const vehicles: Vehicle[] = [
      makeVehicle({
        id: '1',
        documents: [
          { type: 'assurance', path: 'a', uploadedAt: now.toISOString(), expiresAt: '2026-01-10T00:00:00.000Z' },
          { type: 'visite_technique', path: 'b', uploadedAt: now.toISOString(), expiresAt: '2026-06-01T00:00:00.000Z' },
        ],
      }),
      makeVehicle({
        id: '2',
        documents: [
          { type: 'carte_grise', path: 'c', uploadedAt: now.toISOString(), expiresAt: null },
        ],
      }),
    ];

    expect(countExpiringSoonDocuments(vehicles, 30, now)).toBe(1);
  });

  it('ignore les véhicules archivés', () => {
    const vehicles: Vehicle[] = [
      makeVehicle({
        id: '1',
        archivedAt: '2025-12-01T00:00:00.000Z',
        documents: [
          { type: 'assurance', path: 'a', uploadedAt: now.toISOString(), expiresAt: '2026-01-05T00:00:00.000Z' },
        ],
      }),
    ];

    expect(countExpiringSoonDocuments(vehicles, 30, now)).toBe(0);
  });
});

describe('uniqueBrands', () => {
  it('renvoie les marques triées sans doublon', () => {
    const vehicles: Vehicle[] = [
      makeVehicle({ id: '1', marque: 'Renault' }),
      makeVehicle({ id: '2', marque: 'Dacia' }),
      makeVehicle({ id: '3', marque: 'Renault' }),
    ];
    expect(uniqueBrands(vehicles)).toEqual(['Dacia', 'Renault']);
  });
});
