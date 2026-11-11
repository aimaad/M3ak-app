import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

import { VEHICLE_PHOTOS_BUCKET } from '../api';
import type { PhotoAngle, VehiclePhoto } from '../types';
import { DEFAULT_VEHICLE_IMAGE } from '../vehicle-image';

type IconName = keyof typeof Ionicons.glyphMap;

/** Photo d'un bucket privé (lien signé) ; l'image par défaut si elle ne se charge pas. */
export function PhotoImage({ photo, style, label }: { photo: VehiclePhoto; style: object; label?: string }) {
  const { data: url } = useSignedUrl(VEHICLE_PHOTOS_BUCKET, photo.path);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Image source={DEFAULT_VEHICLE_IMAGE} accessibilityLabel={label} style={[style, { opacity: url ? 1 : 0.4 }]} resizeMode="cover" />;
  return <Image source={{ uri: url }} accessibilityLabel={label} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

const ANGLE_ICON: Record<PhotoAngle, IconName> = {
  avant: 'car-sport-outline',
  arriere: 'car-sport-outline',
  cote_gauche: 'car-outline',
  cote_droit: 'car-outline',
  interieur: 'speedometer-outline',
  coffre: 'cube-outline',
  autre: 'images-outline',
};

export function AngleIcon({ angle, size }: { angle: PhotoAngle; size: number }) {
  return <Ionicons name={ANGLE_ICON[angle]} size={size} color={Brand.slotIconOnDark} />;
}

/** Un emplacement de la grille des angles : photo (étoile si principale, rang en haut), ou pointillés si elle reste à prendre. */
export function SlotTile({
  angle,
  photo,
  position,
  main,
  selected,
  onPress,
  onLongPress,
}: {
  angle: PhotoAngle;
  photo: VehiclePhoto | null;
  position: number | null;
  main: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { t } = useLanguage();
  const label = t(`vehiclePhotos.angleLabel.${angle}`);
  const a11y = !photo ? t('vehiclePhotos.slotTodo', { angle: label }) : main ? t('vehiclePhotos.slotMain', { angle: label }) : t('vehiclePhotos.slotAdded', { angle: label });
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11y}
      style={{
        flexBasis: '30%',
        flexGrow: 1,
        height: 96,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: photo ? Brand.graphite : Brand.slotEmptyOnDark,
        borderWidth: selected ? 2.5 : photo ? 1 : 1.5,
        borderStyle: photo || selected ? 'solid' : 'dashed',
        borderColor: selected ? Palette.primary : photo ? Brand.panelStrokeOnDark : Brand.slotDashOnDark,
      }}
    >
      {photo ? <PhotoImage photo={photo} style={{ position: 'absolute', width: '100%', height: '100%' }} /> : <AngleIcon angle={angle} size={28} />}
      {photo && position !== null ? (
        <View accessibilityLabel={t('vehiclePhotos.position', { n: position })} style={{ position: 'absolute', start: 6, top: 6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
          <HText weight="bold" size={10} color={Brand.white}>
            {String(position)}
          </HText>
        </View>
      ) : null}
      {main ? (
        <View style={{ position: 'absolute', end: 6, top: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: Brand.warningOnDark, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="star" size={12} color={Brand.graphite} />
        </View>
      ) : null}
      <HText weight="bold" size={10} color={photo ? Brand.white : Brand.mutedOnDark} style={{ position: 'absolute', start: 6, bottom: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: photo ? 'rgba(32,37,39,0.85)' : 'transparent', overflow: 'hidden' }}>
        {label}
      </HText>
    </Pressable>
  );
}

/** Bouton carré de l'écran Photos (64 px) : icône + libellé court. */
export function ActionButton({ icon, label, onPress, tone = 'neutral', disabled = false }: { icon: IconName; label: string; onPress: () => void; tone?: 'neutral' | 'main' | 'danger'; disabled?: boolean }) {
  const palette = tone === 'main' ? { bg: Brand.mainFillOnDark, border: Brand.warningOnDark, ink: Brand.warningOnDark } : tone === 'danger' ? { bg: Brand.dangerFillOnDark, border: Brand.dangerStrokeOnDark, ink: Brand.errorOnDark } : { bg: Brand.surfaceOnDark, border: Brand.strokeOnDark, ink: Brand.white };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{ flex: 1, height: 64, borderRadius: 16, borderWidth: 1, backgroundColor: palette.bg, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', gap: 4 }}
    >
      <Ionicons name={icon} size={18} color={palette.ink} />
      <HText weight="semibold" size={11} color={palette.ink}>
        {label}
      </HText>
    </Pressable>
  );
}
