import { useState, type ReactNode } from 'react';
import { Image, View, type DimensionValue } from 'react-native';

import { Brand } from '@/constants/theme';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

import { VEHICLE_PHOTOS_BUCKET } from './api';
import type { Vehicle } from './types';

// Image par défaut : l'avant d'une voiture de nuit, feux allumés, sur fond graphite. Affichée quand le véhicule n'a pas de photo.
const DEFAULT_IMAGE = require('../../../assets/images/voiture-par-defaut.png');

export type VehicleImageSource = Pick<Vehicle, 'marque' | 'modele' | 'photos'>;

/** Nom affiché d'un véhicule (« Dacia Logan »). */
export const vehicleName = (vehicle: Pick<Vehicle, 'marque' | 'modele'>) => `${vehicle.marque} ${vehicle.modele}`.trim();

/** Le véhicule a-t-il au moins une photo enregistrée ? (sert au petit appareil photo de la carte) */
export const hasVehiclePhoto = (vehicle: Pick<Vehicle, 'photos'>) => vehicle.photos.length > 0;

/**
 * Photo principale du véhicule ; à défaut, l'image par défaut (`cover` sur fond graphite). Composant partagé : liste, galerie, fiche.
 * `children` se pose par-dessus (badge de statut, bouton photo). La taille se règle par `width` / `height` / `radius`.
 */
export function VehicleImage({
  vehicle,
  width = '100%',
  height,
  radius = 18,
  children,
}: {
  vehicle: VehicleImageSource;
  width?: DimensionValue;
  height: number;
  radius?: number;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const firstPhoto = vehicle.photos[0]?.path;
  const { data: photoUrl } = useSignedUrl(VEHICLE_PHOTOS_BUCKET, firstPhoto);
  // Si la photo ne se charge pas (hors ligne, lien expiré), on retombe sur l'image par défaut plutôt que sur un cadre vide.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const useRemote = !!photoUrl && failedUrl !== photoUrl;
  const name = vehicleName(vehicle);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t(firstPhoto ? 'vehicle.image.photo' : 'vehicle.image.none', { name })}
      style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: Brand.graphite }}
    >
      {/* Position absolue : la taille d'origine de l'image n'élargit jamais la carte (important sur le web). */}
      <Image
        testID="vehicle-image"
        source={useRemote ? { uri: photoUrl } : DEFAULT_IMAGE}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        resizeMode="cover"
        onError={() => photoUrl && setFailedUrl(photoUrl)}
      />
      {children}
    </View>
  );
}
