import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { hasVehiclePhoto, VehicleImage, vehicleName } from '../vehicle-image';

let mockSignedUrl: string | undefined;
jest.mock('../api', () => ({ VEHICLE_PHOTOS_BUCKET: 'vehicle-photos' }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: mockSignedUrl }) }));
jest.mock('@/i18n/use-language', () => ({
  useLanguage: () => ({
    language: 'fr',
    t: (key: string, o?: { name?: string }) => (key === 'vehicle.image.photo' ? `Photo de la ${o?.name}` : key === 'vehicle.image.none' ? `Aucune photo pour la ${o?.name}` : key),
  }),
}));

const withPhoto = { marque: 'Dacia', modele: 'Logan', photos: [{ path: 'a/b.jpg', uploadedAt: '2030-01-01' }] };
const without = { marque: 'Dacia', modele: 'Sandero', photos: [] };

describe('VehicleImage', () => {
  beforeEach(() => {
    mockSignedUrl = undefined;
  });

  it('sans photo : image par défaut et libellé « Aucune photo »', async () => {
    await render(<VehicleImage vehicle={without} height={96} />);
    expect(screen.getByLabelText('Aucune photo pour la Dacia Sandero')).toBeTruthy();
    const source = screen.getByTestId('vehicle-image').props.source;
    expect(source.uri).toBeUndefined(); // l'image par défaut, pas une adresse distante
  });

  it('avec photo : la photo du véhicule et libellé « Photo de la … »', async () => {
    mockSignedUrl = 'https://exemple.test/photo.jpg';
    await render(<VehicleImage vehicle={withPhoto} height={96} />);
    expect(screen.getByLabelText('Photo de la Dacia Logan')).toBeTruthy();
    expect(screen.getByTestId('vehicle-image').props.source).toEqual({ uri: 'https://exemple.test/photo.jpg' });
  });

  it('photo qui ne se charge pas : retour à l’image par défaut', async () => {
    mockSignedUrl = 'https://exemple.test/cassee.jpg';
    await render(<VehicleImage vehicle={withPhoto} height={96} />);
    await fireEvent(screen.getByTestId('vehicle-image'), 'error');
    expect(screen.getByTestId('vehicle-image').props.source.uri).toBeUndefined();
  });

  it('pose les enfants (badge, bouton photo) par-dessus', async () => {
    await render(
      <VehicleImage vehicle={without} height={96}>
        <Text>Disponible</Text>
      </VehicleImage>
    );
    expect(screen.getByText('Disponible')).toBeTruthy();
  });

  it('nom et présence de photo', () => {
    expect(vehicleName(withPhoto)).toBe('Dacia Logan');
    expect(vehicleName({ marque: 'Troc', modele: '' })).toBe('Troc');
    expect(hasVehiclePhoto(withPhoto)).toBe(true);
    expect(hasVehiclePhoto(without)).toBe(false);
  });
});
