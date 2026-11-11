/* eslint-disable @typescript-eslint/no-require-imports, import/first -- les « jest.mock » doivent précéder les imports et utilisent require */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';

import fr from '@/i18n/locales/fr.json';

// ---- Traductions françaises réelles
const mockLookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));

// ---- Données simulées
const NOW = new Date();
const at = (delta: number, hour = 9) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + delta, hour).toISOString();
const base = { agencyId: 'a1', branchId: null, kilometrage: 1000, prixJour: 400, photos: [], documents: [], archivedAt: null, createdAt: at(-100), updatedAt: at(-100), categorie: 'economique' };
const mockState = {
  role: 'owner' as 'owner' | 'manager' | 'employee',
  late: false, // ajoute une Logan en retard (retour prévu il y a 3 jours) loué à FOUAD BENNANI
  lateVehicles: [{ ...base, id: 'retard', marque: 'Dacia', modele: 'Logan', immatriculation: '8921-ب-14', statut: 'en_location' }],
  lateRentals: [{ id: 'rl', vehicleId: 'retard', customerId: 'c2', statut: 'en_cours', dateDebutPrevue: at(-9), dateFinPrevue: at(-3, 18), dateDepartReel: at(-9), dateRetourReel: null }],
  vehicles: [
    { ...base, id: 'libre', marque: 'Dacia', modele: 'Troc', immatriculation: '8921-ب-14', statut: 'disponible' },
    { ...base, id: 'louee', marque: 'Dacia', modele: 'Sandero', immatriculation: '68013 | ب | 72', statut: 'en_location' },
    { ...base, id: 'inspecter', marque: 'Renault', modele: 'Symbol', immatriculation: '2290-و-14', statut: 'a_inspecter' },
    { ...base, id: 'garage', marque: 'Peugeot', modele: '301', immatriculation: '9012-ح-14', statut: 'maintenance' },
  ],
  rentals: [
    { id: 'r1', vehicleId: 'louee', customerId: 'c1', statut: 'en_cours', dateDebutPrevue: at(-1), dateFinPrevue: at(5, 18), dateDepartReel: at(-1), dateRetourReel: null },
    { id: 'r0', vehicleId: 'inspecter', customerId: 'c1', statut: 'terminee', dateDebutPrevue: at(-9), dateFinPrevue: at(-5), dateDepartReel: at(-9), dateRetourReel: at(-5) },
  ],
  maintenance: [] as unknown[],
  customers: [{ id: 'c1', nomComplet: 'Youssef Alami', telephone: null }, { id: 'c2', nomComplet: 'FOUAD BENNANI', telephone: '+212 6 11 22 33 44' }],
};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockQuery = (data: unknown) => ({ data, isLoading: false, isPending: false, isError: false, isFetching: false, refetch: jest.fn() });

jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => mockQuery({ agencyId: 'a1', role: mockState.role, agencyName: 'Atlas Location' }) }));
jest.mock('@/features/vehicles/hooks', () => ({ useVehicles: () => mockQuery(mockState.late ? [...mockState.vehicles, ...mockState.lateVehicles] : mockState.vehicles) }));
jest.mock('@/features/rentals/hooks', () => ({ useRentals: () => mockQuery(mockState.late ? [...mockState.rentals, ...mockState.lateRentals] : mockState.rentals) }));
jest.mock('@/features/maintenance/hooks', () => ({ useMaintenanceItems: () => mockQuery(mockState.maintenance) }));
jest.mock('@/features/customers/hooks', () => ({ useCustomers: () => mockQuery(mockState.customers) }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/features/vehicles/api', () => ({ VEHICLE_PHOTOS_BUCKET: 'vehicle-photos' }));
jest.mock('@/hooks/use-tab-bar-inset', () => ({ useTabBarInset: () => 0 }));
jest.mock('@/hooks/use-desktop-layout', () => ({ useDesktopLayout: () => false }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  Redirect: () => null,
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string, o?: Record<string, unknown>) => mockTranslate(key, o) }) }));
const mockStorage = { view: null as string | null, saved: [] as string[][] };
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => (key.includes('.view.') ? mockStorage.view : null)),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.saved.push([key, value]);
  }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View, createAnimatedComponent: (component: unknown) => component }, useSharedValue: (value: number) => ({ value }), useAnimatedProps: () => ({}), useReducedMotion: () => true, withTiming: (value: number) => value, Easing: { out: () => undefined, cubic: undefined } };
});

import FlotteScreen from '../../../app/(tabs)/flotte/index';

const hidden = { includeHiddenElements: true };
const labelOf = (section: string) => mockTranslate(`flotte.card.sections.${section}`).toLocaleUpperCase();

