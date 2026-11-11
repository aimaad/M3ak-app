/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking, Share } from 'react-native';

import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';

const mockLookup = (dict: unknown, key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as string;
const mockTranslate = (language: string, key: string, options?: Record<string, unknown>) => (mockLookup(language === 'ar' ? ar : fr, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));

const NOW = new Date();
const at = (delta: number, hour = 9) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + delta, hour).toISOString();
const mockState = {
  language: 'fr',
  role: 'owner' as 'owner' | 'manager' | 'employee',
  vehicle: null as Record<string, unknown> | null,
  rentals: [] as unknown[],
  maintenance: [] as unknown[],
  statusCalls: [] as unknown[],
  archived: [] as string[],
  reactivated: [] as string[],
};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
const base = { id: 'v1', agencyId: 'a1', branchId: null, marque: 'DACIA', modele: 'LOGAN', immatriculation: '8921 | ب | 14', vin: null, categorie: 'economique', carburant: 'diesel', annee: 2021, kilometrage: 40000, prixJour: 500, prixSemaine: null, prixMois: null, finition: null, niveauCarburant: null, description: null, photoUrl: null, photos: [], documents: [], archivedAt: null, createdAt: at(-100), updatedAt: at(-1), transmission: null, couleur: 'Blanc', nombrePlaces: 5 };
const rentalRow = (extra: Record<string, unknown>) => ({ id: 'r1', vehicleId: 'v1', customerId: 'c1', statut: 'en_cours', dateDebutPrevue: at(-1), dateFinPrevue: at(5, 18), dateDepartReel: at(-1), dateRetourReel: null, dureeJours: 6, ...extra });

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ id: 'v1' }),
}));
jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: mockState.role } }) }));
jest.mock('@/features/customers/hooks', () => ({ useCustomers: () => ({ data: [{ id: 'c1', nomComplet: 'FOUAD BENNANI', telephone: '+212 6 11 22 33 44' }] }) }));
jest.mock('@/features/rentals/hooks', () => ({ useVehicleRentals: () => ({ data: mockState.rentals, refetch: jest.fn() }) }));
jest.mock('@/features/maintenance/hooks', () => ({ useVehicleMaintenanceItems: () => ({ data: mockState.maintenance, refetch: jest.fn() }) }));
jest.mock('@/features/vehicles/hooks', () => ({
  useVehicle: () => ({ data: mockState.vehicle, isLoading: false, isError: false, refetch: jest.fn() }),
  useUpdateVehiclePhotos: () => ({ mutateAsync: jest.fn() }),
  useUpdateVehicleStatus: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.statusCalls.push(args); options?.onSuccess?.(); } }),
  useArchiveVehicle: () => ({ mutate: (id: string) => mockState.archived.push(id) }),
  useReactivateVehicle: () => ({ mutate: (id: string) => mockState.reactivated.push(id), mutateAsync: jest.fn() }),
}));
jest.mock('@/components/undo-toast', () => ({ useUndo: () => ({ showUndo: jest.fn() }) }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/features/vehicles/api', () => ({ VEHICLE_PHOTOS_BUCKET: 'vehicle-photos', VEHICLE_DOCUMENTS_BUCKET: 'vehicle-documents', deleteVehiclePhotoFile: jest.fn() }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: mockState.language, t: (key: string, o?: Record<string, unknown>) => mockTranslate(mockState.language, key, o) }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import VehicleDetailScreen from '../../../app/(tabs)/flotte/[id]/index';

const hidden = { includeHiddenElements: true };
const stripMarks = (text: unknown) => String(text).replace(/[‎‏]/g, '');

describe('fiche véhicule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockState, { language: 'fr', role: 'owner', vehicle: { ...base, statut: 'disponible' }, rentals: [], maintenance: [], statusCalls: [], archived: [], reactivated: [] });
  });

  it('défauts corrigés : nom normalisé (« Dacia Logan »), plaque dans l’ordre numéro | lettre | région, image par défaut', async () => {
    await render(<VehicleDetailScreen />);
    expect(screen.getByText('Dacia Logan')).toBeTruthy();
    expect(screen.queryByText('DACIA LOGAN')).toBeNull();
    expect(mockState.vehicle?.marque).toBe('DACIA'); // la donnée n'est pas modifiée
    expect(stripMarks(screen.getByText('8921').props.children)).toBe('8921');
    expect(screen.getByLabelText('Aucune photo pour la Dacia Logan')).toBeTruthy();
    expect(screen.getByText('Économique · Diesel · 2021')).toBeTruthy();
  });

  it('plaque en arabe : l’ordre numéro | lettre | région ne change pas', async () => {
    mockState.language = 'ar';
    await render(<VehicleDetailScreen />);
    const plate = screen.getByLabelText('8921 ب 14', hidden);
    const texts = (node: unknown): string[] => {
      if (typeof node === 'string' || typeof node === 'number') return [stripMarks(node)];
      if (Array.isArray(node)) return node.flatMap(texts);
      if (node && typeof node === 'object' && 'props' in node) return texts((node as { props: { children?: unknown } }).props.children);
      return [];
    };
    expect(texts(plate.props.children).filter((part) => part.trim())).toEqual(['8921', 'ب', '14']);
  });

  it('disponible : « Libre toute la semaine », Louer (orange) et Rendre indisponible', async () => {
    await render(<VehicleDetailScreen />);
    expect(screen.getByText('Libre toute la semaine')).toBeTruthy();
    expect(screen.getAllByText('Disponible', hidden).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('Louer : Dacia Logan'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/locations/nouveau', params: { vehicleId: 'v1', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } });
    expect(screen.getByLabelText('Rendre indisponible : Dacia Logan')).toBeTruthy();
  });

  it('« Rendre indisponible » : confirmation avec un motif facultatif, puis le statut change avec le motif', async () => {
    await render(<VehicleDetailScreen />);
    await fireEvent.press(screen.getByLabelText('Rendre indisponible : Dacia Logan'));
    expect(await screen.findByText('Motif (facultatif)', hidden)).toBeTruthy();
    expect(mockState.statusCalls).toHaveLength(0); // rien n'est fait avant la confirmation
    await fireEvent.changeText(screen.getByLabelText('Motif (facultatif)'), '  Pare-brise cassé ');
    await fireEvent.press(screen.getAllByText('Rendre indisponible', hidden).at(-1) as never);
    await waitFor(() => expect(mockState.statusCalls).toEqual([{ id: 'v1', statut: 'indisponible', motif: 'Pare-brise cassé' }]));
  });

  it('indisponible : le motif s’affiche et « Rendre disponible » remet le statut', async () => {
    mockState.vehicle = { ...base, statut: 'indisponible', statutMotif: 'Pare-brise cassé' };
    await render(<VehicleDetailScreen />);
    expect(screen.getByText('Pare-brise cassé')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Rendre disponible : Dacia Logan'));
    expect(mockState.statusCalls).toEqual([{ id: 'v1', statut: 'disponible', motif: undefined }]);
  });

  it('en location : propriétaire = Prolonger puis Appeler ; employé = « Prolonger » absent, Appeler seul', async () => {
    mockState.vehicle = { ...base, statut: 'en_location' };
    mockState.rentals = [rentalRow({})];
    await render(<VehicleDetailScreen />);
    expect(screen.getByText(/^Chez Fouad B\. · retour /)).toBeTruthy();
    expect(screen.getByLabelText('Prolonger : Dacia Logan')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Prolonger : Dacia Logan'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/locations/[id]', params: { id: 'r1', prolonger: '1' } });
  });

  it('en location, employé : pas de « Prolonger »', async () => {
    mockState.role = 'employee';
    mockState.vehicle = { ...base, statut: 'en_location' };
    mockState.rentals = [rentalRow({})];
    await render(<VehicleDetailScreen />);
    expect(screen.queryByLabelText(/Prolonger/)).toBeNull();
    expect(screen.getByLabelText('Appeler Fouad B. : Dacia Logan')).toBeTruthy();
  });

  it('en retard : badge « En retard +N », carte rouge, « Appeler » compose le numéro du client', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    mockState.vehicle = { ...base, statut: 'en_location' };
    mockState.rentals = [rentalRow({ dateDebutPrevue: at(-9), dateDepartReel: at(-9), dateFinPrevue: at(-3, 18), dureeJours: 6 })];
    await render(<VehicleDetailScreen />);
    expect(screen.getByText(/^En retard \+\d/)).toBeTruthy();
    expect(screen.getByText(/^Fouad B\. devait la rendre /)).toBeTruthy();
    expect(screen.getByText(/jours de retard · location non prolongée/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Appeler Fouad B. : Dacia Logan'));
    expect(openURL).toHaveBeenCalledWith('tel:+212611223344');
    expect(screen.getByLabelText('Prolonger : Dacia Logan')).toBeTruthy(); // le propriétaire garde « Prolonger »
  });

  it('à inspecter : « Démarrer l’inspection » mène à l’inspection de retour de la dernière location', async () => {
    mockState.vehicle = { ...base, statut: 'a_inspecter' };
    mockState.rentals = [rentalRow({ id: 'old', statut: 'terminee', dateDebutPrevue: at(-8), dateFinPrevue: at(-3), dateDepartReel: at(-8), dateRetourReel: at(-2) })];
    await render(<VehicleDetailScreen />);
    expect(screen.getByText(/^Rendue .* par Fouad B\.$/)).toBeTruthy();
    expect(screen.getByText(/En attente d'inspection depuis 2 jours/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Démarrer l'inspection : Dacia Logan"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/locations/[id]/inspection-retour', params: { id: 'old' } });
    expect(screen.queryByText('Signaler un dommage')).toBeNull(); // aucun écran existant : bouton non affiché
  });

  it('Partager : nom, plaque et prix pour le propriétaire ; aucun montant pour l’employé', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await render(<VehicleDetailScreen />);
    await fireEvent.press(screen.getByLabelText('Partager la fiche'));
    expect(share).toHaveBeenLastCalledWith({ message: 'Dacia Logan\n8921 | ب | 14\n500 MAD/jour' });
    mockState.role = 'employee';
    await render(<VehicleDetailScreen />);
    await fireEvent.press(screen.getAllByLabelText('Partager la fiche').at(-1) as never);
    expect(share).toHaveBeenLastCalledWith({ message: 'Dacia Logan\n8921 | ب | 14' });
  });

  it('tarification : visible du propriétaire seulement', async () => {
    await render(<VehicleDetailScreen />);
    expect(screen.getByText('Tarification', hidden)).toBeTruthy();
  });

  it('tarification masquée pour l’employé', async () => {
    mockState.role = 'employee';
    await render(<VehicleDetailScreen />);
    expect(screen.queryByText('Tarification', hidden)).toBeNull();
    expect(screen.queryAllByText(/MAD/, hidden)).toHaveLength(0);
  });

  it('« … » : Modifier ouvre le formulaire ; Archiver pour le propriétaire et le responsable seulement', async () => {
    await render(<VehicleDetailScreen />);
    await fireEvent.press(screen.getByLabelText("Plus d'actions : modifier, archiver"));
    expect((await screen.findAllByText('Archiver ce véhicule', hidden)).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText('Modifier', hidden));
    expect(mockRouter.push).toHaveBeenCalledWith('/flotte/v1/modifier');
  });

  it('« … » pour l’employé : pas d’« Archiver »', async () => {
    mockState.role = 'employee';
    await render(<VehicleDetailScreen />);
    await fireEvent.press(screen.getByLabelText("Plus d'actions : modifier, archiver"));
    expect(await screen.findByText('Modifier', hidden)).toBeTruthy();
    expect(screen.queryByText('Archiver ce véhicule', hidden)).toBeNull();
  });

  it('archivé : bandeau « Archivé » et « Restaurer » pour le propriétaire seulement', async () => {
    mockState.vehicle = { ...base, statut: 'disponible', archivedAt: at(-3) };
    await render(<VehicleDetailScreen />);
    expect(screen.getByText(/Ce véhicule est archivé/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Restaurer'));
    expect(mockState.reactivated).toEqual(['v1']);
  });

  it('archivé, responsable : pas de « Restaurer »', async () => {
    mockState.role = 'manager';
    mockState.vehicle = { ...base, statut: 'disponible', archivedAt: at(-3) };
    await render(<VehicleDetailScreen />);
    expect(screen.queryByText('Restaurer')).toBeNull();
  });
});
