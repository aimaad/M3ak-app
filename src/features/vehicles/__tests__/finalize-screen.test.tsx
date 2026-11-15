/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));

const mockState = {
  role: 'owner' as 'owner' | 'manager' | 'employee',
  connected: true,
  draft: null as Record<string, unknown> | null,
  vehicles: [] as unknown[],
  created: [] as Record<string, unknown>[],
  documents: [] as Record<string, unknown>[],
  photos: [] as unknown[],
  uploaded: [] as unknown[],
  remote: null as { found: boolean; branchName: string | null } | null,
  ocrAvailability: 'no_key' as string,
  scanCalls: [] as unknown[],
  scanResult: { ok: false, error: 'ocr_failed' } as unknown,
};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const base = { agencyId: 'a1', branchId: null, kilometrage: 1000, photos: [], documents: [], archivedAt: null, createdAt: '2029-01-01T00:00:00.000Z', updatedAt: '2029-01-01T00:00:00.000Z', vin: null };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('expo-haptics', () => ({ notificationAsync: async () => undefined, NotificationFeedbackType: { Success: 'success' } }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///face.jpg' }] }),
  launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///galerie.jpg' }] }),
}));
jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: mockState.connected }) }));
jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: mockState.role } }), useMyProfile: () => ({ data: { branchId: 'b1' } }) }));
jest.mock('@/features/branches/hooks', () => ({ useBranches: () => ({ data: [] }) }));
jest.mock('@/features/vehicles/hooks', () => ({
  useVehicles: () => ({ data: mockState.vehicles }),
  useCreateVehicle: () => ({
    mutateAsync: async ({ input }: { input: Record<string, unknown> }) => {
      mockState.created.push(input);
      return { id: 'new1', immatriculation: input.immatriculation, documents: [], photos: [] };
    },
  }),
  useUpdateVehicleDocuments: () => ({ mutateAsync: async (args: { documents: Record<string, unknown>[] }) => void mockState.documents.push(...args.documents) }),
  useUpdateVehiclePhotos: () => ({ mutateAsync: async (args: { photos: unknown[] }) => void mockState.photos.push(...args.photos) }),
  useReactivateVehicle: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/features/vehicles/api', () => ({
  uploadVehicleDocument: async (...args: unknown[]) => {
    mockState.uploaded.push(args);
    return { type: args[2], path: 'p', uploadedAt: 'now', expiresAt: args[4] };
  },
  uploadVehiclePhoto: async (_a: unknown, _b: unknown, uri: string) => ({ path: uri, uploadedAt: 'now' }),
  VEHICLE_PHOTOS_BUCKET: 'vehicle-photos',
}));
jest.mock('@/features/vehicles/add/use-remote-exists', () => ({ useRemoteExists: () => mockState.remote }));
jest.mock('@/components/form/camera-capture', () => ({
  CameraCapture: ({ visible, onCapture }: { visible: boolean; onCapture: (uri: string) => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable } = require('react-native');
    return visible ? <Pressable accessibilityLabel="CAPTURE-PAPIER" onPress={() => onCapture('file:///papier.jpg')} /> : null;
  },
}));
jest.mock('@/components/form/photo-check', () => ({ checkPhoto: async () => ({ ok: true }) }));
jest.mock('@/features/ocr/hooks', () => ({ useOcrSettings: () => ({ availability: mockState.ocrAvailability, agencyId: 'a1' }) }));
jest.mock('@/features/compliance/paper-ocr', () => ({
  ...jest.requireActual('@/features/compliance/paper-ocr'),
  scanCompliancePaper: async (kind: string, uri: string) => {
    mockState.scanCalls.push({ kind, uri });
    return mockState.scanResult;
  },
}));
jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [{ granted: true }, jest.fn()] }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/features/vehicles/creation-draft', () => ({ takeVehicleCreationDraft: () => mockState.draft }));
jest.mock('@/features/vehicles/duplicate-vehicle-card', () => ({ DuplicateVehicleCard: () => null }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string, o?: Record<string, unknown>) => mockTranslate(key, o) }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { getCreatedVehicle } from '@/features/vehicles/add/created';

import FinaliserVehiculeScreen from '../../../app/(tabs)/flotte/nouveau/finaliser';

const scanDraft = { source: 'scan', immatriculation: '68013 | ب | 72', marque: 'Dacia', modele: 'Sandero Stepway', carburant: 'diesel', annee: 2022, genre: 'Voiture particulière', vin: 'UU1HSDAGC56789012', puissanceFiscale: 6, dateMiseEnCirculation: '12/03/2022' };

