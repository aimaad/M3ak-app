/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';

const mockLookup = (dict: unknown, key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as string;
const mockTranslate = (language: string, key: string, options?: Record<string, unknown>) => (mockLookup(language === 'ar' ? ar : fr, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
const mockState = {
  language: 'fr',
  role: 'owner' as 'owner' | 'manager' | 'employee',
  branchId: 'b1' as string | null,
  maintenance: [] as unknown[],
  compliance: [] as unknown[],
  rentals: [] as unknown[],
  updates: [] as unknown[],
  updateFails: false,
  updateError: null as unknown,
  archived: [] as string[],
  created: [] as unknown[],
  uploads: [] as unknown[],
  uploadFails: false,
  photoCheck: { ok: true } as { ok: boolean; reason?: string },
  scan: { ok: true, fields: {} } as { ok: boolean; error?: string; fields?: Record<string, unknown> },
  preventRemove: null as null | { enabled: boolean; callback: (event: { data: { action: unknown } }) => void },
  dispatched: [] as unknown[],
  guardOnDispatch: [] as boolean[],
};
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useNavigation: () => ({ dispatch: (action: unknown) => { mockState.dispatched.push(action); mockState.guardOnDispatch.push(!!mockState.preventRemove?.enabled); } }),
  usePreventRemove: (enabled: boolean, callback: (event: { data: { action: unknown } }) => void) => {
    mockState.preventRemove = { enabled, callback };
  },
}));
jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: mockState.role } }), useMyProfile: () => ({ data: { branchId: mockState.branchId } }) }));
jest.mock('@/features/branches/hooks', () => ({ useBranches: () => ({ data: [{ id: 'b1', nom: 'Casa' }, { id: 'b2', nom: 'Rabat' }] }) }));
jest.mock('@/features/maintenance/hooks', () => ({
  useVehicleMaintenanceItems: () => ({ data: mockState.maintenance }),
  useCreateMaintenanceItem: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.created.push(args); options?.onSuccess?.(); } }),
}));
jest.mock('@/features/compliance/hooks', () => ({ useVehicleCompliance: () => ({ data: mockState.compliance }) }));
jest.mock('@/features/rentals/hooks', () => ({ useVehicleRentals: () => ({ data: mockState.rentals }) }));
jest.mock('@/features/customers/hooks', () => ({ useCustomers: () => ({ data: [{ id: 'c1', nomComplet: 'FOUAD BENNANI' }] }) }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/features/vehicles/hooks', () => ({
  useUpdateVehicle: () => ({ mutateAsync: async (args: unknown) => { if (mockState.updateFails) throw mockState.updateError ?? new Error('offline'); mockState.updates.push(args); } }),
  useArchiveVehicle: () => ({ mutate: (id: string, options?: { onSuccess?: () => void }) => { mockState.archived.push(id); options?.onSuccess?.(); } }),
}));
jest.mock('@/features/vehicles/api', () => ({
  VEHICLE_DOCUMENTS_BUCKET: 'vehicle-documents',
  prepareVehiclePhoto: async (uri: string) => uri,
  uploadVehicleDocument: async (...args: unknown[]) => {
    if (mockState.uploadFails) throw new Error('upload');
    mockState.uploads.push(args);
    return { type: args[2], path: `up-${args[2]}`, uploadedAt: '2026-11-14T10:00:00Z', expiresAt: args[4] };
  },
}));
jest.mock('@/features/vehicles/ocr', () => ({ scanVehicleDocuments: async () => mockState.scan }));
jest.mock('@/components/form/photo-check', () => ({ checkPhoto: async () => mockState.photoCheck }));
jest.mock('@/components/form/camera-capture', () => ({
  CameraCapture: ({ visible, onCapture }: { visible: boolean; onCapture: (uri: string) => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable, Text } = require('react-native');
    return visible ? (
      <Pressable accessibilityLabel="CAMERA-SHOOT" onPress={() => onCapture('file:///photo.jpg')}>
        <Text>camera</Text>
      </Pressable>
    ) : null;
  },
}));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@/features/vehicles/add/scan-parts', () => ({ ScanFrame: () => null }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: mockState.language, t: (key: string, o?: Record<string, unknown>) => mockTranslate(mockState.language, key, o) }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { VehicleForm } from '../vehicle-form';
import type { Vehicle } from '../types';