describe('écran Ma Flotte (données simulées)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.role = 'owner';
    mockState.late = false;
    mockStorage.view = null;
    mockStorage.saved = [];
  });

  it('liste groupée : À inspecter, Entretien, En location, Disponibles (sections vides masquées)', async () => {
    await render(<FlotteScreen />);
    // La liste est virtualisée : on vérifie les sections présentes (les libellés « En location » et « Disponibles » existent aussi sur les tuiles).
    expect(screen.getAllByText(labelOf('inspect'), hidden)).toHaveLength(1);
    expect(screen.getAllByText(labelOf('maintenance'), hidden)).toHaveLength(1);
    expect(screen.getAllByText(labelOf('rented'), hidden).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(labelOf('free'), hidden).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(labelOf('unavailable'), hidden)).toBeNull(); // aucune section « Indisponibles »
  });

  it('en-tête : 4 véhicules, 1 prêt à partir, tuiles 1 / 1 / 2', async () => {
    await render(<FlotteScreen />);
    expect(screen.getByLabelText('Disponibles : 1')).toBeTruthy();
    expect(screen.getByLabelText('En location : 1')).toBeTruthy();
    expect(screen.getByLabelText('Immobilisés : 2')).toBeTruthy();
    expect(screen.getByText('1 prêt à partir maintenant')).toBeTruthy();
  });

  it('une tuile filtre la liste ; un second tap sur la même tuile revient à « Tous »', async () => {
    await render(<FlotteScreen />);
    const tile = screen.getByLabelText('Disponibles : 1');
    await fireEvent.press(tile);
    expect(screen.getByLabelText('Disponibles : 1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText(/^Dacia Troc, /)).toBeTruthy();
    expect(screen.queryByLabelText(/^Dacia Sandero, /)).toBeNull();
    expect(screen.queryByLabelText(/^Renault Symbol, /)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Disponibles : 1'));
    expect(screen.getByLabelText('Disponibles : 1').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByLabelText(/^Dacia Sandero, /)).toBeTruthy();
    expect(screen.getByLabelText(/^Renault Symbol, /)).toBeTruthy();
  });

  it('le propriétaire voit le conseil BIBIP et le prix ; « Louer » ouvre la nouvelle location préremplie', async () => {
    await render(<FlotteScreen />);
    expect(await screen.findByText('CONSEIL BIBIP', hidden)).toBeTruthy();
    expect(screen.queryAllByText(/MAD\/j/, hidden).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('Disponibles : 1')); // liste virtualisée : on affiche d'abord les disponibles
    await fireEvent.press(screen.getByLabelText('Louer : Dacia Troc'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/locations/nouveau', params: { vehicleId: 'libre', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } });
  });

  it('« Plus tard » masque le conseil', async () => {
    await render(<FlotteScreen />);
    await screen.findByText('CONSEIL BIBIP', hidden);
    await fireEvent.press(screen.getByText('Plus tard'));
    expect(screen.queryByText('CONSEIL BIBIP', hidden)).toBeTruthy(); // le suivant (inspection) prend la place
    await fireEvent.press(screen.getByText('Plus tard'));
    expect(screen.queryByText('CONSEIL BIBIP', hidden)).toBeNull();
  });

  it('l’employé ne voit ni conseil BIBIP, ni prix, ni « Prolonger »', async () => {
    mockState.role = 'employee';
    await render(<FlotteScreen />);
    expect(screen.queryByText('CONSEIL BIBIP', hidden)).toBeNull();
    expect(screen.queryAllByText(/MAD\/j/, hidden)).toHaveLength(0);
    expect(screen.queryByLabelText(/Prolonger/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Disponibles : 1'));
    expect(screen.getByLabelText('Louer : Dacia Troc')).toBeTruthy(); // « Louer » reste ouvert au comptoir
  });

  it('« Prolonger » : propriétaire et responsable, vers la prolongation de la location en cours', async () => {
    mockState.role = 'manager';
    await render(<FlotteScreen />);
    await fireEvent.press(screen.getByLabelText('Prolonger : Dacia Sandero'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/locations/[id]', params: { id: 'r1', prolonger: '1' } });
  });

  it('la feuille « Filtres et tri » filtre par carburant/catégorie et se réinitialise', async () => {
    await render(<FlotteScreen />);
    await fireEvent.press(screen.getByLabelText(/^Filtres et tri : /));
    expect(screen.getByText('CATÉGORIE', hidden)).toBeTruthy();
    expect(screen.getByText('MARQUE', hidden)).toBeTruthy();
    await fireEvent.press(screen.getByText('Renault', hidden));
    expect(screen.getByText('Afficher 1 véhicule', hidden)).toBeTruthy();
    await fireEvent.press(screen.getByText('Réinitialiser', hidden));
    expect(screen.getByText('Afficher 4 véhicules', hidden)).toBeTruthy();
  });

  it('le tri par prix n’est proposé qu’au propriétaire', async () => {
    mockState.role = 'employee';
    await render(<FlotteScreen />);
    await fireEvent.press(screen.getByLabelText(/^Filtres et tri : /));
    expect(screen.queryByText('Prix', hidden)).toBeNull();
    expect(screen.getByText('Kilométrage', hidden)).toBeTruthy();
  });

  it('galerie : choix mémorisé, cartes avec statut, prix propriétaire seulement', async () => {
    mockStorage.view = 'gallery';
    await render(<FlotteScreen />);
    expect(await screen.findByLabelText(/^Dacia Troc, Disponible, immatriculation /, hidden)).toBeTruthy();
    expect(screen.getByLabelText('Afficher en liste')).toBeTruthy();
    expect(screen.queryAllByText(/\/j/, hidden).length).toBeGreaterThan(0);
  });

  it('galerie : l’employé ne voit aucun prix ; le bouton liste mémorise le choix', async () => {
    mockStorage.view = 'gallery';
    mockState.role = 'employee';
    await render(<FlotteScreen />);
    await screen.findByLabelText(/^Dacia Troc, /, hidden);
    expect(screen.queryAllByText(/\/j/, hidden)).toHaveLength(0);
    await fireEvent.press(screen.getByLabelText('Afficher en liste'));
    expect(mockStorage.saved).toContainEqual(['bibip.flotte.view.v1', 'list']);
    expect(screen.queryByLabelText('Afficher en liste')).toBeNull();
  });

  describe('retour en retard', () => {
    const openURL = jest.spyOn(Linking, 'openURL');
    beforeEach(() => {
      openURL.mockReset();
      openURL.mockResolvedValue(undefined);
      mockState.late = true;
    });

    it('en-tête : ligne « 1 retour en retard » (tous les rôles), pastille sur la tuile En location, section « · 1 en retard »', async () => {
      mockState.role = 'employee';
      await render(<FlotteScreen />);
      expect(screen.getByText('1 retour en retard')).toBeTruthy();
      expect(screen.getByText('1\u00a0en\u00a0retard', hidden)).toBeTruthy();
      expect(screen.getByLabelText('En location : 2, dont 1 en retard')).toBeTruthy(); // la tuile compte toutes les locations, retards compris
      expect(screen.getByText('· 1 en retard', hidden)).toBeTruthy();
    });

    it('un tap sur la ligne de retard filtre sur « En location » ; le véhicule en retard passe avant la location normale', async () => {
      await render(<FlotteScreen />);
      await fireEvent.press(screen.getByLabelText(/Voir les véhicules en location, dont 1 en retard/));
      expect(screen.getByLabelText('En location : 2, dont 1 en retard').props.accessibilityState).toMatchObject({ selected: true });
      const logan = screen.getByLabelText(/^Dacia Logan, en retard de 3 jours, prévue le /);
      const sandero = screen.getByLabelText(/^Dacia Sandero, /);
      const labels = screen.getAllByRole('button').map((node) => node.props.accessibilityLabel as string | undefined);
      expect(labels.indexOf(logan.props.accessibilityLabel)).toBeLessThan(labels.indexOf(sandero.props.accessibilityLabel));
      expect(screen.queryByLabelText(/^Dacia Troc, /)).toBeNull();
    });

    it('conseil BIBIP prioritaire « RETOUR EN RETARD » : visible de l’employé, qui peut appeler le client', async () => {
      mockState.role = 'employee';
      await render(<FlotteScreen />);
      expect(await screen.findByText('RETOUR EN RETARD', hidden)).toBeTruthy();
      expect(screen.queryByText('CONSEIL BIBIP', hidden)).toBeNull();
      expect(screen.getByLabelText(/^Retour en retard\. La Dacia Logan devait revenir .* : 3 jours de retard\. Fouad B\. ne l'a pas rendue\.$/)).toBeTruthy();
      await fireEvent.press(screen.getByText('Appeler Fouad B.'));
      expect(openURL).toHaveBeenCalledWith('tel:+212611223344');
    });

    it('le propriétaire voit le retard AVANT le conseil offre ; « Plus tard » laisse passer le conseil suivant', async () => {
      await render(<FlotteScreen />);
      expect(await screen.findByText('RETOUR EN RETARD', hidden)).toBeTruthy();
      await fireEvent.press(screen.getByText('Plus tard'));
      expect(screen.queryByText('RETOUR EN RETARD', hidden)).toBeNull();
      expect(screen.getByText('CONSEIL BIBIP', hidden)).toBeTruthy();
    });

    it('bouton « Appeler » de la carte : appelle le client (employé compris), sans « Prolonger » ni montant', async () => {
      mockState.role = 'employee';
      await render(<FlotteScreen />);
      await fireEvent.press(screen.getByLabelText(/Voir les véhicules en location/));
      await fireEvent.press(screen.getByLabelText('Appeler : Dacia Logan'));
      expect(openURL).toHaveBeenCalledWith('tel:+212611223344');
      expect(screen.queryByLabelText(/Prolonger/)).toBeNull();
      expect(screen.queryAllByText(/MAD\/j/, hidden)).toHaveLength(0);
    });

    it('sans retard : ni ligne, ni pastille, ni conseil de retard', async () => {
      mockState.late = false;
      await render(<FlotteScreen />);
      expect(screen.queryByText(/retour(s)? en retard/)).toBeNull();
      expect(screen.queryByText('RETOUR EN RETARD', hidden)).toBeNull();
      expect(screen.getByLabelText('En location : 1')).toBeTruthy();
    });
  });
});
