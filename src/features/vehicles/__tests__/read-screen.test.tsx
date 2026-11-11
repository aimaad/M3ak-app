/* eslint-disable import/first, @typescript-eslint/no-require-imports -- les « jest.mock » doivent précéder les imports et utilisent require */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));

const mockState = {
  vehicles: [] as unknown[],
  role: 'owner',
  drafts: [] as Record<string, unknown>[],
  reactivate: jest.fn(),
  remote: null as { found: boolean; branchName: string | null } | null,
};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('expo-haptics', () => ({ selectionAsync: async () => undefined }));
jest.mock('@/features/vehicles/hooks', () => ({ useVehicles: () => ({ data: mockState.vehicles }), useReactivateVehicle: () => ({ mutate: mockState.reactivate }) }));
jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: mockState.role } }) }));
jest.mock('@/features/vehicles/add/use-remote-exists', () => ({ useRemoteExists: () => mockState.remote }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/features/vehicles/api', () => ({ VEHICLE_PHOTOS_BUCKET: 'vehicle-photos' }));
jest.mock('@/features/vehicles/creation-draft', () => ({ setVehicleCreationDraft: (draft: Record<string, unknown>) => mockState.drafts.push(draft) }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string, o?: Record<string, unknown>) => mockTranslate(key, o) }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { normalizeVehicleFields } from '@/features/vehicles/ocr';
import { setScanSession, type ScanItem } from '@/features/vehicles/add/scan-session';

import CarteLueScreen from '../../../app/(tabs)/flotte/nouveau/carte-lue';

const field = (value: unknown, confidence = 'high') => ({ value, confidence });

function openSession(patch: Record<string, unknown>, extra: { keepPhoto?: boolean; fromCache?: boolean; durationMs?: number } = {}) {
  const recto: ScanItem = { face: 'recto', uri: 'file:///recto.jpg' };
  const verso: ScanItem = { face: 'verso', uri: 'file:///verso.jpg' };
  // Une seule lecture, faite sur les deux faces ensemble.
  const merged = normalizeVehicleFields({ immatriculation: field('68013-ب-72'), dateMiseEnCirculation: field('2022-03-12'), proprietaire: field('Atlas Voyages'), marque: field('Dacia'), modele: field('Sandero Stepway', 'medium'), carburant: field('diesel'), puissanceFiscale: field(6), genre: field('Voiture particulière'), vin: field('UU1HSDAGC56789012'), ...patch });
  setScanSession({ photos: { recto: recto.uri, verso: verso.uri }, scans: [recto, verso], merged, durationMs: extra.durationMs ?? 6200, fromCache: extra.fromCache ?? false, keepPhoto: extra.keepPhoto ?? true, errorCode: null });
}

describe('écran « Carte grise lue »', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.vehicles = [];
    mockState.role = 'owner';
    mockState.drafts = [];
    mockState.remote = null;
    setScanSession(null);
  });

  it('tout est sûr : « Lu en 6 s », 0 à vérifier, « Nouveau véhicule », bouton orange qui mène à Finaliser avec le brouillon', async () => {
    openSession({});
    await render(<CarteLueScreen />);
    expect(screen.getByText('Lu en 6 s')).toBeTruthy();
    expect(screen.getByText('Nouveau véhicule.')).toBeTruthy();
    expect(screen.getByText('Dacia Sandero Stepway')).toBeTruthy();
    expect(screen.getByText('CHAMPS LUS')).toBeTruthy();
    expect(screen.queryByText(/INFO(S)? À CONFIRMER/)).toBeNull();
    await fireEvent.press(screen.getByText('Tout est bon, continuer'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/flotte/nouveau/finaliser');
    expect(mockState.drafts[0]).toMatchObject({ immatriculation: '68013 | ب | 72', marque: 'Dacia', modele: 'Sandero Stepway', vin: 'UU1HSDAGC56789012', carburant: 'diesel', puissanceFiscale: 6, genre: 'Voiture particulière', source: 'scan' });
    expect(mockState.drafts[0].uncertainFields).toBeUndefined();
  });

  it('VIN avec un « O » : 1 info à confirmer avec la valeur lue et la correction pré-remplie ; le bouton est gris tant que rien n’est confirmé', async () => {
    openSession({ vin: field('UU1HSDAGC5678901O') });
    await render(<CarteLueScreen />);
    expect(screen.getByText('1 INFO À CONFIRMER')).toBeTruthy();
    expect(screen.getByText('Caractère peu lisible')).toBeTruthy();
    expect(screen.getByDisplayValue('UU1HSDAGC56789010')).toBeTruthy(); // O → 0
    expect(screen.getByText('Confirmer le VIN d\'abord')).toBeTruthy();
    await fireEvent.press(screen.getByText('Confirmer le VIN d\'abord'));
    expect(mockRouter.replace).not.toHaveBeenCalled(); // désactivé
    await fireEvent.press(screen.getByLabelText('Confirmer N° de série (VIN)'));
    expect(screen.queryByText('1 INFO À CONFIRMER')).toBeNull();
    await fireEvent.press(screen.getByText('Tout est bon, continuer'));
    expect(mockState.drafts[0]).toMatchObject({ vin: 'UU1HSDAGC56789010' });
  });

  it('valeur encore invalide : refusée avec la raison, rien n’est confirmé', async () => {
    openSession({ vin: field('UU1HSDAGC5678901O') });
    await render(<CarteLueScreen />);
    await fireEvent.changeText(screen.getByDisplayValue('UU1HSDAGC56789010'), 'UU1HSDAGC567');
    await fireEvent.press(screen.getByLabelText('Confirmer N° de série (VIN)'));
    expect(screen.getByText('Nombre de caractères incorrect')).toBeTruthy();
    expect(screen.getByText('1 INFO À CONFIRMER')).toBeTruthy();
  });

  it('lecture peu sûre (confiance faible) : dans « à confirmer » ; confiance moyenne : reste dans la liste, sans blocage', async () => {
    openSession({ modele: field('Sandero', 'low'), marque: field('Dacia', 'medium') });
    await render(<CarteLueScreen />);
    expect(screen.getByText('Lecture peu sûre')).toBeTruthy();
    expect(screen.getByText('Confirmer le modèle d\'abord')).toBeTruthy();
    expect(screen.getByLabelText('Marque : Dacia')).toBeTruthy(); // ligne lisible, pas à confirmer
  });

  it('doublon : bandeau avec sa fiche, « Continuer » désactivé ; l’archivé peut être réactivé par le propriétaire', async () => {
    mockState.vehicles = [{ id: 'v9', marque: 'Dacia', modele: 'Logan', immatriculation: '68013 | ب | 72', vin: null, photos: [], archivedAt: '2030-01-01T00:00:00Z' }];
    openSession({});
    await render(<CarteLueScreen />);
    expect(screen.getAllByText('Déjà dans votre flotte')).toHaveLength(2); // le bandeau et le bouton désactivé
    expect(screen.getByText(/Une voiture a déjà cette plaque\. Elle est archivée\./)).toBeTruthy();
    expect(screen.queryByText('Nouveau véhicule.')).toBeNull();
    expect(screen.getByText('DOUBLON')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ouvrir sa fiche'));
    expect(mockRouter.push).toHaveBeenCalledWith('/flotte/v9');
    await fireEvent.press(screen.getByText('Réactiver'));
    expect(mockState.reactivate).toHaveBeenCalledWith('v9', expect.anything());
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('doublon détecté sur le VIN, et l’employé ne peut pas réactiver', async () => {
    mockState.role = 'employee';
    mockState.vehicles = [{ id: 'v8', marque: 'Dacia', modele: 'Logan', immatriculation: '1 | د | 1', vin: 'uu1hsdagc56789012', photos: [], archivedAt: '2030-01-01T00:00:00Z' }];
    openSession({});
    await render(<CarteLueScreen />);
    expect(screen.getByText(/Une voiture a déjà ce numéro de série\./)).toBeTruthy();
    expect(screen.queryByText('Réactiver')).toBeNull();
  });

  it('véhicule d’une AUTRE filiale : bandeau avec le nom de la filiale, pas de fiche à ouvrir, « Continuer » désactivé', async () => {
    mockState.remote = { found: true, branchName: 'Rabat' };
    openSession({});
    await render(<CarteLueScreen />);
    expect(screen.getByText('Ce véhicule existe déjà dans la filiale Rabat.')).toBeTruthy();
    expect(screen.queryByText('Ouvrir sa fiche')).toBeNull();
    expect(screen.queryByText('Nouveau véhicule.')).toBeNull();
    expect(screen.getByText('1')).toBeTruthy(); // compteur DOUBLON
    await fireEvent.press(screen.getAllByText('Déjà dans votre flotte').at(-1) as never); // le bouton désactivé
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('autre filiale sans nom (agence entière) ; contrôle serveur sans réponse : « Nouveau véhicule » comme avant', async () => {
    mockState.remote = { found: true, branchName: null };
    openSession({});
    await render(<CarteLueScreen />);
    expect(screen.getByText('Ce véhicule existe déjà dans votre agence.')).toBeTruthy();
  });

  it('le véhicule visible garde sa fiche même si le serveur répond aussi', async () => {
    mockState.remote = { found: true, branchName: 'Rabat' };
    mockState.vehicles = [{ id: 'v9', marque: 'Dacia', modele: 'Logan', immatriculation: '68013 | ب | 72', vin: null, photos: [], archivedAt: null }];
    openSession({});
    await render(<CarteLueScreen />);
    expect(screen.getByText('Ouvrir sa fiche')).toBeTruthy();
    expect(screen.queryByText(/filiale Rabat/)).toBeNull();
  });

  it('un tap sur une ligne la corrige', async () => {
    openSession({});
    await render(<CarteLueScreen />);
    await fireEvent.press(screen.getByLabelText('Marque : Dacia'));
    await fireEvent.changeText(screen.getByDisplayValue('Dacia'), 'Renault');
    await fireEvent.press(screen.getByLabelText('OK'));
    expect(screen.getByLabelText('Marque : Renault')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tout est bon, continuer'));
    expect(mockState.drafts[0]).toMatchObject({ marque: 'Renault' });
  });

  it('lecture en cache : « Lu instantanément » ; sans lecture en mémoire : retour au choix', async () => {
    openSession({}, { fromCache: true });
    await render(<CarteLueScreen />);
    expect(screen.getByText('Lu instantanément')).toBeTruthy();
  });

  it('ouvert sans lecture : retour à l’écran de choix', async () => {
    await render(<CarteLueScreen />);
    expect(screen.getByText('redirect:/flotte/nouveau')).toBeTruthy();
  });
});
