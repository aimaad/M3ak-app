/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, Linking, Share } from 'react-native';

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
  payments: [] as unknown[],
  inspections: [] as unknown[],
  archiveError: null as unknown,
  specsCalls: [] as unknown[],
  docCalls: [] as unknown[],
  uploaded: [] as unknown[],
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
jest.mock('@/features/inspections/hooks', () => ({ useVehicleInspections: () => ({ data: mockState.inspections }) }));
jest.mock('@/features/payments/hooks', () => ({ useAllPayments: (enabled = true) => ({ data: enabled ? mockState.payments : undefined }) }));
jest.mock('@/features/vehicles/hooks', () => ({
  useVehicle: () => ({ data: mockState.vehicle, isLoading: false, isError: false, refetch: jest.fn() }),
  useUpdateVehiclePhotos: () => ({ mutateAsync: jest.fn() }),
  useUpdateVehicleSpecs: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.specsCalls.push(args); options?.onSuccess?.(); } }),
  useUpdateVehicleDocuments: () => ({ mutateAsync: async (args: unknown) => { mockState.docCalls.push(args); } }),
  useUpdateVehicleStatus: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.statusCalls.push(args); options?.onSuccess?.(); } }),
  useArchiveVehicle: () => ({
    mutate: (id: string, options?: { onError?: (error: unknown) => void }) => {
      mockState.archived.push(id);
      if (mockState.archiveError) options?.onError?.(mockState.archiveError);
    },
  }),
  useReactivateVehicle: () => ({ mutate: (id: string) => mockState.reactivated.push(id), mutateAsync: jest.fn() }),
}));
jest.mock('@/components/undo-toast', () => ({ useUndo: () => ({ showUndo: jest.fn() }) }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/features/vehicles/api', () => ({ VEHICLE_PHOTOS_BUCKET: 'vehicle-photos', VEHICLE_DOCUMENTS_BUCKET: 'vehicle-documents', deleteVehiclePhotoFile: jest.fn(), uploadVehicleDocument: async (...args: unknown[]) => { mockState.uploaded.push(args); return { type: args[2], path: 'new-path', uploadedAt: '2026-11-14T10:00:00Z', expiresAt: args[4] }; } }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: async () => ({ granted: true }), requestMediaLibraryPermissionsAsync: async () => ({ granted: true }), launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///doc.jpg' }] }), launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///doc.jpg' }] }) }));
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
    Object.assign(mockState, { language: 'fr', role: 'owner', vehicle: { ...base, statut: 'disponible' }, rentals: [], maintenance: [], statusCalls: [], archived: [], reactivated: [], payments: [], inspections: [], archiveError: null, specsCalls: [], docCalls: [], uploaded: [] });
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
    await fireEvent.press(screen.getAllByText('Modifier', hidden).at(-1) as never);
    expect(mockRouter.push).toHaveBeenCalledWith('/flotte/v1/modifier');
  });

  it('« … » pour l’employé : pas d’« Archiver »', async () => {
    mockState.role = 'employee';
    await render(<VehicleDetailScreen />);
    await fireEvent.press(screen.getByLabelText("Plus d'actions : modifier, archiver"));
    expect((await screen.findAllByText('Modifier', hidden)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Archiver ce véhicule', hidden)).toBeNull();
  });

  it('archivé : bandeau « Archivé » et « Restaurer » pour le propriétaire seulement', async () => {
    mockState.vehicle = { ...base, statut: 'disponible', archivedAt: at(-3) };
    await render(<VehicleDetailScreen />);
    expect(screen.getByText(/Ce véhicule est archivé/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Restaurer'));
    expect(mockState.reactivated).toEqual(['v1']);
  });

  it('archivé, responsable : « Restaurer » aussi (le serveur l’autorise)', async () => {
    mockState.role = 'manager';
    mockState.vehicle = { ...base, statut: 'disponible', archivedAt: at(-3) };
    await render(<VehicleDetailScreen />);
    expect(screen.getByText('Restaurer')).toBeTruthy();
  });

  it('archivé, employé : pas de « Restaurer »', async () => {
    mockState.role = 'employee';
    mockState.vehicle = { ...base, statut: 'disponible', archivedAt: at(-3) };
    await render(<VehicleDetailScreen />);
    expect(screen.queryByText('Restaurer')).toBeNull();
  });

  describe('chiffres clés et 14 jours', () => {
    const finished = () => rentalRow({ id: 'done', statut: 'terminee', dateDebutPrevue: at(-5), dateFinPrevue: at(-3), dateDepartReel: at(-5), dateRetourReel: at(-3), prixTotal: 1500 });

    it('propriétaire : revenus 30 jours, encaissé réel, prix par jour, occupation et locations', async () => {
      mockState.rentals = [finished()];
      mockState.payments = [{ id: 'p1', rentalId: 'done', montant: 1000, statut: 'paye', datePaiement: at(-3), methode: 'especes', agencyId: 'a1' }];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('REVENUS · 30 JOURS')).toBeTruthy();
      expect(screen.getByText(/^1.?500$/)).toBeTruthy();
      expect(screen.getByText(/^Encaissé : 1.?000 MAD$/)).toBeTruthy();
      expect(screen.getByText('Prix par jour')).toBeTruthy();
      expect(screen.getByText('Occupation')).toBeTruthy();
      expect(screen.getByText("Locations depuis l'ajout")).toBeTruthy();
    });

    it('période sans revenu : message clair, pas de variation', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Aucun revenu sur 30 jours')).toBeTruthy();
      expect(screen.queryByText(/vs période précédente/)).toBeNull();
    });

    it('employé : ni revenus, ni encaissé, ni prix ; occupation et locations restent', async () => {
      mockState.role = 'employee';
      mockState.rentals = [finished()];
      await render(<VehicleDetailScreen />);
      expect(screen.queryByText('REVENUS · 30 JOURS')).toBeNull();
      expect(screen.queryByText('Prix par jour')).toBeNull();
      expect(screen.queryByText(/Encaissé/)).toBeNull();
      expect(screen.getByText('Occupation')).toBeTruthy();
      expect(screen.getByText("Locations depuis l'ajout")).toBeTruthy();
    });

    it('14 jours : pas de « Bloquer des dates » ; un jour libre ouvre une location à partir de ce jour', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('14 prochains jours')).toBeTruthy();
      expect(screen.queryByText(/Bloquer/)).toBeNull();
      const day = screen.getAllByLabelText(/Libre\. Louer à partir de ce jour$/)[0];
      await fireEvent.press(day);
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/locations/nouveau', params: { vehicleId: 'v1', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } });
    });

    it('14 jours : un jour réservé ouvre la location ; le résumé est lu à voix haute', async () => {
      mockState.rentals = [rentalRow({ id: 'res', statut: 'confirmee', dateDebutPrevue: at(3), dateFinPrevue: at(5), dateDepartReel: null })];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getAllByLabelText(/: Loué$/)[0]);
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/locations/[id]', params: { id: 'res' } });
      expect(screen.getByLabelText(/^Libre du .* au .*\. Loué du .* au .*\. Libre du .* au /)).toBeTruthy();
    });
  });

  describe('échéances, fiche technique, historique, documents', () => {
    it('fiche technique : boîte et puissance « À compléter » ; appui sur une tuile → modification SUR PLACE (pas de changement de page)', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getAllByText('À compléter')).toHaveLength(2);
      await fireEvent.press(screen.getByLabelText('Boîte : à compléter. Appuyez pour le renseigner'));
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Enregistrer')).toBeTruthy();
      expect(screen.getByText('Manuelle')).toBeTruthy();
    });

    it('description : affichée seulement si elle existe', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.queryByText('Très propre, climatisation neuve')).toBeNull();
    });

    it('description présente : texte simple sous la fiche technique', async () => {
      mockState.vehicle = { ...base, statut: 'disponible', description: 'Très propre, climatisation neuve' };
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Très propre, climatisation neuve')).toBeTruthy();
    });

    it('échéances : assurance et visite technique sans date, « Ajouter la photo »', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Échéances')).toBeTruthy();
      expect(screen.getAllByText('Aucune date')).toHaveLength(2);
      expect(screen.getAllByText('Ajouter la photo').length).toBeGreaterThanOrEqual(2);
    });

    it('échéances : une vidange proche s’affiche en jours et ouvre l’entretien', async () => {
      mockState.maintenance = [{ id: 'm9', vehicleId: 'v1', type: 'vidange', statut: 'a_venir', echeanceDate: at(5), echeanceKm: null }];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vidange : J-5\./));
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/maintenance/[id]', params: { id: 'm9' } });
    });

    it('historique : aucune ligne → message ; avec une location terminée → ligne et montant (propriétaire)', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getByText("Aucun historique pour l'instant.")).toBeTruthy();
    });

    it('historique : location terminée avec montant pour le propriétaire, « Tout voir » ouvre l’écran complet', async () => {
      mockState.rentals = [rentalRow({ id: 'h1', statut: 'terminee', dateRetourReel: at(-1), prixTotal: 3500 })];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Location · Fouad B.')).toBeTruthy();
      expect(screen.getByText(/^3.?500 MAD$/)).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Tout voir'));
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/flotte/[id]/historique', params: { id: 'v1' } });
    });

    it('historique, employé : la ligne est là, le montant n’y est pas', async () => {
      mockState.role = 'employee';
      mockState.rentals = [rentalRow({ id: 'h1', statut: 'terminee', dateRetourReel: at(-1), prixTotal: 3500 })];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Location · Fouad B.')).toBeTruthy();
      expect(screen.queryByText(/3.?500/)).toBeNull();
    });

    it('historique : inspection de départ sans dommage', async () => {
      mockState.inspections = [{ id: 'i1', rentalId: 'r1', type: 'depart', statut: 'terminee', skipped: false, dateInspection: at(-2), damageCount: 0 }];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Inspection de départ')).toBeTruthy();
      expect(screen.getByText(/aucun dommage$/)).toBeTruthy();
    });

    it('documents : quatre vignettes « Ajouter la photo » sans fichier et un bouton « Ajouter »', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Documents')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Ajouter'));
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Enregistrer')).toBeTruthy(); // l'éditeur de documents s'ouvre sur place
    });
  });

  describe('archivage protégé', () => {
    it('autorisé : bouton « Archiver ce véhicule » ; confirmation avant d’archiver', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      await render(<VehicleDetailScreen />);
      expect(screen.queryByText("Archivage impossible pour l'instant")).toBeNull();
      await fireEvent.press(screen.getAllByLabelText('Archiver ce véhicule').at(-1) as never);
      expect(alert).toHaveBeenCalledWith('Archiver ce véhicule ?', expect.any(String), expect.any(Array));
      expect(mockState.archived).toEqual([]); // rien tant que l'on n'a pas confirmé
      const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      buttons.find((button) => button.text === 'Archiver')?.onPress?.();
      expect(mockState.archived).toEqual(['v1']);
    });

    it('en location : bouton verrouillé + raison avec le client et le jour de retour', async () => {
      mockState.vehicle = { ...base, statut: 'en_location' };
      mockState.rentals = [rentalRow({})];
      await render(<VehicleDetailScreen />);
      const locked = screen.getByLabelText("Archivage impossible pour l'instant");
      expect(locked.props.accessibilityState).toEqual({ disabled: true });
      expect(screen.getByText(/^Elle est en location chez Fouad B\. jusqu'au .*\. Vous pourrez l'archiver après son retour\.$/)).toBeTruthy();
    });

    it('en retard : « Enregistrez d’abord son retour »', async () => {
      mockState.vehicle = { ...base, statut: 'en_location' };
      mockState.rentals = [rentalRow({ dateDebutPrevue: at(-9), dateFinPrevue: at(-3, 18) })];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText("Fouad B. ne l'a pas encore rendue. Enregistrez d'abord son retour.")).toBeTruthy();
    });

    it('réservée : jour, client et « Et 1 autre réservation. »', async () => {
      mockState.rentals = [
        rentalRow({ id: 'a', statut: 'confirmee', dateDebutPrevue: at(3), dateFinPrevue: at(5), dateDepartReel: null }),
        rentalRow({ id: 'b', statut: 'confirmee', dateDebutPrevue: at(8), dateFinPrevue: at(9), dateDepartReel: null }),
      ];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText(/^Elle est réservée par Fouad B\. le .*\. Annulez ou déplacez cette réservation sur un autre véhicule d'abord\. Et 1 autre réservation\.$/)).toBeTruthy();
    });

    it('employé : ni bouton ni raison', async () => {
      mockState.role = 'employee';
      mockState.vehicle = { ...base, statut: 'en_location' };
      mockState.rentals = [rentalRow({})];
      await render(<VehicleDetailScreen />);
      expect(screen.queryByLabelText("Archivage impossible pour l'instant")).toBeNull();
      expect(screen.queryByText(/Elle est en location chez/)).toBeNull();
    });

    it('responsable : voit le bouton verrouillé', async () => {
      mockState.role = 'manager';
      mockState.vehicle = { ...base, statut: 'en_location' };
      mockState.rentals = [rentalRow({})];
      await render(<VehicleDetailScreen />);
      expect(screen.getByLabelText("Archivage impossible pour l'instant")).toBeTruthy();
    });

    it('le serveur refuse malgré tout : message précis avec le nombre', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockState.archiveError = { message: 'vehicle_has_active_rentals', details: 'count=2' };
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getAllByLabelText('Archiver ce véhicule').at(-1) as never);
      (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((button) => button.text === 'Archiver')?.onPress?.();
      expect(alert).toHaveBeenLastCalledWith('BIBIP', 'Archivage refusé : 2 locations à terminer ou annuler d\'abord. Actualisez la fiche.');
    });
  });

  describe('modification sur place', () => {
    it('« Modifier » de la fiche technique : champs à la place des tuiles ; enregistrer envoie seulement ce qui a changé', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier : Fiche technique'));
      expect(mockRouter.push).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByText('Manuelle'));
      await fireEvent.changeText(screen.getByDisplayValue('Blanc'), 'Gris');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(mockState.specsCalls).toEqual([{ id: 'v1', patch: { transmission: 'manuelle', couleur: 'Gris' } }]);
      expect(screen.queryByLabelText('Enregistrer')).toBeNull(); // retour à l'affichage normal
    });

    it('valeur invalide : message, rien n’est enregistré', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier : Fiche technique'));
      await fireEvent.changeText(screen.getByDisplayValue('5'), '12');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(screen.getByText('Entrez un nombre de places entre 1 et 9.')).toBeTruthy();
      expect(mockState.specsCalls).toEqual([]);
    });

    it('« Annuler » : on revient à l’affichage sans rien enregistrer', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier : Fiche technique'));
      await fireEvent.changeText(screen.getByDisplayValue('Blanc'), 'Gris');
      await fireEvent.press(screen.getByLabelText('Annuler'));
      expect(mockState.specsCalls).toEqual([]);
      expect(screen.getByLabelText('Modifier : Fiche technique')).toBeTruthy();
    });

    it('documents : « Modifier » ouvre l’éditeur ; une nouvelle photo avec sa date est envoyée puis enregistrée', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier : Documents'));
      expect(mockRouter.push).not.toHaveBeenCalled();
      const cameras = screen.getAllByText('Caméra');
      await fireEvent.press(cameras[2]); // assurance
      await fireEvent.changeText(await screen.findByPlaceholderText('JJ/MM/AAAA'), '26/12/2026');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      await waitFor(() => expect(mockState.docCalls).toHaveLength(1));
      expect(mockState.uploaded[0]).toEqual(['a1', 'v1', 'assurance', 'file:///doc.jpg', '2026-12-26']);
      expect(mockState.docCalls[0]).toMatchObject({ id: 'v1', documents: [{ type: 'assurance', path: 'new-path', expiresAt: '2026-12-26' }] });
    });

    it('documents : date invalide refusée, rien n’est envoyé', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier : Documents'));
      await fireEvent.press(screen.getAllByText('Caméra')[2]);
      await fireEvent.changeText(await screen.findByPlaceholderText('JJ/MM/AAAA'), '32/13/2026');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(await screen.findByText(/Date invalide/)).toBeTruthy();
      expect(mockState.uploaded).toEqual([]);
    });

    it('véhicule en location : la fiche technique reste modifiable sur place', async () => {
      mockState.vehicle = { ...base, statut: 'en_location' };
      mockState.rentals = [rentalRow({})];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier : Fiche technique'));
      await fireEvent.changeText(screen.getByDisplayValue('Blanc'), 'Noir');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(mockState.specsCalls).toEqual([{ id: 'v1', patch: { couleur: 'Noir' } }]);
    });
  });
});
