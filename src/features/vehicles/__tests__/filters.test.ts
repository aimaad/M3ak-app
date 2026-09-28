import { countByStatus, filterVehicles } from '../filters';
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
    carburant: 'diesel',
    kilometrage: 10000,
    statut: 'disponible',
    prixJour: 250,
    photoUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterVehicles', () => {
  const vehicles: Vehicle[] = [
    makeVehicle({ id: '1', marque: 'Dacia', modele: 'Logan', immatriculation: '8921-أ-14', statut: 'disponible' }),
    makeVehicle({ id: '2', marque: 'Renault', modele: 'Clio', immatriculation: '7765-ج-14', statut: 'en_location' }),
    makeVehicle({ id: '3', marque: 'Peugeot', modele: '208', immatriculation: '5561-ه-14', statut: 'maintenance' }),
  ];

  it("renvoie tout quand le filtre est 'tous' et la recherche vide", () => {
    expect(filterVehicles(vehicles, 'tous', '')).toHaveLength(3);
  });

  it('filtre par statut', () => {
    const result = filterVehicles(vehicles, 'en_location', '');
    expect(result.map((v) => v.id)).toEqual(['2']);
  });

  it('filtre par recherche sur la marque, insensible à la casse', () => {
    const result = filterVehicles(vehicles, 'tous', 'renault');
    expect(result.map((v) => v.id)).toEqual(['2']);
  });

  it("filtre par recherche sur l'immatriculation", () => {
    const result = filterVehicles(vehicles, 'tous', '5561');
    expect(result.map((v) => v.id)).toEqual(['3']);
  });

  it('combine statut et recherche', () => {
    const result = filterVehicles(vehicles, 'disponible', 'logan');
    expect(result.map((v) => v.id)).toEqual(['1']);
  });
});

describe('countByStatus', () => {
  it('compte correctement chaque statut et le total', () => {
    const vehicles: Vehicle[] = [
      makeVehicle({ id: '1', statut: 'disponible' }),
      makeVehicle({ id: '2', statut: 'disponible' }),
      makeVehicle({ id: '3', statut: 'en_location' }),
      makeVehicle({ id: '4', statut: 'maintenance' }),
      makeVehicle({ id: '5', statut: 'a_inspecter' }),
    ];

    expect(countByStatus(vehicles)).toEqual({
      tous: 5,
      disponible: 2,
      en_location: 1,
      maintenance: 1,
      a_inspecter: 1,
    });
  });
});
