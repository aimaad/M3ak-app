import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';
import type { Rental } from '@/features/rentals/types';

import { actionFor, canAddVehiclePhoto, canSeePrices, contextOf } from '../fleet-card';
import { cardSentence, contextTexts } from '../fleet-card-text';
import { buildFleetItems, type FleetItem } from '../fleet-model';
import { FleetVehicleCard } from '../fleet-vehicle-card';
import type { Vehicle } from '../types';

// Vraies traductions françaises : la phrase lue par le lecteur d'écran est vérifiée telle que l'utilisateur l'entend.
const lookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;
const t = (key: string, options?: Record<string, unknown>) => (lookup(key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../api', () => ({ VEHICLE_PHOTOS_BUCKET: 'vehicle-photos' }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string, o?: Record<string, unknown>) => mockT(key, o) }) }));
const mockT = (key: string, o?: Record<string, unknown>) => t(key, o);

const NOW = new Date(2030, 5, 10, 12, 0, 0); // lundi 10 juin 2030
const at = (delta: number, hour = 9) => new Date(2030, 5, 10 + delta, hour).toISOString();
const sandero = { id: 'a', marque: 'Dacia', modele: 'Sandero', immatriculation: '68013 | ب | 72', statut: 'en_location', kilometrage: 1500, prixJour: 500, photos: [], archivedAt: null } as unknown as Vehicle;
const libre = { ...sandero, id: 'b', modele: 'Troc 2025', statut: 'disponible', immatriculation: '8921-ب-14' } as Vehicle;
const rentals = [{ id: 'r1', vehicleId: 'a', customerId: 'c1', statut: 'en_cours', dateDebutPrevue: at(-2), dateFinPrevue: at(7, 18), dateDepartReel: at(-2), dateRetourReel: null }, { id: 'old', vehicleId: 'a', customerId: 'c1', statut: 'terminee', dateDebutPrevue: at(-20), dateFinPrevue: at(-12), dateDepartReel: at(-20), dateRetourReel: at(-12) }] as Rental[];
const items = buildFleetItems({ vehicles: [sandero, libre], rentals, maintenance: [], now: NOW });
// Le contenu du corps de la carte est caché au lecteur d'écran (il lit la phrase complète à la place) : on l'inspecte tel qu'il s'affiche.
const hidden = { includeHiddenElements: true };
const itemOf = (id: string) => items.find((i) => i.vehicle.id === id) as FleetItem;
const data = { customers: new Map([['c1', { nomComplet: 'Youssef Alami' }]]), rentals: new Map(rentals.map((r) => [r.id, r])), maintenance: [] };
const cardData = { rentals: data.rentals, customers: new Map([['c1', { telephone: '+212600000000' }]]) };

async function renderCard(id: string, role: 'owner' | 'manager' | 'employee', overrides: Partial<React.ComponentProps<typeof FleetVehicleCard>> = {}) {
  const handlers = { onOpen: jest.fn(), onAction: jest.fn(), onAddPhoto: jest.fn() };
  const item = itemOf(id);
  const result = await render(
    <FleetVehicleCard item={item} context={contextOf(item, data)} action={actionFor(item, role, rentals, NOW, cardData)} showPrice={canSeePrices(role)} canAddPhoto={canAddVehiclePhoto(role)} {...handlers} now={NOW} {...overrides} />
  );
  return { handlers, ...result };
}

describe('carte véhicule', () => {
  it('lue en une phrase : nom, plaque, statut, client, retour, occupation', async () => {
    const item = itemOf('a');
    expect(cardSentence(item, contextOf(item, data), 'fr', t, NOW)).toBe('Dacia Sandero, 68013 ب 72, en location chez Youssef A., retour lundi 17 juin, occupation 40 pour cent');
    await renderCard('a', 'owner');
    expect(screen.getByLabelText(/Dacia Sandero, 68013 ب 72, en location chez Youssef A\./)).toBeTruthy();
  });

  it('plaque marocaine dans l’ordre numéro | lettre | région', async () => {
    await renderCard('a', 'owner');
    // ThemedText entoure déjà la lettre arabe d'une marque invisible (src/lib/plate.ts) : on compare le texte sans ces marques.
    const plate = screen.getByText(/68013/, hidden);
    expect(String(plate.props.children).replace(/[\u200E\u200F]/g, '')).toBe('68013 | ب | 72');
    expect(screen.getByText(/1\s?500 km/, hidden)).toBeTruthy();
  });

  it('le prix est montré au propriétaire', async () => {
    await renderCard('a', 'owner');
    expect(screen.queryAllByText(/MAD\/j/, hidden).length).toBeGreaterThan(0);
  });

  it('le prix est caché à l’employé (et au responsable)', async () => {
    await renderCard('a', 'employee');
    expect(screen.queryAllByText(/MAD\/j/, hidden)).toHaveLength(0);
  });

  it('un tap sur la carte ouvre la fiche ; le bouton d’action fait son action SANS ouvrir la fiche', async () => {
    const { handlers } = await renderCard('b', 'owner');
    await fireEvent.press(screen.getByLabelText(/Dacia Troc 2025, 8921 ب 14/));
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);
    expect(handlers.onAction).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Louer : Dacia Troc 2025'));
    expect(handlers.onAction).toHaveBeenCalledTimes(1);
    expect(handlers.onAction.mock.calls[0][0]).toMatchObject({ kind: 'rent' });
    expect(handlers.onOpen).toHaveBeenCalledTimes(1); // pas déclenché une seconde fois
  });

  it('« Prolonger » : proposé au responsable', async () => {
    await renderCard('a', 'manager');
    expect(screen.getByLabelText('Prolonger : Dacia Sandero')).toBeTruthy();
  });

  it('« Prolonger » : pas de bouton pour l’employé', async () => {
    await renderCard('a', 'employee');
    expect(screen.queryByLabelText(/Prolonger/)).toBeNull();
  });

  it('sans photo : rond appareil photo (frère du corps de la carte) qui ouvre l’ajout de photo seulement', async () => {
    const { handlers } = await renderCard('a', 'employee');
    await fireEvent.press(screen.getByLabelText('Ajouter une photo pour la Dacia Sandero'));
    expect(handlers.onAddPhoto).toHaveBeenCalledTimes(1);
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it('pas d’appareil photo si l’utilisateur n’a pas le droit d’en ajouter', async () => {
    await renderCard('a', 'employee', { canAddPhoto: false });
    expect(screen.queryByLabelText(/Ajouter une photo/)).toBeNull();
  });

  it('pas d’appareil photo si le véhicule a déjà une photo', async () => {
    const withPhoto = { ...itemOf('a'), vehicle: { ...sandero, photos: [{ path: 'p', uploadedAt: at(0) }] } } as FleetItem;
    await renderCard('a', 'owner', { item: withPhoto });
    expect(screen.queryByLabelText(/Ajouter une photo/)).toBeNull();
  });

  // Un véhicule en retard à côté d'une location normale : retour prévu dimanche 2 juin à 18 h, on est le lundi 10 juin à midi → 8 jours.
  const lateRentals = [{ id: 'r9', vehicleId: 'a', customerId: 'c1', statut: 'en_cours', dateDebutPrevue: at(-12), dateFinPrevue: at(-8, 18), dateDepartReel: at(-12), dateRetourReel: null }] as Rental[];
  const lateItem = () => buildFleetItems({ vehicles: [sandero], rentals: lateRentals, maintenance: [], now: NOW })[0];
  const lateData = () => ({ ...data, rentals: new Map(lateRentals.map((r) => [r.id, r])) });

  it('location en retard : « prévu » avec le mois, pastille « +8 j » insécable, retard dit en toutes lettres à voix haute', async () => {
    const item = lateItem();
    const context = contextOf(item, lateData());
    expect(context).toMatchObject({ kind: 'rented', late: { amount: 8, unit: 'days' } });
    expect(contextTexts(context, 'fr', t, NOW).display).toBe('Youssef A. · prévu dim. 2 juin');
    expect(cardSentence(item, context, 'fr', t, NOW)).toBe('Dacia Sandero, en retard de 8 jours, prévue le dimanche 2 juin, client Youssef A.');
    await render(<FleetVehicleCard item={item} context={context} action={actionFor(item, 'employee', [], NOW, { ...cardData, rentals: lateData().rentals })} showPrice={false} canAddPhoto={false} onOpen={jest.fn()} onAction={jest.fn()} onAddPhoto={jest.fn()} now={NOW} />);
    const badge = screen.getByText(/^\+8/, hidden);
    expect(String(badge.props.children)).toBe('+8\u00a0j'); // jamais coupée entre le nombre et « j »
    expect(screen.getByText('En retard', hidden)).toBeTruthy(); // badge sur la photo
    expect(screen.getByText('Youssef A. · prévu dim. 2 juin', hidden)).toBeTruthy();
  });

  it('en retard : le bouton « Appeler » est proposé à l’employé aussi, et appelle sans ouvrir la fiche', async () => {
    const item = lateItem();
    const handlers = { onOpen: jest.fn(), onAction: jest.fn(), onAddPhoto: jest.fn() };
    await render(<FleetVehicleCard item={item} context={contextOf(item, lateData())} action={actionFor(item, 'employee', [], NOW, { ...cardData, rentals: lateData().rentals })} showPrice={false} canAddPhoto={false} {...handlers} now={NOW} />);
    await fireEvent.press(screen.getByLabelText('Appeler : Dacia Sandero'));
    expect(handlers.onAction).toHaveBeenCalledWith({ kind: 'call', href: { pathname: '/locations/[id]', params: { id: 'r9' } }, phone: '+212600000000' });
    expect(handlers.onOpen).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/Prolonger/)).toBeNull();
  });

  it('retard de moins de 24 h : « +3 h » et « 3 heures » ; « 1 jour » au singulier', () => {
    const short = (due: Date) => {
      const rs = [{ id: 'r8', vehicleId: 'a', customerId: 'c1', statut: 'en_cours', dateDebutPrevue: at(-3), dateFinPrevue: due.toISOString(), dateDepartReel: at(-3), dateRetourReel: null }] as Rental[];
      const item = buildFleetItems({ vehicles: [sandero], rentals: rs, maintenance: [], now: NOW })[0];
      return cardSentence(item, contextOf(item, { ...data, rentals: new Map(rs.map((r) => [r.id, r])) }), 'fr', t, NOW);
    };
    expect(short(new Date(2030, 5, 10, 9))).toContain('en retard de 3 heures');
    expect(short(new Date(2030, 5, 9, 12))).toContain('en retard de 1 jour');
  });

  it('la frise a un résumé lu à voix haute', async () => {
    await renderCard('b', 'owner');
    expect(screen.getByLabelText('7 prochains jours : libre toute la semaine', hidden)).toBeTruthy();
  });
});