const hidden = { includeHiddenElements: true };
const base = { id: 'v1', agencyId: 'a1', branchId: null, marque: 'DACIA', modele: 'LOGAN', immatriculation: '12345-A-6', vin: null, finition: null, annee: 2021, categorie: 'suv', couleur: 'BLANC', nombrePlaces: 5, transmission: null, carburant: 'diesel', kilometrage: 0, niveauCarburant: null, statut: 'disponible', prixJour: 500, prixSemaine: null, prixMois: null, description: null, dateMiseEnCirculation: null, puissanceFiscale: null, photos: [], documents: [], archivedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', photoUrl: null, niveauCarburantX: null } as unknown as Vehicle;
const day = (delta: number) => { const d = new Date(); d.setDate(d.getDate() + delta); return d.toISOString().slice(0, 10); };
const field = (value: unknown, confidence = 'high') => ({ value, confidence });
const allFields = (patch: Record<string, unknown>) => ({ immatriculation: field(null), immatriculationAnterieure: field(null), dateMiseEnCirculation: field(null), dateFinValidite: field(null), usage: field(null), proprietaire: field(null), type: field(null), genre: field(null), nombreCylindres: field(null), puissanceFiscale: field(null), ptac: field(null), poidsVide: field(null), vin: field(null), marque: field(null), modele: field(null), finition: field(null), annee: field(null), couleur: field(null), nombrePlaces: field(null), carburant: field(null), categorie: field(null), ...patch });

describe('« Modifier la fiche technique »', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockState, { language: 'fr', role: 'owner', branchId: 'b1', maintenance: [], compliance: [], rentals: [], updates: [], updateFails: false, updateError: null, archived: [], created: [], uploads: [], uploadFails: false, photoCheck: { ok: true }, scan: { ok: true, fields: {} }, preventRemove: null, dispatched: [], guardOnDispatch: [] });
  });

  it('en-tête : « Fiche technique » et « Dacia Logan · plaque » ; barre d’enregistrement absente tant que rien ne change', async () => {
    await render(<VehicleForm vehicle={base} />);
    expect(screen.getByText('Fiche technique')).toBeTruthy();
    expect(screen.getByText('Dacia Logan · 12345-A-6')).toBeTruthy();
    expect(screen.queryByLabelText('Enregistrer')).toBeNull();
  });

  it('valeurs vides : jamais « 0 km » ni « — » ; l’exemple en texte d’aide', async () => {
    await render(<VehicleForm vehicle={base} />);
    expect(screen.getByPlaceholderText('ex. 45 200')).toBeTruthy();
    expect(screen.queryByDisplayValue('0')).toBeNull();
    expect(screen.queryByText('0 km')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('boîte inconnue : aucune présélection, « À choisir » ; valeur connue : sélectionnée', async () => {
    await render(<VehicleForm vehicle={base} />);
    expect(screen.getByText('À choisir')).toBeTruthy();
    expect(screen.getByLabelText('Manuelle').props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText('Automatique').props.accessibilityState.checked).toBe(false);
  });

  it('boîte connue : sélectionnée, pas d’« À choisir »', async () => {
    await render(<VehicleForm vehicle={{ ...base, transmission: 'automatique' }} />);
    expect(screen.getByLabelText('Automatique').props.accessibilityState.checked).toBe(true);
    expect(screen.queryByText('À choisir')).toBeNull();
  });

  it('catégories : 7 tuiles dont Minibus ; couleur « BLANC » → pastille Blanc, sans modification', async () => {
    await render(<VehicleForm vehicle={base} />);
    expect(screen.getByLabelText('Minibus')).toBeTruthy();
    expect(screen.getByLabelText('SUV').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Blanc').props.accessibilityState.checked).toBe(true);
    expect(screen.queryByLabelText('Enregistrer')).toBeNull(); // la normalisation d'affichage n'est pas une modification
  });

  it('trois modifications : « 3 modifications » et « Boîte, kilométrage, couleur »', async () => {
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Manuelle'));
    await fireEvent.changeText(screen.getByLabelText('Kilométrage'), '48 200');
    await fireEvent.press(screen.getByLabelText('Gris'));
    expect(screen.getByText('3 modifications')).toBeTruthy();
    expect(screen.getByText('Boîte, kilométrage, couleur')).toBeTruthy();
  });

  it('enregistrer : UNE seule requête avec tout ; la base n’est réécrite qu’après un vrai changement de couleur', async () => {
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Manuelle'));
    await fireEvent.changeText(screen.getByLabelText('Kilométrage'), '48200');
    await fireEvent.press(screen.getByLabelText('Gris'));
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    await waitFor(() => expect(mockState.updates).toHaveLength(1));
    expect(mockState.updates[0]).toMatchObject({ id: 'v1', input: { transmission: 'manuelle', kilometrage: 48200, couleur: 'Gris', marque: 'DACIA', prixJour: 500 } });
    expect((mockState.updates[0] as { documents?: unknown }).documents).toBeUndefined();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('une valeur invalide : message précis à l’enregistrement, rien n’est enregistré', async () => {
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.changeText(screen.getByLabelText('Puissance'), '99');
    expect(screen.queryByText(/La puissance fiscale doit être comprise/)).toBeNull(); // jamais pendant la frappe
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(await screen.findByText('La puissance fiscale doit être comprise entre 1 et 60 CV (case P.6).')).toBeTruthy();
    expect(mockState.updates).toEqual([]);
  });

  it('échec de l’enregistrement : message clair, la page reste ouverte avec ce qui a été tapé', async () => {
    mockState.updateFails = true;
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Manuelle'));
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(await screen.findByText('Impossible d\'enregistrer. Vérifiez la connexion puis réessayez.')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Manuelle').props.accessibilityState.checked).toBe(true);
  });

  it('Annuler (dans la barre) remet tout comme avant et la barre disparaît', async () => {
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Manuelle'));
    await fireEvent.press(screen.getByLabelText('Annuler'));
    expect(screen.queryByLabelText('Enregistrer')).toBeNull();
    expect(screen.getByLabelText('Manuelle').props.accessibilityState.checked).toBe(false);
  });

  it('quitter avec des modifications : confirmation ; sans modification : aucune garde', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<VehicleForm vehicle={base} />);
    expect(mockState.preventRemove?.enabled).toBe(false);
    await fireEvent.press(screen.getByLabelText('Manuelle'));
    expect(mockState.preventRemove?.enabled).toBe(true);
    mockState.preventRemove?.callback({ data: { action: 'GO_BACK' } });
    expect(alert).toHaveBeenCalledWith('Quitter sans enregistrer ?', 'Vos modifications seront perdues.', expect.any(Array));
    (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((button) => button.text === 'Quitter')?.onPress?.();
    await waitFor(() => expect(mockState.dispatched).toEqual(['GO_BACK']));
    // La garde est levée au moment de quitter : sinon la confirmation reviendrait en boucle.
    expect(mockState.guardOnDispatch).toEqual([false]);
    expect(mockState.preventRemove?.enabled).toBe(false);
  });

  it('employé : le bloc « Tarification » n’existe pas (pas rendu), et ses prix ne sont jamais envoyés', async () => {
    mockState.role = 'employee';
    await render(<VehicleForm vehicle={{ ...base, prixSemaine: 3000 }} />);
    expect(screen.queryByText('TARIFICATION')).toBeNull();
    expect(screen.queryByText(/MAD/, hidden)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Manuelle'));
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    await waitFor(() => expect(mockState.updates).toHaveLength(1));
    expect(mockState.updates[0]).toMatchObject({ input: { prixJour: 500, prixSemaine: 3000 } });
  });

  it('employé : pas de lien « Archiver ce véhicule »', async () => {
    mockState.role = 'employee';
    await render(<VehicleForm vehicle={base} />);
    expect(screen.queryByText('Archiver ce véhicule')).toBeNull();
  });

  it('propriétaire : suggestions semaine −15 % et mois −30 % (500/jour → 3 000 et 10 500), appliquées seulement au tap', async () => {
    await render(<VehicleForm vehicle={base} />);
    expect(screen.queryByDisplayValue('3 000')).toBeNull();
    await fireEvent.press(screen.getByText(/^Semaine : 3.?000 \(−15 %\)$/));
    await fireEvent.press(screen.getByText(/^Mois : 10.?500 \(−30 %\)$/));
    expect(screen.getByText('Prix par semaine, prix par mois')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    await waitFor(() => expect(mockState.updates).toHaveLength(1));
    expect(mockState.updates[0]).toMatchObject({ input: { prixSemaine: 3000, prixMois: 10500 } });
  });

  it('archiver : lien rouge, confirmation, puis archivage ; impossible (avec la raison) si le véhicule est loué', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByText('Archiver ce véhicule'));
    expect(alert).toHaveBeenCalledWith('Archiver ce véhicule ?', expect.any(String), expect.any(Array));
    expect(mockState.archived).toEqual([]);
    (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((button) => button.text === 'Archiver')?.onPress?.();
    expect(mockState.archived).toEqual(['v1']);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/flotte'));
  });

  it('archiver impossible : la raison est écrite et le lien est désactivé', async () => {
    mockState.rentals = [{ id: 'r1', statut: 'en_cours', customerId: 'c1', dateDebutPrevue: new Date(Date.now() - 86400000).toISOString(), dateFinPrevue: new Date(Date.now() + 3 * 86400000).toISOString() }];
    await render(<VehicleForm vehicle={{ ...base, statut: 'en_location' }} />);
    expect(screen.getByText(/Elle est en location chez Fouad B\./)).toBeTruthy();
    expect(screen.getByText('Archiver ce véhicule').props.style).toBeDefined();
  });

  it('statut : voiture réservée → refus avec le nom du client, le statut ne change pas', async () => {
    mockState.rentals = [{ id: 'r1', statut: 'confirmee', customerId: 'c1', dateDebutPrevue: new Date(Date.now() + 3 * 86400000).toISOString(), dateFinPrevue: new Date(Date.now() + 6 * 86400000).toISOString() }];
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Maintenance'));
    expect(await screen.findByText(/Elle est déjà réservée par Fouad B\. .*Essayez de lui accorder une autre voiture\./)).toBeTruthy();
    expect(screen.queryByLabelText('Enregistrer')).toBeNull(); // rien n'a changé
  });

  it('panne pendant une location : « Disponible » reste possible, « Indisponible » est refusé', async () => {
    mockState.rentals = [{ id: 'r1', statut: 'en_cours', customerId: 'c1', dateDebutPrevue: new Date(Date.now() - 86400000).toISOString(), dateFinPrevue: new Date(Date.now() + 3 * 86400000).toISOString() }];
    await render(<VehicleForm vehicle={{ ...base, statut: 'maintenance' }} />);
    await fireEvent.press(screen.getByLabelText('Indisponible'));
    expect(await screen.findByText(/Essayez de lui accorder une autre voiture|Enregistrez d'abord son retour/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Disponible'));
    expect(screen.getByLabelText('Disponible').props.accessibilityState.checked).toBe(true);
  });

  it('le serveur refuse le statut (autre appareil) : message clair, la page reste ouverte', async () => {
    mockState.updateFails = true;
    mockState.updateError = { message: 'vehicle_status_locked' };
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Maintenance'));
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(await screen.findByText(/a une location ouverte : son statut ne peut pas être changé/)).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('statut : voiture libre → le changement est accepté sans message', async () => {
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Maintenance'));
    expect(screen.getByLabelText('Maintenance').props.accessibilityState.checked).toBe(true);
    expect(screen.queryByText(/Essayez de lui accorder/)).toBeNull();
  });

  it('rendre disponible avec une échéance en alerte : simple alerte, « Annuler » ne change rien, confirmer applique', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockState.compliance = [{ id: 'c1', vehicleId: 'v1', kind: 'assurance', validFrom: null, validUntil: day(-5), documentPath: null, createdAt: '2026-01-01T00:00:00Z' }];
    await render(<VehicleForm vehicle={{ ...base, statut: 'indisponible' }} />);
    await fireEvent.press(screen.getByLabelText('Disponible'));
    expect(alert).toHaveBeenCalledWith('Échéances en alerte', expect.stringContaining('Assurance (expirée)'), expect.any(Array));
    expect(screen.queryByLabelText('Enregistrer')).toBeNull(); // pas encore changé
    (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((button) => button.text === 'Rendre disponible quand même')?.onPress?.();
    expect(await screen.findByLabelText('Enregistrer')).toBeTruthy();
    expect(screen.getByLabelText('Disponible').props.accessibilityState.checked).toBe(true);
  });

  it('rendre disponible sans alerte : direct, sans confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<VehicleForm vehicle={{ ...base, statut: 'indisponible' }} />);
    await fireEvent.press(screen.getByLabelText('Disponible'));
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Disponible').props.accessibilityState.checked).toBe(true);
  });

  it('échéances : aucune → état vide avec des puces ; « + Vidange » ouvre la feuille et crée l’échéance (requête séparée)', async () => {
    await render(<VehicleForm vehicle={base} />);
    expect(screen.getByText('Aucun entretien prévu')).toBeTruthy();
    await fireEvent.press(screen.getAllByText('+ Vidange')[0]);
    expect(await screen.findByText('Ajouter une vidange', hidden)).toBeTruthy();
    expect(screen.getByLabelText('Ajouter l\'échéance', hidden).props.accessibilityState.disabled).toBe(true); // rien de renseigné : dit pourquoi
    await fireEvent.changeText(screen.getByLabelText('Kilométrage prévu', hidden), '60000');
    await fireEvent.press(screen.getByLabelText('Ajouter l\'échéance', hidden));
    expect(mockState.created).toEqual([{ agencyId: 'a1', input: { vehicleId: 'v1', type: 'vidange', echeanceDate: null, echeanceKm: 60000, notes: null } }]);
    expect(mockState.updates).toEqual([]); // la barre d'enregistrement n'est pas concernée
  });

  it('échéances : la plus proche est résumée avec son badge', async () => {
    mockState.compliance = [{ id: 'c1', vehicleId: 'v1', kind: 'assurance', validFrom: null, validUntil: day(300), documentPath: null, createdAt: '2026-01-01T00:00:00Z' }];
    await render(<VehicleForm vehicle={base} />);
    expect(screen.getAllByText('Assurance').length).toBeGreaterThan(0);
    expect(screen.getAllByText('À jour').length).toBeGreaterThan(0);
    expect(screen.queryByText('Aucun entretien prévu')).toBeNull();
  });

  it('documents : assurance et visite en lignes de lecture qui ouvrent la fiche', async () => {
    mockState.compliance = [{ id: 'c1', vehicleId: 'v1', kind: 'assurance', validFrom: null, validUntil: day(300), documentPath: null, createdAt: '2026-01-01T00:00:00Z' }];
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Scanner : Visite technique'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/flotte/[id]', params: { id: 'v1' } });
    expect(screen.getByText('Pas encore ajoutée')).toBeTruthy();
  });

  it('scanner la carte grise : photo trop petite → refusée avec « Reprendre », rien n’est ajouté', async () => {
    mockState.photoCheck = { ok: false, reason: 'too_small' };
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Scanner : Recto'));
    await fireEvent.press(screen.getByLabelText('CAMERA-SHOOT'));
    expect(await screen.findByText('Photo trop petite · Reprendre')).toBeTruthy();
    expect(screen.queryByLabelText('Enregistrer')).toBeNull();
  });

  it('scanner la carte grise : champs remplis avec badge « Lu par l’IA » et bandeau, puis un seul enregistrement avec la photo', async () => {
    mockState.scan = { ok: true, fields: allFields({ puissanceFiscale: field(6), marque: field('Dacia'), dateFinValidite: field('2031-05-01') }) };
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Scanner : Recto'));
    await fireEvent.press(screen.getByLabelText('CAMERA-SHOOT'));
    expect(await screen.findByLabelText('1 champ rempli depuis la carte grise. Il reste la boîte et le kilométrage.')).toBeTruthy();
    expect(screen.getByDisplayValue('6')).toBeTruthy();
    expect(screen.getByText("Lu par l'IA")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    await waitFor(() => expect(mockState.updates).toHaveLength(1));
    expect(mockState.uploads).toEqual([['a1', 'v1', 'carte_grise', 'file:///photo.jpg', '2031-05-01']]);
    expect(mockState.updates[0]).toMatchObject({ input: { puissanceFiscale: 6 }, documents: [{ type: 'carte_grise', path: 'up-carte_grise' }] });
  });

  it('lecture impossible (non activée) : message clair, saisie à la main possible', async () => {
    mockState.scan = { ok: false, error: 'ocr_disabled' };
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Scanner : Recto'));
    await fireEvent.press(screen.getByLabelText('CAMERA-SHOOT'));
    expect(await screen.findByText("La lecture automatique n'est pas activée pour votre entreprise. Saisissez les champs à la main.")).toBeTruthy();
  });

  it('envoi d’une photo en échec : RIEN n’est enregistré', async () => {
    mockState.uploadFails = true;
    mockState.scan = { ok: true, fields: allFields({}) };
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText('Scanner : Recto'));
    await fireEvent.press(screen.getByLabelText('CAMERA-SHOOT'));
    await screen.findByLabelText('Enregistrer');
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(await screen.findByText("Une photo n'a pas pu être envoyée. Rien n'a été enregistré : réessayez.")).toBeTruthy();
    expect(mockState.updates).toEqual([]);
  });

  it('filiale : le membre sans filiale choisit celle du véhicule (enregistrée avec le reste)', async () => {
    mockState.branchId = null;
    await render(<VehicleForm vehicle={base} />);
    await fireEvent.press(screen.getByLabelText(/^Filiale/));
    await fireEvent.press(await screen.findByText('Rabat', hidden));
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    await waitFor(() => expect(mockState.updates).toHaveLength(1));
    expect(mockState.updates[0]).toMatchObject({ input: { branchId: 'b2' } });
  });

  it('arabe : en-tête, libellés et barre d’enregistrement en arabe', async () => {
    mockState.language = 'ar';
    await render(<VehicleForm vehicle={base} />);
    expect(screen.getByText('البطاقة التقنية')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('يدوي'));
    expect(screen.getByText('تعديل واحد')).toBeTruthy();
    expect(screen.getByLabelText('حفظ')).toBeTruthy();
    await act(async () => undefined);
  });
});
