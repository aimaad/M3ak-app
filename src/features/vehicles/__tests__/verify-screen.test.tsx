/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));

const NOW = new Date();
const at = (delta: number, hour = 9) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + delta, hour).toISOString();
const base = { agencyId: 'a1', branchId: null, kilometrage: 1000, prixJour: 400, photos: [], documents: [], categorie: 'economique', createdAt: '2029-03-10T10:00:00.000Z', updatedAt: at(-1), vin: null };
const mockState = {
  failed: false,
  remote: { found: false, branchName: null } as { found: boolean; branchName: string | null } | null,
  remoteCalls: [] as unknown[],
  vehicles: [
    { ...base, id: 'sandero', marque: 'Dacia', modele: 'Sandero', immatriculation: '68013 | ب | 72', statut: 'en_location', archivedAt: null },
    { ...base, id: 'vieille', marque: 'Fiat', modele: 'Punto', immatriculation: '1234-هـ-5', statut: 'disponible', archivedAt: at(-30), vin: '1HGCM82633A004352' },
  ],
  rentals: [
    { id: 'r1', vehicleId: 'sandero', customerId: 'c1', statut: 'en_cours', dateDebutPrevue: at(-1), dateFinPrevue: at(5, 18), dateDepartReel: at(-1), dateRetourReel: null },
    { id: 'r2', vehicleId: 'sandero', customerId: 'c1', statut: 'terminee', dateDebutPrevue: at(-20), dateFinPrevue: at(-15), dateDepartReel: at(-20), dateRetourReel: at(-15) },
    { id: 'r3', vehicleId: 'sandero', customerId: 'c1', statut: 'annulee', dateDebutPrevue: at(-40), dateFinPrevue: at(-35), dateDepartReel: null, dateRetourReel: null },
  ],
  saved: [] as string[][],
};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
const mockQuery = (data: unknown) => (mockState.failed ? { data: undefined, isError: true, isLoading: false, isFetching: false } : { data, isError: false, isLoading: false, isFetching: false });

jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: 'employee' } }) }));
jest.mock('@/features/vehicles/add/remote-exists', () => ({
  checkVehicleExists: async (agencyId: string, candidate: unknown) => {
    mockState.remoteCalls.push([agencyId, candidate]);
    return mockState.remote;
  },
}));
jest.mock('@/features/vehicles/hooks', () => ({ useVehicles: () => mockQuery(mockState.vehicles) }));
jest.mock('@/features/rentals/hooks', () => ({ useRentals: () => mockQuery(mockState.rentals) }));
jest.mock('@/features/maintenance/hooks', () => ({ useMaintenanceItems: () => mockQuery([]) }));
jest.mock('@/features/customers/hooks', () => ({ useCustomers: () => mockQuery([{ id: 'c1', nomComplet: 'FOUAD BENNANI', telephone: null }]) }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/features/vehicles/api', () => ({ VEHICLE_PHOTOS_BUCKET: 'vehicle-photos' }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [{ granted: true }, jest.fn()] }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string, o?: Record<string, unknown>) => mockTranslate(key, o) }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockState.saved.push([key, value]);
  }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import VerifierPlaqueScreen from '../../../app/(tabs)/flotte/nouveau/verifier';

const hidden = { includeHiddenElements: true };

async function checkPlate(number: string, region: string, letter = 'ب') {
  await render(<VerifierPlaqueScreen />);
  await fireEvent.changeText(screen.getByLabelText('Numéro de la plaque'), number);
  await fireEvent.changeText(screen.getByLabelText('Région de la plaque'), region);
  await fireEvent.press(screen.getByLabelText('Lettre de la plaque, à choisir'));
  await fireEvent.press(screen.getByLabelText(`Lettre de la plaque : ${letter}`));
  await fireEvent.press(screen.getByText('Vérifier'));
}

describe('outil « Vérifier une plaque »', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.failed = false;
    mockState.saved = [];
    mockState.remote = { found: false, branchName: null };
    mockState.remoteCalls = [];
  });

  it('plaque trouvée : « Déjà dans votre flotte », contexte, 3 chiffres, et le bouton ouvre sa fiche (rien n’est créé)', async () => {
    await checkPlate('68013', '72');
    expect(await screen.findByText('Déjà dans votre flotte')).toBeTruthy();
    expect(screen.getByText('Dacia Sandero')).toBeTruthy();
    expect(screen.getByText(/Fouad B\. · retour/)).toBeTruthy(); // même ligne de contexte que Ma Flotte, nom normalisé
    expect(screen.getByText('mars 2029')).toBeTruthy(); // dans la flotte depuis
    expect(screen.getByText('2')).toBeTruthy(); // 2 locations (l'annulée n'est pas comptée)
    expect(screen.getByText('Occupation 30 j')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ouvrir sa fiche'));
    expect(mockRouter.push).toHaveBeenCalledWith('/flotte/sandero');
  });

  it('plaque inconnue : « Pas dans votre flotte » et « L’ajouter » garde la plaque saisie', async () => {
    await checkPlate('11111', '9', 'د');
    expect(await screen.findByText('Pas dans votre flotte')).toBeTruthy();
    expect(screen.getByText(/Aucun véhicule avec la plaque 11111/)).toBeTruthy();
    await fireEvent.press(screen.getByText("L'ajouter à ma flotte"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/flotte/nouveau', params: { plate: '11111 | د | 9' } });
  });

  it('véhicule archivé : trouvé et marqué « Archivé » (la lettre « هـ » vaut « ه »)', async () => {
    await checkPlate('1234', '5', 'ه');
    expect(await screen.findByText('Déjà dans votre flotte · archivé')).toBeTruthy();
    expect(screen.getAllByText('Archivé', hidden).length).toBeGreaterThan(0);
  });

  it('plaque incomplète : message clair, aucune vérification', async () => {
    await render(<VerifierPlaqueScreen />);
    await fireEvent.changeText(screen.getByLabelText('Numéro de la plaque'), '68013');
    await fireEvent.press(screen.getByText('Vérifier'));
    expect(screen.getByText('Complétez le numéro, la lettre et la région.')).toBeTruthy();
    expect(screen.queryByText('Pas dans votre flotte')).toBeNull();
  });

  it('VIN : trouvé même sur un véhicule archivé ; VIN invalide refusé', async () => {
    await render(<VerifierPlaqueScreen />);
    await fireEvent.press(screen.getByText('VIN'));
    await fireEvent.changeText(screen.getByLabelText('Numéro VIN'), '1HGCM82633A00435I');
    await fireEvent.press(screen.getByText('Vérifier'));
    expect(screen.getByText(/Un VIN a 17 caractères/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Numéro VIN'), '1hgcm82633a004352');
    await fireEvent.press(screen.getByText('Vérifier'));
    expect(await screen.findByText('Déjà dans votre flotte · archivé')).toBeTruthy();
  });

  it('WW : saisie du numéro, résultat « pas chez vous »', async () => {
    await render(<VerifierPlaqueScreen />);
    await fireEvent.press(screen.getByText('WW'));
    await fireEvent.changeText(screen.getByLabelText('Numéro WW'), '482190');
    await fireEvent.press(screen.getByText('Vérifier'));
    expect(await screen.findByText('Pas dans votre flotte')).toBeTruthy();
    expect(screen.getAllByText(/WW 482190/).length).toBeGreaterThan(0); // dans la réponse et dans « dernières vérifications »
  });

  it('les 5 dernières vérifications sont gardées sur le téléphone et un tap relance', async () => {
    await checkPlate('11111', '9', 'د');
    await screen.findByText('Pas dans votre flotte');
    expect(mockState.saved.at(-1)?.[0]).toBe('bibip.vehicle.checks.v1');
    expect(JSON.parse(mockState.saved.at(-1)?.[1] ?? '[]')[0]).toMatchObject({ query: '11111 | د | 9', kind: 'plate', found: false });
    expect(screen.getByText('DERNIÈRES VÉRIFICATIONS')).toBeTruthy();
    expect(screen.getByText('Pas chez vous')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Relancer la vérification : 11111 | د | 9'));
    expect(screen.getAllByText('Pas dans votre flotte').length).toBeGreaterThan(0);
  });

  it('véhicule d’une AUTRE filiale (invisible pour l’employé) : « Déjà dans votre flotte », le nom de la filiale, rien d’autre, rien à ajouter', async () => {
    mockState.remote = { found: true, branchName: 'Rabat' };
    await checkPlate('11111', '9', 'د');
    expect(await screen.findByText('Déjà dans votre flotte')).toBeTruthy();
    expect(screen.getByText('Ce véhicule est dans la filiale Rabat.')).toBeTruthy();
    expect(screen.getByText('Vous ne voyez pas sa fiche : elle appartient à une autre filiale.')).toBeTruthy();
    expect(screen.queryByText('Ouvrir sa fiche')).toBeNull();
    expect(screen.queryByText("L'ajouter à ma flotte")).toBeNull();
    expect(screen.queryByText('Pas dans votre flotte')).toBeNull();
    expect(mockState.remoteCalls).toEqual([['a1', { plate: '11111 | د | 9' }]]);
    expect(JSON.parse(mockState.saved.at(-1)?.[1] ?? '[]')[0]).toMatchObject({ found: true }); // mémorisé comme « dans la flotte »
  });

  it('véhicule d’une autre filiale, sans filiale (agence entière) : le dit', async () => {
    mockState.remote = { found: true, branchName: null };
    await checkPlate('11111', '9', 'د');
    expect(await screen.findByText('Ce véhicule est dans votre agence, sans filiale.')).toBeTruthy();
  });

  it('VIN : le serveur est interrogé avec le VIN normalisé', async () => {
    mockState.remote = { found: true, branchName: 'Tanger' };
    await render(<VerifierPlaqueScreen />);
    await fireEvent.press(screen.getByText('VIN'));
    await fireEvent.changeText(screen.getByLabelText('Numéro VIN'), 'jtdkn3du0a0123456');
    await fireEvent.press(screen.getByText('Vérifier'));
    expect(await screen.findByText('Ce véhicule est dans la filiale Tanger.')).toBeTruthy();
    expect(mockState.remoteCalls[0]).toEqual(['a1', { vin: 'JTDKN3DU0A0123456' }]);
  });

  it('véhicule visible : trouvé sans interroger le serveur', async () => {
    await checkPlate('68013', '72');
    await screen.findByText('Déjà dans votre flotte');
    expect(mockState.remoteCalls).toHaveLength(0);
  });

  it('contrôle des autres filiales indisponible : « pas dans votre flotte » avec la limite dite clairement', async () => {
    mockState.remote = null;
    await checkPlate('11111', '9', 'د');
    expect(await screen.findByText('Pas dans votre flotte')).toBeTruthy();
    expect(screen.getByText(/Vérification limitée à ce que vous voyez/)).toBeTruthy();
  });

  it('flotte impossible à charger : message clair, pas de faux « pas chez vous »', async () => {
    mockState.failed = true;
    await checkPlate('11111', '9', 'د');
    expect(screen.getAllByText(/Impossible de charger votre flotte/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Pas dans votre flotte')).toBeNull();
  });
});
