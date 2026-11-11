/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';

const mockLookup = (dict: unknown, key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as string;
const mockTranslate = (language: string, key: string, options?: Record<string, unknown>) => (mockLookup(language === 'ar' ? ar : fr, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));

type MockPhoto = { path: string; uploadedAt: string; angle?: string };
const photo = (path: string, angle?: string): MockPhoto => ({ path, uploadedAt: '2026-11-01T10:00:00Z', ...(angle ? { angle } : {}) });
const mockState = {
  language: 'fr',
  role: 'owner' as 'owner' | 'manager' | 'employee',
  photos: [] as MockPhoto[],
  saved: [] as MockPhoto[][],
  deletedFiles: [] as string[],
  uploadFails: false,
  pickedUri: 'file:///picked.jpg' as string | null,
};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ id: 'v1' }),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: async () => (mockState.pickedUri ? { canceled: false, assets: [{ uri: mockState.pickedUri }] } : { canceled: true }),
  launchImageLibraryAsync: async () => (mockState.pickedUri ? { canceled: false, assets: [{ uri: mockState.pickedUri }] } : { canceled: true }),
}));
jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: mockState.role } }) }));
jest.mock('@/features/vehicles/hooks', () => ({
  useVehicle: () => ({ data: { id: 'v1', agencyId: 'a1', marque: 'DACIA', modele: 'LOGAN', photos: mockState.photos }, isLoading: false, isError: false }),
  useUpdateVehiclePhotos: () => ({
    mutateAsync: async ({ photos }: { photos: MockPhoto[] }) => {
      mockState.saved.push(photos);
      mockState.photos = photos;
    },
  }),
}));
jest.mock('@/features/vehicles/api', () => ({
  VEHICLE_PHOTOS_BUCKET: 'vehicle-photos',
  deleteVehiclePhotoFile: async (path: string) => {
    mockState.deletedFiles.push(path);
  },
  uploadVehiclePhotoWithAngle: async (_a: string, _v: string, _uri: string, angle: string, onProgress: (n: number) => void) => {
    onProgress(0.5);
    if (mockState.uploadFails) throw new Error('offline');
    return { path: `a1/v1/new-${angle}.jpg`, uploadedAt: '2026-11-11T10:00:00Z', angle };
  },
}));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: mockState.language, t: (key: string, o?: Record<string, unknown>) => mockTranslate(mockState.language, key, o) }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import VehiclePhotosScreen from '../../../app/(tabs)/flotte/[id]/photos';

const hidden = { includeHiddenElements: true };
const six = () => [photo('p-avant', 'avant'), photo('p-arriere', 'arriere'), photo('p-int', 'interieur')];

