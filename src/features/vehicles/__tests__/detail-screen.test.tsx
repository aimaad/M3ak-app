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
  pickDate: null as Date | null,
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
  priceCalls: [] as unknown[],
  compliance: [] as unknown[],
  visitMonths: 6,
  renewCalls: [] as unknown[],
  renewError: null as unknown,
  correctCalls: [] as unknown[],
  deleteCalls: [] as unknown[],
  settingsCalls: [] as unknown[],
  dueCalls: { update: [] as unknown[], create: [] as unknown[], remove: [] as unknown[], createError: null as unknown, quick: [] as unknown[] },
  priceFails: false,
  docCalls: [] as unknown[],
  uploaded: [] as unknown[],
};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
const base = { id: 'v1', agencyId: 'a1', branchId: null, marque: 'DACIA', modele: 'LOGAN', immatriculation: '8921 | ب | 14', vin: null, categorie: 'economique', carburant: 'diesel', annee: 2021, kilometrage: 40000, prixJour: 500, prixSemaine: null, prixMois: null, finition: null, niveauCarburant: null, description: null, photoUrl: null, photos: [], documents: [], archivedAt: null, createdAt: at(-100), updatedAt: at(-1), transmission: null, couleur: 'Blanc', nombrePlaces: 5 };
const rentalRow = (extra: Record<string, unknown>) => ({ id: 'r1', vehicleId: 'v1', customerId: 'c1', statut: 'en_cours', dateDebutPrevue: at(-1), dateFinPrevue: at(5, 18), dateDepartReel: at(-1), dateRetourReel: null, dureeJours: 6, ...extra });

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: ({ onValueChange, value }: { onValueChange: (event: unknown, date: Date) => void; value: Date }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable } = require('react-native');
    return <Pressable accessibilityLabel="PICKER-DAY" onPress={() => onValueChange({}, mockState.pickDate ?? value)} />;
  },
  DateTimePickerAndroid: { open: jest.fn() },
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('@/features/vehicles/add/scan-parts', () => ({ ScanFrame: () => null }));
jest.mock('@/components/form/camera-capture', () => ({ CameraCapture: () => null }));
jest.mock('@/components/form/photo-check', () => ({ checkPhoto: async () => ({ ok: true }) }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ id: 'v1' }),
}));
jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: mockState.role } }) }));
jest.mock('@/features/customers/hooks', () => ({ useCustomers: () => ({ data: [{ id: 'c1', nomComplet: 'FOUAD BENNANI', telephone: '+212 6 11 22 33 44' }] }) }));
jest.mock('@/features/rentals/hooks', () => ({ useVehicleRentals: () => ({ data: mockState.rentals, refetch: jest.fn() }) }));
jest.mock('@/features/compliance/api', () => ({ isAlreadyRecordedError: (error: { code?: string } | null) => error?.code === '23505' }));
jest.mock('@/features/compliance/hooks', () => ({
  useVehicleCompliance: () => ({ data: mockState.compliance }),
  useComplianceSettings: () => ({ settings: { visitIntervalMonths: mockState.visitMonths } }),
  useRenewCompliance: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => { mockState.renewCalls.push(args); if (mockState.renewError) options?.onError?.(mockState.renewError); else options?.onSuccess?.(); } }),
  useCorrectCompliance: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.correctCalls.push(args); options?.onSuccess?.(); } }),
  useDeleteCompliance: () => ({ mutate: (args: unknown) => { mockState.deleteCalls.push(args); } }),
  useSaveComplianceSettings: () => ({ mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.settingsCalls.push(args); options?.onSuccess?.(); } }),
}));
jest.mock('@/features/maintenance/hooks', () => ({
  useVehicleMaintenanceItems: () => ({ data: mockState.maintenance, refetch: jest.fn() }),
  useCreateMaintenanceItem: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => { if (mockState.dueCalls.createError) return options?.onError?.(mockState.dueCalls.createError); mockState.dueCalls.create.push(args); options?.onSuccess?.(); }, mutateAsync: async (args: unknown) => { mockState.dueCalls.create.push(args); } }),
  useQuickCompleteMaintenance: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.dueCalls.quick.push(args); options?.onSuccess?.(); } }),
  useUpdateMaintenanceDue: () => ({ mutateAsync: async (args: unknown) => { mockState.dueCalls.update.push(args); } }),
  useDeleteMaintenanceItem: () => ({ mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.dueCalls.remove.push(args); options?.onSuccess?.(); } }),
}));
jest.mock('@/features/inspections/hooks', () => ({ useVehicleInspections: () => ({ data: mockState.inspections }) }));
jest.mock('@/features/payments/hooks', () => ({ useAllPayments: (enabled = true) => ({ data: enabled ? mockState.payments : undefined }) }));
jest.mock('@/features/vehicles/hooks', () => ({
  useVehicle: () => ({ data: mockState.vehicle, isLoading: false, isError: false, refetch: jest.fn() }),
  useUpdateVehiclePhotos: () => ({ mutateAsync: jest.fn() }),
  useUpdateVehiclePrice: () => ({ mutateAsync: async (args: unknown) => { if (mockState.priceFails) throw new Error('offline'); mockState.priceCalls.push(args); } }),
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

/** Choisit une date dans le sélecteur du téléphone (simulé) : ouvre le champ, choisit le jour, valide. */
async function pickDate(label: RegExp | string, date: Date) {
  mockState.pickDate = date;
  await fireEvent.press(screen.getAllByLabelText(label)[0]);
  await fireEvent.press(await screen.findByLabelText('PICKER-DAY', hiddenEls));
  await fireEvent.press(screen.getByText('OK', hiddenEls));
}
const hiddenEls = { includeHiddenElements: true };

describe('fiche véhicule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockState, { language: 'fr', role: 'owner', vehicle: { ...base, statut: 'disponible' }, rentals: [], maintenance: [], statusCalls: [], archived: [], reactivated: [], payments: [], inspections: [], archiveError: null, specsCalls: [], priceCalls: [], compliance: [], visitMonths: 6, renewCalls: [], renewError: null, correctCalls: [], deleteCalls: [], settingsCalls: [], dueCalls: { update: [], create: [], remove: [], createError: null, quick: [] }, priceFails: false, docCalls: [], uploaded: [] });
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

  it('« Rendre indisponible » sur une voiture réservée : refus avec le nom du client, aucun motif demandé', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockState.rentals = [rentalRow({ statut: 'confirmee', dateDebutPrevue: at(3), dateFinPrevue: at(6), dateDepartReel: null })];
    await render(<VehicleDetailScreen />);
    await fireEvent.press(screen.getByLabelText('Rendre indisponible : Dacia Logan'));
    expect(alert).toHaveBeenCalledWith('Statut impossible à changer', expect.stringMatching(/Elle est déjà réservée par .+\. Essayez de lui accorder une autre voiture\./), expect.any(Array));
    expect(screen.queryByText('Motif (facultatif)', hidden)).toBeNull();
    expect(mockState.statusCalls).toHaveLength(0);
  });

  it('« Rendre disponible » avec une échéance en alerte : simple alerte, rien n’est bloqué ; « Annuler » ne change rien, confirmer rend disponible', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockState.vehicle = { ...base, statut: 'indisponible', statutMotif: 'Pare-brise' };
    mockState.compliance = [{ id: 'c1', agencyId: 'a1', vehicleId: 'v1', kind: 'assurance', validFrom: null, validUntil: at(-3).slice(0, 10), reference: null, provider: null, amount: null, documentPath: 'p.jpg', notes: null, periodMonths: null, createdBy: null, createdAt: '2026-01-01T00:00:00Z' }];
    await render(<VehicleDetailScreen />);
    await fireEvent.press(screen.getByLabelText('Rendre disponible : Dacia Logan'));
    expect(alert).toHaveBeenCalledWith('Échéances en alerte', expect.stringContaining('Assurance (expirée)'), expect.any(Array));
    expect(mockState.statusCalls).toHaveLength(0); // rien avant la confirmation
    (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((button) => button.text === 'Rendre disponible quand même')?.onPress?.();
    await waitFor(() => expect(mockState.statusCalls).toEqual([{ id: 'v1', statut: 'disponible', motif: undefined }]));
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
    it('fiche technique : boîte et puissance « À compléter » ; appui sur une tuile → écran « Modifier la fiche technique »', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getAllByText('À compléter')).toHaveLength(2);
      await fireEvent.press(screen.getByLabelText('Boîte : à compléter. Appuyez pour le renseigner'));
      expect(mockRouter.push).toHaveBeenCalledWith('/flotte/v1/modifier');
      expect(screen.queryByLabelText('Enregistrer')).toBeNull(); // plus d'éditeur sur place
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

    it('échéances : une vidange proche s’affiche en jours ; un toucher la déplie sur place (pas de changement de page)', async () => {
      mockState.maintenance = [{ id: 'm9', vehicleId: 'v1', type: 'vidange', statut: 'a_venir', echeanceDate: at(5), echeanceKm: null }];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vidange : J-5\./));
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Enregistrer')).toBeTruthy();
      expect(screen.queryByText('Marquer comme fait')).toBeNull(); // faire un entretien se fait dans la section « Entretien », pas ici
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

    it('documents : « Modifier » ouvre « Modifier la fiche technique », défilé jusqu\'aux documents', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier : Documents'));
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/flotte/[id]/modifier', params: { id: 'v1', field: 'carburant' } });
      expect(screen.queryByLabelText('Enregistrer')).toBeNull();
    });

    it('documents : bouton « Ajouter » → même écran', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Documents')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Ajouter'));
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/flotte/[id]/modifier', params: { id: 'v1', field: 'carburant' } });
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

  describe('fiche technique : plus d\'éditeur sur place', () => {
    it('« Modifier » de la fiche technique ouvre l\'écran « Modifier la fiche technique »', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier : Fiche technique'));
      expect(mockRouter.push).toHaveBeenCalledWith('/flotte/v1/modifier');
      expect(screen.queryByLabelText('Enregistrer')).toBeNull();
      expect(mockState.specsCalls).toEqual([]);
    });

    it('véhicule en location : même chose', async () => {
      mockState.vehicle = { ...base, statut: 'en_location' };
      mockState.rentals = [rentalRow({})];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier : Fiche technique'));
      expect(mockRouter.push).toHaveBeenCalledWith('/flotte/v1/modifier');
    });
  });

  describe('prix par jour modifiable sur place', () => {
    it('« Modifier » transforme « 500 MAD » en champ au même endroit (pas de changement de page) ; Enregistrer envoie le nouveau prix', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('500 MAD')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Modifier le prix'));
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(screen.queryByText('500 MAD')).toBeNull();
      await fireEvent.changeText(screen.getByDisplayValue('500'), '550');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      await waitFor(() => expect(mockState.priceCalls).toEqual([{ id: 'v1', prixJour: 550 }]));
      await waitFor(() => expect(screen.getByLabelText('Modifier le prix')).toBeTruthy()); // retour à l'affichage
    });

    it('prix invalide (0 ou vide) : message, rien n’est envoyé', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier le prix'));
      await fireEvent.changeText(screen.getByDisplayValue('500'), '0');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(screen.getByText('Entrez un prix supérieur à 0.')).toBeTruthy();
      expect(mockState.priceCalls).toEqual([]);
    });

    it('échec de l’enregistrement : message, le champ reste ouvert', async () => {
      mockState.priceFails = true;
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier le prix'));
      await fireEvent.changeText(screen.getByDisplayValue('500'), '600');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(await screen.findByText("Impossible d'enregistrer le prix. Réessayez.")).toBeTruthy();
      expect(screen.getByDisplayValue('600')).toBeTruthy();
    });

    it('« Annuler » : le prix d’origine revient, rien n’est enregistré', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Modifier le prix'));
      await fireEvent.changeText(screen.getByDisplayValue('500'), '999');
      await fireEvent.press(screen.getByLabelText('Annuler'));
      expect(screen.getByText('500 MAD')).toBeTruthy();
      expect(mockState.priceCalls).toEqual([]);
    });

    it('employé : pas de prix, donc pas de « Modifier le prix »', async () => {
      mockState.role = 'employee';
      await render(<VehicleDetailScreen />);
      expect(screen.queryByLabelText('Modifier le prix')).toBeNull();
    });
  });

  describe('échéances modifiables sur place', () => {
    const vidange = () => ({ id: 'm9', vehicleId: 'v1', type: 'vidange', statut: 'a_venir', echeanceDate: at(5), echeanceKm: null });

    it('corriger la date d’un entretien : Enregistrer envoie la mise à jour', async () => {
      mockState.maintenance = [vidange()];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vidange : J-5\./));
      await pickDate(/^Date d'échéance/, new Date(2027, 0, 31));
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      await waitFor(() => expect(mockState.dueCalls.update).toEqual([{ id: 'm9', patch: { echeanceDate: '2027-01-31', echeanceKm: null, notes: null, repeatKm: null, repeatMonths: null } }]));
    });

    it('la suggestion « Dans 12 mois » remplit la date', async () => {
      mockState.maintenance = [vidange()];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vidange : J-5\./));
      await fireEvent.press(screen.getByText(/^Dans 12 mois : /));
      expect(screen.getByLabelText(/^Date d'échéance: /)).toBeTruthy(); // la date est maintenant renseignée
    });

    it('ni date ni kilométrage : message, rien n’est envoyé', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('+ Ajouter'));
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(screen.getByText("Renseignez une date ou un kilométrage d'échéance.")).toBeTruthy();
      expect(mockState.dueCalls.create).toEqual([]);
    });

    it('« + Ajouter » : formulaire dans la carte, nouvelle échéance créée pour CE véhicule', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('+ Ajouter'));
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(screen.getByText('Nouvelle échéance')).toBeTruthy();
      await fireEvent.press(screen.getAllByText('Freins')[0]);
      await fireEvent.press(screen.getByText(/^À 70.?000 km$/)); // 40 000 + 30 000
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(mockState.dueCalls.create).toEqual([{ agencyId: 'a1', input: { vehicleId: 'v1', type: 'freins', echeanceDate: null, echeanceKm: 70000, notes: null, repeatKm: 30000, repeatMonths: null } }]);
    });

    it('périodicité : la vidange propose déjà « tous les 10 000 km » et 12 mois ; elle est enregistrée avec l’échéance', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('+ Ajouter'));
      expect(screen.getByDisplayValue('10 000')).toBeTruthy(); // rien à retaper
      expect(screen.getByLabelText('12 mois').props.accessibilityState.checked).toBe(true);
      await fireEvent.press(screen.getByText(/^À \d+.?\d* km$/));
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(mockState.dueCalls.create).toMatchObject([{ input: { type: 'vidange', repeatKm: 10000, repeatMonths: 12 } }]);
    });

    it('périodicité : « Jamais » et un champ vide = échéance ponctuelle', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('+ Ajouter'));
      await fireEvent.changeText(screen.getByDisplayValue('10 000'), '');
      await fireEvent.press(screen.getByLabelText('Jamais'));
      await fireEvent.press(screen.getByText(/^À \d+.?\d* km$/));
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(mockState.dueCalls.create).toMatchObject([{ input: { type: 'vidange', repeatKm: null, repeatMonths: null } }]);
    });

    it('« Une seule fois » : les champs de périodicité disparaissent et rien n’est répété', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('+ Ajouter'));
      expect(screen.getByLabelText('Périodique').props.accessibilityState.checked).toBe(true);
      await fireEvent.press(screen.getByLabelText('Une seule fois'));
      expect(screen.queryByDisplayValue('10 000')).toBeNull();
      expect(screen.queryByLabelText('12 mois')).toBeNull();
      await fireEvent.press(screen.getByText(/^À \d+.?\d* km$/));
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(mockState.dueCalls.create).toMatchObject([{ input: { type: 'vidange', repeatKm: null, repeatMonths: null } }]);
    });

    it('une échéance existante sans périodicité s’ouvre sur « Une seule fois » ; « Périodique » remet les valeurs d’usage', async () => {
      mockState.maintenance = [vidange()];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vidange : J-5\./));
      expect(screen.getByLabelText('Une seule fois').props.accessibilityState.checked).toBe(true);
      await fireEvent.press(screen.getByLabelText('Périodique'));
      expect(screen.getByDisplayValue('10 000')).toBeTruthy();
    });

    it('échec de l’enregistrement : la raison est dite (base pas à jour → migration 0071), jamais un message vide', async () => {
      mockState.dueCalls.createError = { code: 'PGRST204', message: "Could not find the 'repeat_km' column of 'maintenance_items' in the schema cache" };
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('+ Ajouter'));
      await fireEvent.press(screen.getByText(/^À \d+.?\d* km$/));
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(await screen.findByText(/appliquez la migration 0071/)).toBeTruthy();
    });

    it('section « Entretien » : à faire (urgent d’abord) puis historique ; le bouton « ✓ Fait » n’existe qu’ici', async () => {
      mockState.maintenance = [
        { ...vidange(), id: 'm1', echeanceDate: at(20) },
        { id: 'm2', vehicleId: 'v1', type: 'freins', statut: 'en_retard', echeanceDate: at(-4), echeanceKm: null, cout: null, garage: null, dateIntervention: null },
        { id: 'm3', vehicleId: 'v1', type: 'pneus', statut: 'effectuee', echeanceDate: null, echeanceKm: null, cout: 800, garage: 'Garage Atlas', dateIntervention: at(-30) },
      ];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('À FAIRE')).toBeTruthy();
      expect(screen.getByText('HISTORIQUE')).toBeTruthy();
      expect(screen.getAllByLabelText(/^Marquer comme fait : /)).toHaveLength(2); // une seule fois par entretien à faire
      expect(screen.getAllByText('800 MAD').length).toBeGreaterThanOrEqual(2); // le coût de l'historique et le total (propriétaire)
      expect(screen.getByText('Total dépensé')).toBeTruthy();
    });

    it('section « Entretien », employé : aucun coût ni total', async () => {
      mockState.role = 'employee';
      mockState.maintenance = [{ id: 'm3', vehicleId: 'v1', type: 'pneus', statut: 'effectuee', echeanceDate: null, echeanceKm: null, cout: 800, garage: 'Garage Atlas', dateIntervention: at(-30) }];
      await render(<VehicleDetailScreen />);
      expect(screen.queryByText('800 MAD')).toBeNull();
      expect(screen.queryByText('Total dépensé')).toBeNull();
    });

    it('aucun entretien : message qui renvoie vers « Échéances »', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getByText(/Créez-en dans « Échéances »/)).toBeTruthy();
    });

    it('« ✓ Terminer » pour un entretien déjà démarré', async () => {
      mockState.maintenance = [{ ...vidange(), statut: 'en_cours' }];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('✓ Terminer')).toBeTruthy();
    });

    it('« ✓ Fait » : kilométrage et date déjà remplis, un seul geste « Confirmer »', async () => {
      mockState.maintenance = [vidange()];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Marquer comme fait : Vidange'));
      expect(screen.getByDisplayValue('40 000')).toBeTruthy(); // kilométrage de la fiche
      await fireEvent.press(screen.getByLabelText('Confirmer'));
      expect(mockState.dueCalls.quick).toEqual([{ id: 'm9', input: { km: 40000, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), garage: null, cout: null } }]);
    });

    it('« ✓ Fait » : garage et coût (propriétaire) sous « Ajouter des détails »', async () => {
      mockState.maintenance = [vidange()];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Marquer comme fait : Vidange'));
      expect(screen.queryByLabelText('Garage / prestataire')).toBeNull();
      await fireEvent.press(screen.getByText('Ajouter des détails (garage, coût)'));
      await fireEvent.changeText(screen.getByLabelText('Garage / prestataire'), 'Garage Atlas');
      await fireEvent.changeText(screen.getByLabelText('Coût (MAD)'), '450');
      await fireEvent.press(screen.getByLabelText('Confirmer'));
      expect(mockState.dueCalls.quick).toMatchObject([{ input: { garage: 'Garage Atlas', cout: 450 } }]);
    });

    it('« ✓ Fait », employé : pas de coût', async () => {
      mockState.role = 'employee';
      mockState.maintenance = [vidange()];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Marquer comme fait : Vidange'));
      await fireEvent.press(screen.getByText('Ajouter des détails (garage, coût)'));
      expect(screen.queryByLabelText('Coût (MAD)')).toBeNull();
    });

    it('« ✓ Fait » : kilométrage inférieur à la fiche refusé avec le message', async () => {
      mockState.maintenance = [vidange()];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText('Marquer comme fait : Vidange'));
      await fireEvent.changeText(screen.getByDisplayValue('40 000'), '35000');
      await fireEvent.press(screen.getByLabelText('Confirmer'));
      expect(screen.getByText(/ne peut pas être inférieur à celui de la fiche/)).toBeTruthy();
      expect(mockState.dueCalls.quick).toEqual([]);
    });

    it('périodicité : une échéance existante montre sa périodicité enregistrée', async () => {
      mockState.maintenance = [{ ...vidange(), repeatKm: 15000, repeatMonths: 6 }];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vidange : J-5\./));
      expect(screen.getByDisplayValue('15 000')).toBeTruthy();
      expect(screen.getByLabelText('6 mois').props.accessibilityState.checked).toBe(true);
    });

    it('« Supprimer » demande confirmation (propriétaire) ; « Échéances » ne sert qu’à créer et corriger, pas à faire', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockState.maintenance = [vidange()];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vidange : J-5\./));
      expect(screen.queryByText('Marquer comme fait')).toBeNull();
      await fireEvent.press(screen.getByText("Supprimer l'échéance"));
      expect(alert).toHaveBeenCalledWith('Supprimer cette échéance ?', expect.any(String), expect.any(Array));
      expect(mockState.dueCalls.remove).toEqual([]); // rien avant confirmation
      (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((button) => button.text === "Supprimer l'échéance")?.onPress?.();
      expect(mockState.dueCalls.remove).toEqual([{ id: 'm9', vehicleId: 'v1' }]);
    });

    it('employé : peut corriger une échéance, mais pas la supprimer', async () => {
      mockState.role = 'employee';
      mockState.maintenance = [vidange()];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vidange : J-5\./));
      expect(screen.getByLabelText('Enregistrer')).toBeTruthy();
      expect(screen.queryByText("Supprimer l'échéance")).toBeNull();
    });
  });

  describe('obligations légales (assurance, visite technique, vignette)', () => {
    const day = (delta: number) => { const d = new Date(); d.setDate(d.getDate() + delta); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
    const record = (extra: Record<string, unknown>) => ({ id: 'c1', agencyId: 'a1', vehicleId: 'v1', kind: 'assurance', validFrom: day(-300), validUntil: day(65), reference: null, provider: null, amount: null, documentPath: 'p.jpg', notes: null, createdBy: null, createdAt: '2026-01-01T00:00:00Z', ...extra });

    it('trois obligations, « Non renseignée » quand rien n’est enregistré', async () => {
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('OBLIGATIONS LÉGALES')).toBeTruthy();
      expect(screen.getAllByText('Non renseignée')).toHaveLength(3);
      expect(screen.getByText('Vignette')).toBeTruthy();
    });

    it('états : à jour, urgent (≤ 7 jours), expirée ; « papier non ajouté » quand il n’y a pas de photo', async () => {
      mockState.compliance = [record({}), record({ id: 'c2', kind: 'visite_technique', validUntil: day(3), documentPath: null }), record({ id: 'c3', kind: 'vignette', validFrom: '2025-01-01', validUntil: '2025-12-31' })];
      await render(<VehicleDetailScreen />);
      expect(screen.getByLabelText(/^Assurance : À jour\./)).toBeTruthy();
      expect(screen.getByLabelText(/^Visite technique : Urgent\./)).toBeTruthy();
      expect(screen.getByLabelText(/^Vignette : Expirée\./)).toBeTruthy();
      expect(screen.getAllByText('Papier non ajouté').length).toBeGreaterThan(0);
    });

    it('expire AUJOURD’HUI : encore valable (urgent), « Expire aujourd’hui »', async () => {
      mockState.compliance = [record({ validUntil: day(0) })];
      await render(<VehicleDetailScreen />);
      expect(screen.getByLabelText(/^Assurance : Urgent\. Expire aujourd'hui/)).toBeTruthy();
    });

    it('« Renouveler » : période proposée (12 mois pour l’assurance), enregistrement avec l’agence et le véhicule', async () => {
      mockState.compliance = [record({})];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : À jour\./));
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(screen.getByText('Renouveler : Assurance')).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText('N° de police'), 'POL-77');
      await fireEvent.changeText(screen.getByLabelText('Assureur'), 'Wafa');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(mockState.renewCalls).toHaveLength(1);
      expect(mockState.renewCalls[0]).toMatchObject({ agencyId: 'a1', input: { vehicleId: 'v1', kind: 'assurance', reference: 'POL-77', provider: 'Wafa', documentPath: null } });
      const input = (mockState.renewCalls[0] as { input: { validFrom: string; validUntil: string } }).input;
      expect(input.validFrom).toBe(day(66)); // le lendemain de la fin en cours
      expect(input.validUntil > input.validFrom).toBe(true);
    });

    it('durée de la période : 12 mois d’office ; changer la durée recalcule la fin et elle est mémorisée', async () => {
      mockState.compliance = [record({})];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : À jour\./));
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      expect(screen.getByLabelText('12 mois').props.accessibilityState.checked).toBe(true);
      await fireEvent.press(screen.getByLabelText('6 mois'));
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(mockState.renewCalls).toHaveLength(1);
      const input = (mockState.renewCalls[0] as { input: { validFrom: string; validUntil: string; periodMonths: number } }).input;
      expect(input.periodMonths).toBe(6);
      expect(input.validFrom).toBe(day(66));
    });

    it('durée déjà réglée (6 mois) : le renouvellement suivant la reprend sans rien retaper', async () => {
      mockState.compliance = [record({ periodMonths: 6 })];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : À jour\./));
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      expect(screen.getByLabelText('6 mois').props.accessibilityState.checked).toBe(true);
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect((mockState.renewCalls[0] as { input: { periodMonths: number } }).input.periodMonths).toBe(6);
    });

    it('assurance « Une seule fois » : la durée n’est pas mémorisée', async () => {
      mockState.compliance = [record({ periodMonths: 6 })];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : À jour\./));
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      await fireEvent.press(screen.getByLabelText('Une seule fois'));
      expect(screen.queryByLabelText('Durée de la période')).toBeNull();
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect((mockState.renewCalls[0] as { input: { periodMonths: number | null } }).input.periodMonths).toBeNull();
    });

    it('vignette : pas de durée (année civile)', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vignette : /));
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      expect(screen.queryByLabelText('Durée de la période')).toBeNull();
    });

    it('renouvellement en un geste : période déjà calculée (lendemain de la fin en cours + durée mémorisée), « Confirmer » suffit', async () => {
      mockState.compliance = [record({ periodMonths: 6 })];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : À jour\./));
      expect(screen.getByText('Prochaine période')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Confirmer'));
      expect(mockState.renewCalls).toHaveLength(1);
      const input = (mockState.renewCalls[0] as { input: { validFrom: string; validUntil: string; periodMonths: number; documentPath: null } }).input;
      expect(input.validFrom).toBe(day(66));
      expect(input.periodMonths).toBe(6);
      expect(input.documentPath).toBeNull(); // le papier s'ajoute plus tard
    });

    it('première assurance : « Première période » et 12 mois d’office', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : Non renseignée\./));
      expect(screen.getByText('Première période')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Confirmer'));
      expect((mockState.renewCalls[0] as { input: { periodMonths: number } }).input.periodMonths).toBe(12);
    });

    it('vignette : on choisit seulement l’année', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Vignette : /));
      const year = new Date().getFullYear();
      await fireEvent.press(screen.getByLabelText(String(year + 1)));
      await fireEvent.press(screen.getByLabelText('Confirmer'));
      expect(mockState.renewCalls).toMatchObject([{ input: { kind: 'vignette', validFrom: `${year + 1}-01-01`, validUntil: `${year + 1}-12-31`, periodMonths: null } }]);
    });

    it('« Avec détails » ouvre le formulaire complet (papier, montant…)', async () => {
      mockState.compliance = [record({})];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : À jour\./));
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      expect(screen.getByText('Renouveler : Assurance')).toBeTruthy();
    });

    it('une période qui ne finit pas APRÈS la période en cours est refusée', async () => {
      mockState.compliance = [record({})];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : À jour\./));
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      const old = day(30).split('-').map(Number);
      await pickDate(/^Début/, new Date(old[0], old[1] - 1, old[2] - 5));
      await pickDate(/^Fin de validité/, new Date(old[0], old[1] - 1, old[2]));
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(screen.getByText(/Cette période se termine avant la fin de la période actuelle/)).toBeTruthy();
      expect(mockState.renewCalls).toEqual([]);
    });

    it('même période déjà enregistrée (double appui) : message clair', async () => {
      mockState.renewError = { code: '23505' };
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : Non renseignée\./));
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      expect(screen.getByText('Enregistrer : Assurance')).toBeTruthy(); // premier enregistrement
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(await screen.findByText('Cette période est déjà enregistrée.')).toBeTruthy();
    });

    it('montant : champ pour le propriétaire seulement', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : Non renseignée\./));
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      expect(screen.getByLabelText('Montant (MAD)')).toBeTruthy();
    });

    it('employé : renouvelle sans champ montant ; ne voit pas « Corriger » ni « Supprimer »', async () => {
      mockState.role = 'employee';
      mockState.compliance = [record({ amount: 4200, reference: 'POL-1' })];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : À jour\./));
      expect(screen.getByText('POL-1')).toBeTruthy();
      expect(screen.queryByText(/4.?200 MAD/)).toBeNull(); // le montant de l’historique est caché
      expect(screen.queryByText('Corriger')).toBeNull();
      expect(screen.queryByText('Supprimer')).toBeNull();
      await fireEvent.press(screen.getByLabelText('Renouveler'));
      expect(screen.queryByLabelText('Montant (MAD) (facultatif)')).toBeNull();
    });

    it('historique : propriétaire corrige et supprime (avec confirmation)', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockState.compliance = [record({ reference: 'POL-1', amount: 4200 })];
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Assurance : À jour\./));
      expect(screen.getByText(/POL-1 · 4.?200 MAD/)).toBeTruthy();
      await fireEvent.press(screen.getByText('Corriger'));
      await fireEvent.changeText(screen.getByDisplayValue('POL-1'), 'POL-2');
      await fireEvent.press(screen.getByLabelText('Enregistrer'));
      expect(mockState.correctCalls).toMatchObject([{ id: 'c1', vehicleId: 'v1', patch: { reference: 'POL-2' } }]);
      await fireEvent.press(screen.getByText('Supprimer'));
      expect(alert).toHaveBeenCalledWith('Supprimer cette période ?', expect.any(String), expect.any(Array));
      expect(mockState.deleteCalls).toEqual([]);
      (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((button) => button.text === 'Supprimer')?.onPress?.();
      expect(mockState.deleteCalls).toEqual([{ id: 'c1', vehicleId: 'v1' }]);
    });

    it('historique de la fiche : le renouvellement apparaît (montant pour le propriétaire seulement)', async () => {
      mockState.compliance = [record({ amount: 4200, validUntil: day(300) })];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Assurance renouvelée')).toBeTruthy();
      expect(screen.getAllByText(/4.?200 MAD/).length).toBeGreaterThan(0);
    });

    it('historique de la fiche, employé : le renouvellement est là, pas le montant', async () => {
      mockState.role = 'employee';
      mockState.compliance = [record({ amount: 4200, validUntil: day(300) })];
      await render(<VehicleDetailScreen />);
      expect(screen.getByText('Assurance renouvelée')).toBeTruthy();
      expect(screen.queryByText(/4.?200/)).toBeNull();
    });

    it('visite technique : périodicité de l’agence (6 mois) modifiable par le propriétaire', async () => {
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Visite technique : Non renseignée\./));
      expect(screen.getByText('Visite technique tous les 6 mois')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('Modifier', hidden));
      await fireEvent.press(screen.getByText('12 mois'));
      expect(mockState.settingsCalls).toEqual([{ agencyId: 'a1', settings: { visitIntervalMonths: 12 } }]);
    });

    it('visite technique : l’employé voit la périodicité sans pouvoir la changer', async () => {
      mockState.role = 'employee';
      await render(<VehicleDetailScreen />);
      await fireEvent.press(screen.getByLabelText(/^Visite technique : Non renseignée\./));
      expect(screen.getByText('Visite technique tous les 6 mois')).toBeTruthy();
      expect(screen.queryByLabelText('Modifier', hidden)).toBeNull();
    });
  });
});
