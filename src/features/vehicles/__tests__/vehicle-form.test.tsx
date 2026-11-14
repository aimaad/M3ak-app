/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';

const mockLookup = (dict: unknown, key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as string;
const mockTranslate = (language: string, key: string, options?: Record<string, unknown>) => (mockLookup(language === 'ar' ? ar : fr, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
const mockState = { role: 'owner' as 'owner' | 'manager' | 'employee', branchId: 'b1' as string | null };
const mockRouter = { push: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('@/features/agency/hooks', () => ({
  useMyAgency: () => ({ data: { agencyId: 'a1', role: mockState.role } }),
  useMyProfile: () => ({ data: { branchId: mockState.branchId } }),
}));
jest.mock('@/features/branches/hooks', () => ({ useBranches: () => ({ data: [{ id: 'b1', nom: 'Casa' }, { id: 'b2', nom: 'Rabat' }] }) }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string, o?: Record<string, unknown>) => mockTranslate('fr', key, o) }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { VehicleForm } from '../vehicle-form';
import type { VehicleFormValues } from '../validation';

const values: VehicleFormValues = {
  marque: 'Dacia', modele: 'Logan', immatriculation: '8921 | ب | 14', vin: '', finition: '', annee: '2021', dateMiseEnCirculation: '', puissanceFiscale: '',
  categorie: 'economique', couleur: 'Blanc', nombrePlaces: '5', transmission: null, carburant: 'diesel', kilometrage: '59000', niveauCarburant: '',
  prixJour: '500', prixSemaine: '', prixMois: '', description: '', statut: 'disponible',
};
const setup = (extra: Partial<React.ComponentProps<typeof VehicleForm>> = {}, initial = values) => {
  const onSubmit = jest.fn();
  const view = <VehicleForm initialValues={initial} initialBranchId="b1" vehicleId="v1" submitLabel="Enregistrer" submittingLabel="Enregistrement…" isSubmitting={false} onSubmit={onSubmit} {...extra} />;
  return { onSubmit, view };
};

describe('formulaire de modification du véhicule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockState, { role: 'owner', branchId: 'b1' });
  });

  it('champs rangés en sections : identification, caractéristiques, kilométrage, tarification, disponibilité, description, photos et documents', async () => {
    await render(setup().view);
    for (const title of ['Identification', 'Caractéristiques', 'Kilométrage et carburant', 'Tarification', 'Disponibilité', 'Description', 'Photos et documents']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('rien n’a changé : « Aucune modification » et « Enregistrer » désactivé', async () => {
    await render(setup().view);
    expect(screen.getByText('Aucune modification')).toBeTruthy();
    expect(screen.getByLabelText('Enregistrer').props.accessibilityState.disabled).toBe(true);
  });

  it('après une modification : « Modifications non enregistrées », Enregistrer envoie les valeurs', async () => {
    const { onSubmit, view } = setup();
    await render(view);
    await fireEvent.changeText(screen.getByDisplayValue('Blanc'), 'Gris');
    expect(screen.getByText('Modifications non enregistrées')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ couleur: 'Gris', marque: 'Dacia', kilometrage: 59000, prixJour: 500 });
  });

  it('valeur invalide : bandeau « N champ à corriger », message sous le champ, rien n’est envoyé', async () => {
    const { onSubmit, view } = setup();
    await render(view);
    await fireEvent.changeText(screen.getByDisplayValue('5'), '12');
    await fireEvent.changeText(screen.getByDisplayValue('2021'), '1800');
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(screen.getByText(/2 champs à corriger : /)).toBeTruthy();
    expect(screen.getByText('Entrez un nombre de places entre 1 et 9.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('propriétaire : section Tarification ; employé : ni section, ni prix', async () => {
    mockState.role = 'employee';
    await render(setup().view);
    expect(screen.queryByText('Tarification')).toBeNull();
    expect(screen.queryByDisplayValue('500')).toBeNull();
  });

  it('employé : enregistre sans toucher au prix', async () => {
    mockState.role = 'employee';
    const { onSubmit, view } = setup();
    await render(view);
    await fireEvent.changeText(screen.getByDisplayValue('Blanc'), 'Noir');
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ couleur: 'Noir', prixJour: 500 });
  });

  it('statut géré par les locations : message au lieu des choix', async () => {
    await render(setup({}, { ...values, statut: 'en_location' }).view);
    expect(screen.getByText(/géré automatiquement par le module locations/)).toBeTruthy();
  });

  it('filiale : choix seulement pour un membre sans filiale', async () => {
    mockState.branchId = null;
    await render(setup().view);
    expect(screen.getByText('Rabat')).toBeTruthy();
  });

  it('filiale : le membre sans filiale choisit celle du véhicule', async () => {
    mockState.branchId = null;
    const { onSubmit, view } = setup();
    await render(view);
    await fireEvent.press(screen.getByText('Rabat'));
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ branchId: 'b2' });
  });

  it('filiale : un employé rattaché à une filiale ne la choisit pas', async () => {
    await render(setup().view);
    expect(screen.queryByText('Rabat')).toBeNull();
  });

  it('photos et documents : liens vers l’écran Photos et l’éditeur de documents de la fiche', async () => {
    await render(setup().view);
    await fireEvent.press(screen.getByText('Gérer les photos'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/flotte/[id]/photos', params: { id: 'v1' } });
    await fireEvent.press(screen.getByText('Gérer les documents'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/flotte/[id]', params: { id: 'v1', edit: 'documents' } });
  });

  it('« Annuler » revient en arrière', async () => {
    await render(setup().view);
    await fireEvent.press(screen.getByLabelText('Annuler'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('erreur du serveur affichée dans le bandeau', async () => {
    await render(setup({ submitError: 'Cette immatriculation existe déjà.' }).view);
    expect(screen.getByText('Cette immatriculation existe déjà.')).toBeTruthy();
  });
});