async function fillManualIdentity() {
  await fireEvent.changeText(screen.getByLabelText('Numéro de la plaque'), '68013');
  await fireEvent.changeText(screen.getByLabelText('Région de la plaque'), '72');
  await fireEvent.press(screen.getByLabelText('Lettre de la plaque, à choisir'));
  await fireEvent.press(screen.getByLabelText('Lettre de la plaque : ب'));
  await fireEvent.changeText(screen.getByLabelText('Marque'), 'Dacia');
  await fireEvent.changeText(screen.getByLabelText('Modèle'), 'Sandero');
}

describe('écran Finaliser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockState, { role: 'owner', connected: true, draft: null, vehicles: [], created: [], documents: [], photos: [], uploaded: [], remote: null, ocrAvailability: 'no_key', scanCalls: [], scanResult: { ok: false, error: 'ocr_failed' } });
  });

  it('à la main : 0/3, carburant à choisir en un tap, prix obligatoire ; création avec plaque normalisée et statut Disponible', async () => {
    await render(<FinaliserVehiculeScreen />);
    expect(screen.getByLabelText('0 sur 3 informations essentielles remplies')).toBeTruthy();
    expect(screen.getByText('Quel véhicule ?')).toBeTruthy();
    expect(screen.getByText('Carburant')).toBeTruthy(); // seulement en saisie à la main
    await fillManualIdentity();
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    expect(screen.getByText('Choisissez le carburant pour continuer.')).toBeTruthy(); // rien n'est créé sans carburant
    await fireEvent.press(screen.getByText('Diesel'));
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    expect(screen.getByText('Saisissez le prix par jour.')).toBeTruthy();
    expect(mockState.created).toHaveLength(0);
    await fireEvent.press(screen.getByLabelText('Plus 50 dirhams')); // sans prix : 300
    await fireEvent.press(screen.getByLabelText('Plus 50 dirhams')); // 350
    await fireEvent.changeText(screen.getByLabelText('Kilométrage actuel'), '45000');
    expect(screen.getByDisplayValue('45 000')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    await waitFor(() => expect(mockState.created).toHaveLength(1));
    expect(mockState.created[0]).toMatchObject({ immatriculation: '68013 | ب | 72', marque: 'Dacia', modele: 'Sandero', carburant: 'diesel', prixJour: 350, kilometrage: 45000, statut: 'disponible' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/flotte/nouveau/succes');
    expect(getCreatedVehicle()?.missing).toEqual(['photo', 'assurance', 'visite_technique']); // le kilométrage a été saisi
  });

  it('« Louable tout de suite » désactivé : le véhicule est créé En préparation', async () => {
    mockState.draft = scanDraft;
    await render(<FinaliserVehiculeScreen />);
    expect(screen.getByText('Il apparaîtra comme Disponible')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Louable tout de suite'));
    expect(screen.getByText('Il sera mis En préparation')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Prix par jour en dirhams'), '400');
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    await waitFor(() => expect(mockState.created).toHaveLength(1));
    expect(mockState.created[0]).toMatchObject({ statut: 'en_preparation', prixJour: 400 });
  });

  it('carte grise lue : résumé du véhicule, pas de saisie de la plaque ni du carburant, catégorie pré-choisie d’après le modèle', async () => {
    mockState.draft = scanDraft;
    await render(<FinaliserVehiculeScreen />);
    expect(screen.getByText('Dacia Sandero Stepway')).toBeTruthy();
    expect(screen.getByText('Lu sur la carte grise')).toBeTruthy();
    expect(screen.queryByText('Quel véhicule ?')).toBeNull();
    expect(screen.queryByText('Carburant')).toBeNull();
    expect(screen.getByLabelText('SUV').props.accessibilityState).toMatchObject({ selected: true }); // « Stepway » → SUV
    await fireEvent.press(screen.getByText('Modifier'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/flotte/nouveau/carte-lue');
  });

  it('prix habituel de la catégorie (médiane) avec « Appliquer » ; masqué sans autre véhicule de la catégorie', async () => {
    mockState.draft = scanDraft;
    mockState.vehicles = [{ ...base, id: 'x1', marque: 'Dacia', modele: 'Duster', immatriculation: '1 | ب | 1', categorie: 'suv', prixJour: 350, statut: 'disponible' }, { ...base, id: 'x2', marque: 'Kia', modele: 'Sportage', immatriculation: '2 | ب | 1', categorie: 'suv', prixJour: 450, statut: 'disponible' }];
    await render(<FinaliserVehiculeScreen />);
    expect(screen.getByText('Vos autres SUV : 400 MAD/j (prix habituel)')).toBeTruthy();
    await fireEvent.press(screen.getByText('Appliquer'));
    expect(screen.getByDisplayValue('400')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Berline')); // catégorie sans autre véhicule : plus de suggestion
    expect(screen.queryByText(/prix habituel/)).toBeNull();
  });

  it('employé : aucune carte Prix ni suggestion, avancement sur 2, véhicule créé à 0 MAD', async () => {
    mockState.role = 'employee';
    mockState.draft = scanDraft;
    mockState.vehicles = [{ ...base, id: 'x1', marque: 'Dacia', modele: 'Duster', immatriculation: '1 | ب | 1', categorie: 'suv', prixJour: 350, statut: 'disponible' }];
    await render(<FinaliserVehiculeScreen />);
    expect(screen.queryByText('Prix par jour')).toBeNull();
    expect(screen.queryByText(/MAD/)).toBeNull();
    expect(screen.queryByText('Propriétaire uniquement')).toBeNull();
    expect(screen.getByLabelText('0 sur 2 informations essentielles remplies')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    await waitFor(() => expect(mockState.created).toHaveLength(1));
    expect(mockState.created[0]).toMatchObject({ prixJour: 0 });
    expect(getCreatedVehicle()?.missing).toContain('price'); // le propriétaire le complétera
  });

  it('photo de face : l’avancement monte ; la photo est envoyée en premier avec les autres', async () => {
    mockState.draft = scanDraft;
    await render(<FinaliserVehiculeScreen />);
    await fireEvent.press(screen.getByLabelText('Prendre la photo'));
    await waitFor(() => expect(screen.getByLabelText('1 sur 3 informations essentielles remplies')).toBeTruthy());
    await fireEvent.press(screen.getByText('+ Autres photos'));
    await waitFor(() => expect(screen.getByText('+ Autres photos (1)')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Prix par jour en dirhams'), '400');
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    await waitFor(() => expect(mockState.photos).toHaveLength(2));
    expect(mockState.photos[0]).toMatchObject({ path: 'file:///face.jpg' });
  });

  it('échéances : la date est enregistrée sans fichier (chemin vide) et alimente les rappels ; une date impossible bloque', async () => {
    mockState.draft = scanDraft;
    await render(<FinaliserVehiculeScreen />);
    expect(screen.getAllByText('Rappel 30 jours avant')).toHaveLength(2); // on dit la vérité : les alertes préviennent 30 jours avant
    await fireEvent.changeText(screen.getByLabelText('Prix par jour en dirhams'), '400');
    await fireEvent.changeText(screen.getByLabelText('Assurance · Date de fin'), '31022031');
    expect(screen.getByText('Date impossible (JJ/MM/AAAA).')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    expect(mockState.created).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('Assurance · Date de fin'), '15062031');
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    await waitFor(() => expect(mockState.documents).toHaveLength(1));
    expect(mockState.documents[0]).toMatchObject({ type: 'assurance', path: '', expiresAt: '2031-06-15' });
  });

  describe('papier d’échéance à la création (facultatif)', () => {
    const paper = (extra: Record<string, unknown> = {}) => ({ ok: true, fields: { validFrom: '2030-06-16', validUntil: '2031-06-15', reference: 'POL-1', provider: 'RMA', amount: 1500, plate: '68013-ب-72', favorable: null, ...extra } });
    async function takePaper(label = 'Assurance') {
      mockState.draft = scanDraft;
      await render(<FinaliserVehiculeScreen />);
      await fireEvent.changeText(screen.getByLabelText('Prix par jour en dirhams'), '400');
      await fireEvent.press(screen.getByLabelText(`Photographier le papier (facultatif) : ${label}`));
      await fireEvent.press(screen.getByLabelText('CAPTURE-PAPIER'));
    }

    it('sans papier : rien ne change (date seule, sans fichier) — le papier est facultatif', async () => {
      mockState.draft = scanDraft;
      await render(<FinaliserVehiculeScreen />);
      await fireEvent.changeText(screen.getByLabelText('Prix par jour en dirhams'), '400');
      await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
      await waitFor(() => expect(mockState.created).toHaveLength(1));
      expect(mockState.uploaded.filter((args) => (args as unknown[])[2] === 'assurance')).toHaveLength(0);
    });
    it('papier photographié, fonction inactive : enregistré avec le véhicule, aucune lecture', async () => {
      await takePaper();
      expect(mockState.scanCalls).toHaveLength(0);
      await fireEvent.changeText(screen.getByLabelText('Assurance · Date de fin'), '15062031');
      await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
      await waitFor(() => expect(mockState.documents.length).toBeGreaterThan(0));
      expect(mockState.uploaded).toContainEqual(['a1', 'new1', 'assurance', 'file:///papier.jpg', '2031-06-15']);
      expect(mockState.documents).toContainEqual(expect.objectContaining({ type: 'assurance', path: 'p', expiresAt: '2031-06-15' }));
      expect(mockState.documents.filter((doc) => doc.type === 'assurance')).toHaveLength(1); // pas de doublon avec la date seule
    });
    it('papier sans date : le fichier est enregistré, la date reste à saisir plus tard', async () => {
      await takePaper();
      await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
      await waitFor(() => expect(mockState.uploaded.length).toBeGreaterThan(0));
      expect(mockState.uploaded).toContainEqual(['a1', 'new1', 'assurance', 'file:///papier.jpg', null]);
    });
    it('fonction active : la date lue est PROPOSÉE, jamais appliquée seule', async () => {
      mockState.ocrAvailability = 'active';
      mockState.scanResult = paper();
      await takePaper();
      expect(mockState.scanCalls).toEqual([{ kind: 'assurance', uri: 'file:///papier.jpg' }]);
      expect(await screen.findByLabelText('Utiliser la date de fin du papier : 15/06/2031')).toBeTruthy();
      expect(screen.getByLabelText('Assurance · Date de fin').props.value).toBe('');
      await fireEvent.press(screen.getByLabelText('Utiliser la date de fin du papier : 15/06/2031'));
      expect(screen.getByLabelText('Assurance · Date de fin').props.value).toBe('15/06/2031');
      expect(screen.getByText('Date du papier utilisée.')).toBeTruthy();
    });
    it('papier d’un autre véhicule : date non proposée, saisie manuelle', async () => {
      mockState.ocrAvailability = 'active';
      mockState.scanResult = paper({ plate: '1234 | A | 5' });
      await takePaper();
      expect(await screen.findByText(/plaque lue sur ce papier semble différente/)).toBeTruthy();
      expect(screen.queryByLabelText(/^Utiliser la date de fin du papier/)).toBeNull();
    });
    it('visite défavorable ou papier déjà périmé : date non proposée', async () => {
      mockState.ocrAvailability = 'active';
      mockState.scanResult = paper({ validFrom: '2020-01-01', validUntil: '2020-12-31' });
      await takePaper('Visite technique');
      expect(await screen.findByText(/déjà périmé/)).toBeTruthy();
      expect(screen.queryByLabelText(/^Utiliser la date de fin du papier/)).toBeNull();
    });
    it('lecture en échec : message, saisie manuelle, ajout du véhicule toujours possible', async () => {
      mockState.ocrAvailability = 'active';
      mockState.scanResult = { ok: false, error: 'ocr_busy' };
      await takePaper();
      expect(await screen.findByText(/Saisissez la date vous-même/)).toBeTruthy();
      await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
      await waitFor(() => expect(mockState.created).toHaveLength(1));
    });
    it('papier retiré : plus rien n’est envoyé', async () => {
      await takePaper();
      await fireEvent.press(screen.getByLabelText('Retirer le papier : Assurance'));
      await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
      await waitFor(() => expect(mockState.created).toHaveLength(1));
      expect(mockState.uploaded.filter((args) => (args as unknown[])[2] === 'assurance')).toHaveLength(0);
    });
  });

  it('doublon (plaque déjà dans la flotte, archivés compris) : ajout bloqué', async () => {
    mockState.draft = scanDraft;
    mockState.vehicles = [{ ...base, id: 'dup', marque: 'Dacia', modele: 'Logan', immatriculation: '68013-ب-72', categorie: 'berline', prixJour: 300, statut: 'disponible', archivedAt: '2030-01-01T00:00:00Z' }];
    await render(<FinaliserVehiculeScreen />);
    await fireEvent.changeText(screen.getByLabelText('Prix par jour en dirhams'), '400');
    expect(screen.getByText('Ce véhicule est déjà dans votre flotte.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    expect(mockState.created).toHaveLength(0);
  });

  it('véhicule d’une autre filiale (invisible pour l’employé) : ajout bloqué avec le nom de la filiale', async () => {
    mockState.role = 'employee';
    mockState.draft = scanDraft;
    mockState.remote = { found: true, branchName: 'Rabat' };
    await render(<FinaliserVehiculeScreen />);
    expect(screen.getAllByText('Ce véhicule existe déjà dans la filiale Rabat.').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    expect(mockState.created).toHaveLength(0);
  });

  it('saisie à la main : la plaque tapée est contrôlée comme pour le scan', async () => {
    mockState.remote = { found: true, branchName: null };
    await render(<FinaliserVehiculeScreen />);
    await fillManualIdentity();
    expect(screen.getAllByText('Ce véhicule existe déjà dans votre agence.').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText('Diesel'));
    await fireEvent.press(screen.getByLabelText('Plus 50 dirhams'));
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    expect(mockState.created).toHaveLength(0);
  });

  it('saisie à la main : le VIN (facultatif) est saisi, normalisé et ENREGISTRÉ avec le véhicule', async () => {
    await render(<FinaliserVehiculeScreen />);
    await fillManualIdentity();
    await fireEvent.press(screen.getByText('Diesel'));
    await fireEvent.press(screen.getByLabelText('Plus 50 dirhams'));
    await fireEvent.changeText(screen.getByLabelText('N° de série (VIN)'), 'uu1-hsdagc56789012');
    expect(screen.getByDisplayValue('UU1HSDAGC56789012')).toBeTruthy(); // majuscules, sans tiret
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    await waitFor(() => expect(mockState.created).toHaveLength(1));
    expect(mockState.created[0]).toMatchObject({ vin: 'UU1HSDAGC56789012' });
  });

  it('sans VIN : le véhicule est créé sans (facultatif) ; un VIN invalide bloque avec la raison', async () => {
    await render(<FinaliserVehiculeScreen />);
    await fillManualIdentity();
    await fireEvent.press(screen.getByText('Diesel'));
    await fireEvent.press(screen.getByLabelText('Plus 50 dirhams'));
    await fireEvent.changeText(screen.getByLabelText('N° de série (VIN)'), 'UU1HSDAGC5678901');
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    expect(screen.getAllByText(/Un VIN a 17 caractères/).length).toBeGreaterThan(0);
    expect(mockState.created).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('N° de série (VIN)'), '');
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    await waitFor(() => expect(mockState.created).toHaveLength(1));
    expect(mockState.created[0].vin).toBeNull();
  });

  it('saisie à la main : un VIN déjà dans la flotte (autre plaque) est détecté comme doublon', async () => {
    mockState.vehicles = [{ ...base, id: 'dup', marque: 'Kia', modele: 'Picanto', immatriculation: '1 | د | 1', categorie: 'compacte', prixJour: 280, statut: 'disponible', vin: 'UU1HSDAGC56789012' }];
    await render(<FinaliserVehiculeScreen />);
    await fillManualIdentity();
    await fireEvent.changeText(screen.getByLabelText('N° de série (VIN)'), 'UU1HSDAGC56789012');
    expect(screen.getByText('Ce véhicule est déjà dans votre flotte.')).toBeTruthy();
  });

  it('carte grise sans VIN lu : le champ est proposé', async () => {
    mockState.draft = { ...scanDraft, vin: undefined };
    await render(<FinaliserVehiculeScreen />);
    expect(screen.getByLabelText('N° de série (VIN)')).toBeTruthy();
  });

  it('carte grise avec VIN lu : pas de second champ', async () => {
    mockState.draft = scanDraft;
    await render(<FinaliserVehiculeScreen />);
    expect(screen.queryByLabelText('N° de série (VIN)')).toBeNull();
  });

  it('carte grise : le VIN lu est enregistré', async () => {
    mockState.draft = scanDraft;
    await render(<FinaliserVehiculeScreen />);
    await fireEvent.changeText(screen.getByLabelText('Prix par jour en dirhams'), '400');
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    await waitFor(() => expect(mockState.created).toHaveLength(1));
    expect(mockState.created[0]).toMatchObject({ vin: 'UU1HSDAGC56789012' });
  });

  it('hors connexion : message clair, les saisies restent, rien n’est envoyé', async () => {
    mockState.connected = false;
    mockState.draft = scanDraft;
    await render(<FinaliserVehiculeScreen />);
    await fireEvent.changeText(screen.getByLabelText('Prix par jour en dirhams'), '400');
    expect(screen.getByText(/Pas de connexion/)).toBeTruthy();
    expect(screen.getByDisplayValue('400')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ajouter à ma flotte'));
    expect(mockState.created).toHaveLength(0);
  });

  it('plaque venue de l’outil Vérifier : conservée dans la saisie à la main', async () => {
    mockState.draft = { immatriculation: '8921 | ب | 14' };
    await render(<FinaliserVehiculeScreen />);
    expect(screen.getByDisplayValue('8921')).toBeTruthy();
    expect(screen.getByDisplayValue('14')).toBeTruthy();
  });
});