describe('écran Photos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockState, { language: 'fr', role: 'owner', photos: [], saved: [], deletedFiles: [], uploadFails: false, pickedUri: 'file:///picked.jpg' });
  });

  it('sans photo : angle vide « Pas encore de photo », Prendre la photo / Galerie, pas de Remplacer ni Supprimer', async () => {
    await render(<VehiclePhotosScreen />);
    expect(screen.getByText('Aucune photo')).toBeTruthy();
    expect(screen.getByText('Pas encore de photo « Avant »')).toBeTruthy();
    expect(screen.getByLabelText('Prendre la photo')).toBeTruthy();
    expect(screen.getByLabelText('Galerie')).toBeTruthy();
    expect(screen.queryByLabelText('Supprimer')).toBeNull();
    expect(screen.queryByLabelText('Remplacer')).toBeNull();
  });

  it('6 emplacements dans l’ordre ; un angle sans photo se lit « à prendre », avec photo « principale » pour la première', async () => {
    mockState.photos = six();
    await render(<VehiclePhotosScreen />);
    expect(screen.getByLabelText('Avant, photo principale')).toBeTruthy();
    expect(screen.getByLabelText('Arrière, photo ajoutée')).toBeTruthy();
    expect(screen.getByLabelText('Côté gauche, à prendre')).toBeTruthy();
    expect(screen.getByText('3 photos · 3 sur 6 angles')).toBeTruthy();
  });

  it('photo principale : badge PRINCIPALE et bouton « Principale » désactivé', async () => {
    mockState.photos = six();
    await render(<VehiclePhotosScreen />);
    expect(screen.getByText('PRINCIPALE')).toBeTruthy();
    expect(screen.getByLabelText('Principale').props.accessibilityState.disabled).toBe(true);
  });

  it('« Mettre en principale » passe l’autre photo en tête', async () => {
    mockState.photos = six();
    await render(<VehiclePhotosScreen />);
    await fireEvent.press(screen.getByLabelText('Arrière, photo ajoutée'));
    expect(screen.queryByText('PRINCIPALE')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Mettre en principale'));
    await waitFor(() => expect(mockState.saved.at(-1)?.map((item) => item.path)).toEqual(['p-arriere', 'p-avant', 'p-int']));
  });

  it('supprimer la principale : confirmation, la suivante devient principale, le fichier est supprimé', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockState.photos = six();
    await render(<VehiclePhotosScreen />);
    await fireEvent.press(screen.getByLabelText('Supprimer'));
    expect(alert).toHaveBeenCalledWith('Supprimer cette photo ?', "C'est la photo principale : la suivante deviendra la principale.", expect.any(Array));
    expect(mockState.saved).toEqual([]); // rien avant la confirmation
    await (alert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[]).find((button) => button.text === 'Supprimer')?.onPress?.();
    expect(mockState.saved.at(-1)?.map((item) => item.path)).toEqual(['p-arriere', 'p-int']);
    expect(mockState.deletedFiles).toEqual(['p-avant']);
  });

  it('prendre la photo d’un angle vide : envoi, ajout à la fin avec son angle', async () => {
    mockState.photos = [photo('p-avant', 'avant')];
    await render(<VehiclePhotosScreen />);
    await fireEvent.press(screen.getByLabelText('Arrière, à prendre'));
    await fireEvent.press(screen.getByLabelText('Prendre la photo'));
    await waitFor(() => expect(mockState.saved.at(-1)).toEqual([photo('p-avant', 'avant'), { path: 'a1/v1/new-arriere.jpg', uploadedAt: '2026-11-11T10:00:00Z', angle: 'arriere' }]));
  });

  it('première photo envoyée : elle devient la principale (tête de liste)', async () => {
    await render(<VehiclePhotosScreen />);
    await fireEvent.press(screen.getByLabelText('Galerie'));
    await waitFor(() => expect(mockState.saved.at(-1)?.[0].angle).toBe('avant'));
  });

  it('échec de l’envoi : message et « Réessayer » ; rien n’est enregistré', async () => {
    mockState.uploadFails = true;
    await render(<VehiclePhotosScreen />);
    await fireEvent.press(screen.getByLabelText('Prendre la photo'));
    expect(await screen.findByText("L'envoi a échoué. Vérifiez la connexion puis réessayez.")).toBeTruthy();
    expect(mockState.saved).toEqual([]);
    mockState.uploadFails = false;
    await fireEvent.press(screen.getByLabelText('Réessayer'));
    await waitFor(() => expect(mockState.saved).toHaveLength(1));
  });

  it('12 photos : « Autre photo » refusé avec le message', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockState.photos = Array.from({ length: 12 }, (_, index) => photo(`o${index}`, 'autre'));
    await render(<VehiclePhotosScreen />);
    await fireEvent.press(screen.getByLabelText('Autre photo (dommage, détail…)'));
    expect(alert).toHaveBeenCalledWith('BIBIP', '12 photos au maximum : supprimez-en une pour en ajouter.');
    expect(mockState.saved).toEqual([]);
  });

  it('employé : peut ajouter, mais ni principale, ni remplacer, ni supprimer, ni déplacer', async () => {
    mockState.role = 'employee';
    mockState.photos = six();
    await render(<VehiclePhotosScreen />);
    expect(screen.getByText(/Vous pouvez ajouter des photos/)).toBeTruthy();
    expect(screen.queryByLabelText('Supprimer')).toBeNull();
    expect(screen.queryByLabelText('Remplacer')).toBeNull();
    expect(screen.queryByLabelText('Mettre en principale')).toBeNull();
    expect(screen.queryByText('Maintenir pour déplacer')).toBeNull();
    expect(screen.getByLabelText('Autre photo (dommage, détail…)')).toBeTruthy();
  });

  it('employé : peut prendre la photo d’un angle vide', async () => {
    mockState.role = 'employee';
    mockState.photos = six();
    await render(<VehiclePhotosScreen />);
    await fireEvent.press(screen.getByLabelText('Côté gauche, à prendre'));
    expect(screen.getByLabelText('Prendre la photo')).toBeTruthy();
  });

  it('appui long sur une photo (responsable) : menu avec Déplacer après', async () => {
    mockState.role = 'manager';
    mockState.photos = six();
    await render(<VehiclePhotosScreen />);
    await fireEvent(screen.getByLabelText('Avant, photo principale'), 'longPress');
    await fireEvent.press(await screen.findByText('Déplacer après', hidden));
    await waitFor(() => expect(mockState.saved.at(-1)?.map((item) => item.path)).toEqual(['p-arriere', 'p-avant', 'p-int']));
  });

  it('arabe : libellés d’angles et compteur en arabe', async () => {
    mockState.language = 'ar';
    mockState.photos = six();
    await render(<VehiclePhotosScreen />);
    expect(screen.getByLabelText('الأمام، الصورة الرئيسية')).toBeTruthy();
    expect(screen.getByText('3 صور · 3 من 6 زوايا')).toBeTruthy();
  });
});
