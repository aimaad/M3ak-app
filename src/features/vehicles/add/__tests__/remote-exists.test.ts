/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));

import type { ExistingVehicle } from '../lookup';
import { checkVehicleExists, combineDuplicate, parseRemoteExists } from '../remote-exists';

describe('réponse de vehicle_exists', () => {
  it('une ligne { found, branch_name } (tableau ou objet)', () => {
    expect(parseRemoteExists([{ found: true, branch_name: 'Rabat' }])).toEqual({ found: true, branchName: 'Rabat' });
    expect(parseRemoteExists({ found: true, branch_name: 'Rabat' })).toEqual({ found: true, branchName: 'Rabat' });
    expect(parseRemoteExists([{ found: true, branch_name: null }])).toEqual({ found: true, branchName: null }); // sans filiale
    expect(parseRemoteExists([{ found: false, branch_name: null }])).toEqual({ found: false, branchName: null });
  });
  it('pas de nom de filiale quand rien n’est trouvé ; nom vide = sans filiale', () => {
    expect(parseRemoteExists([{ found: false, branch_name: 'Rabat' }])?.branchName).toBeNull();
    expect(parseRemoteExists([{ found: true, branch_name: '  ' }])?.branchName).toBeNull();
  });
  it('toute autre forme est rejetée (jamais de faux « pas chez vous »)', () => {
    expect(parseRemoteExists(null)).toBeNull();
    expect(parseRemoteExists([])).toBeNull();
    expect(parseRemoteExists('oui')).toBeNull();
    expect(parseRemoteExists([{ found: 'true' }])).toBeNull();
  });
});

describe('contrôle serveur du doublon', () => {
  beforeEach(() => mockRpc.mockReset());

  it('envoie la plaque au format enregistré et le VIN normalisé', async () => {
    mockRpc.mockResolvedValue({ data: [{ found: true, branch_name: 'Rabat' }], error: null });
    const result = await checkVehicleExists('a1', { plate: '33507-أ-6', vin: ' 1hgcm-82633 a004352 ' });
    expect(mockRpc).toHaveBeenCalledWith('vehicle_exists', { p_agency_id: 'a1', p_plate: '33507 | أ | 6', p_vin: '1HGCM82633A004352' });
    expect(result).toEqual({ found: true, branchName: 'Rabat' });
  });

  it('plaque seule, ou VIN seul', async () => {
    mockRpc.mockResolvedValue({ data: [{ found: false, branch_name: null }], error: null });
    await checkVehicleExists('a1', { plate: 'ww482190' });
    expect(mockRpc).toHaveBeenLastCalledWith('vehicle_exists', { p_agency_id: 'a1', p_plate: 'WW 482190', p_vin: null });
    await checkVehicleExists('a1', { vin: '1HGCM82633A004352' });
    expect(mockRpc).toHaveBeenLastCalledWith('vehicle_exists', { p_agency_id: 'a1', p_plate: null, p_vin: '1HGCM82633A004352' });
  });

  it('rien à chercher : pas d’appel au serveur', async () => {
    expect(await checkVehicleExists('a1', { plate: '  ', vin: '' })).toEqual({ found: false, branchName: null });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('indisponible (erreur serveur, fonction pas déployée, hors connexion) : null, jamais une erreur', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function vehicle_exists does not exist' } });
    expect(await checkVehicleExists('a1', { plate: '8921 | ب | 14' })).toBeNull();
    mockRpc.mockRejectedValue(new Error('Network request failed'));
    expect(await checkVehicleExists('a1', { plate: '8921 | ب | 14' })).toBeNull();
    mockRpc.mockResolvedValue({ data: 'n’importe quoi', error: null });
    expect(await checkVehicleExists('a1', { plate: '8921 | ب | 14' })).toBeNull();
  });
});

describe('doublon à signaler', () => {
  const local = { field: 'immatriculation', vehicle: { id: 'v' }, archived: false } as ExistingVehicle;
  it('un véhicule visible l’emporte (on peut ouvrir sa fiche)', () => {
    expect(combineDuplicate(local, { found: true, branchName: 'Rabat' })).toMatchObject({ kind: 'visible', vehicle: { id: 'v' } });
    expect(combineDuplicate(local, null)).toMatchObject({ kind: 'visible' });
  });
  it('sinon un véhicule d’une autre filiale : le nom seulement', () => {
    expect(combineDuplicate(null, { found: true, branchName: 'Rabat' })).toEqual({ kind: 'elsewhere', branchName: 'Rabat' });
    expect(combineDuplicate(null, { found: true, branchName: null })).toEqual({ kind: 'elsewhere', branchName: null });
  });
  it('rien de trouvé ou vérification indisponible : pas de doublon', () => {
    expect(combineDuplicate(null, { found: false, branchName: null })).toBeNull();
    expect(combineDuplicate(null, null)).toBeNull();
  });
});
