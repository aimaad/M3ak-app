import { useState } from 'react';
import { FlatList, Image, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ZoomableImage } from '@/components/zoomable-image';
import { Brand } from '@/constants/theme';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

import { VEHICLE_PHOTOS_BUCKET } from '../api';
import type { VehiclePhoto } from '../types';
import { DEFAULT_VEHICLE_IMAGE } from '../vehicle-image';

function Slide({ photo, width, height, alt }: { photo: VehiclePhoto; width: number; height: number; alt: string }) {
  const { data: url } = useSignedUrl(VEHICLE_PHOTOS_BUCKET, photo.path);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Image source={DEFAULT_VEHICLE_IMAGE} accessibilityLabel={alt} style={{ width, height }} resizeMode="cover" />;
  return (
    <View style={{ width, height }} accessibilityLabel={alt}>
      <ZoomableImage uri={url} label={alt} style={{ width, height }} />
      {/* Si la photo ne se charge pas, l'image par défaut prend la place */}
      <Image source={{ uri: url }} style={{ width: 1, height: 1, opacity: 0 }} onError={() => setFailed(true)} />
    </View>
  );
}

/** Dégradé graphite en haut (pour les boutons) et en bas (pour le texte) : la photo se fond dans l'en-tête. */
export function PhotoFade() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="photoFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Brand.graphite} stopOpacity={0.55} />
            <Stop offset="0.22" stopColor={Brand.graphite} stopOpacity={0} />
            <Stop offset="0.48" stopColor={Brand.graphite} stopOpacity={0} />
            <Stop offset="0.92" stopColor={Brand.graphite} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#photoFade)" />
      </Svg>
    </View>
  );
}

/**
 * Photos du véhicule : on glisse d'une photo à l'autre (points de pagination, le point actif est plus long), un tap ouvre la photo en plein
 * écran. Sans photo : l'image par défaut. L'ordre est celui de la liste (la première est la principale).
 */
export function PhotoPager({ photos, width, height, name, onIndex }: { photos: VehiclePhoto[]; width: number; height: number; name: string; onIndex?: (index: number) => void }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const alt = (photo: VehiclePhoto) => (photo.angle ? t('vehicleDetail.photoAlt', { angle: t(`vehicleDetail.angles.${photo.angle}`), name }) : t('vehicleDetail.photoAltNoAngle', { name }));

  function onEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(next);
    onIndex?.(next);
  }

  return (
    <View style={{ width, height }}>
      {photos.length === 0 ? (
        <Image source={DEFAULT_VEHICLE_IMAGE} accessibilityLabel={t('vehicle.image.none', { name })} style={{ width, height }} resizeMode="cover" />
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(photo) => photo.path}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onEnd}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: position }) => <Slide photo={item} width={width} height={height} alt={`${alt(item)}${photos.length > 1 ? `, ${t('vehicleDetail.pagerA11y', { n: position + 1, total: photos.length })}` : ''}`} />}
        />
      )}
      <PhotoFade />
      {photos.length > 1 ? (
        <View pointerEvents="none" style={{ position: 'absolute', start: 0, end: 0, bottom: 70, flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {photos.map((photo, position) => (
            <View key={photo.path} style={{ width: position === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: Brand.white, opacity: position === index ? 1 : 0.45 }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
