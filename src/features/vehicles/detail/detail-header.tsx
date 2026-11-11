import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

import { PlateDisplay } from '../add/plate-display';
import { lateBadgeText } from '../fleet-card-text';
import { withAlpha } from '../fleet-style';
import type { Vehicle } from '../types';
import { displayName } from './names';
import { PhotoPager } from './photo-pager';
import type { StatusBadge } from './state-card';

const BADGE: Record<StatusBadge['tone'], { background: string; text: string }> = {
  free: { background: Palette.success, text: Brand.white },
  rented: { background: Brand.textOnDark, text: Brand.graphite },
  late: { background: Palette.error, text: Brand.white },
  warning: { background: Brand.warningOnDark, text: Brand.graphite },
  muted: { background: Palette.textMuted, text: Brand.white },
};

/** Cercle de 44 px sur la photo (retour, partager, plus d'actions). */
export function HeaderCircle({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: withAlpha(Brand.graphite, 0.7), alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={18} color={Brand.white} />
    </Pressable>
  );
}

/**
 * En-tête photo de la fiche (fond graphite, coins bas arrondis 36) : photo en grand qui se fond dans l'en-tête, boutons fixes (retour,
 * partager, plus d'actions), bouton « Photos », puis badge de statut, nom, plaque marocaine et « catégorie · carburant · année ».
 * Le contenu qui suit (carte d'état) vient en enfant, encore sur le fond graphite.
 */
export function DetailHeader({
  vehicle,
  badge,
  photoCount,
  onBack,
  onShare,
  onMore,
  onPhotos,
  children,
}: {
  vehicle: Vehicle;
  badge: StatusBadge | null;
  photoCount: number;
  onBack: () => void;
  onShare: () => void;
  onMore: () => void;
  onPhotos: () => void;
  children?: ReactNode;
}) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const name = displayName(vehicle);
  const height = 430;
  const meta = [vehicle.categorie ? t(`vehicle.category.${vehicle.categorie}`) : '', t(`vehicle.fuel.${vehicle.carburant}`), vehicle.annee ? String(vehicle.annee) : ''].filter(Boolean).join(' · ');
  const tone = badge ? BADGE[badge.tone] : null;
  const badgeText = badge ? `${t(badge.labelKey)}${badge.late ? ` ${lateBadgeText(badge.late, t)}` : ''}` : vehicle.archivedAt ? t('vehicleDetail.archivedBadge') : '';
  const photosA11y = photoCount === 0 ? t('vehicleDetail.photosA11yNone') : photoCount === 1 ? t('vehicleDetail.photosA11yOne') : t('vehicleDetail.photosA11yMany', { count: photoCount });

  return (
    <View style={{ backgroundColor: Brand.graphite, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', paddingBottom: 22 }}>
      <View style={{ height }}>
        <PhotoPager photos={vehicle.photos} width={width} height={350 + insets.top} name={name} />

        <View style={{ position: 'absolute', start: 20, end: 20, top: insets.top + 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <HeaderCircle icon={isRTL(language) ? 'chevron-forward' : 'chevron-back'} label={t('vehicleDetail.back')} onPress={onBack} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <HeaderCircle icon="share-outline" label={t('vehicleDetail.share')} onPress={onShare} />
            <HeaderCircle icon="ellipsis-horizontal" label={t('vehicleDetail.more')} onPress={onMore} />
          </View>
        </View>

        <Pressable
          onPress={onPhotos}
          accessibilityRole="button"
          accessibilityLabel={photosA11y}
          style={{ position: 'absolute', end: 20, top: 290 + insets.top * 0, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: withAlpha(Brand.graphite, 0.8), paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}
        >
          <Ionicons name="camera-outline" size={14} color={Brand.white} />
          <HText weight="semibold" size={12} color={Brand.white}>
            {t('vehicleDetail.photosButton')}
          </HText>
        </Pressable>

        <View style={{ position: 'absolute', start: 20, end: 20, bottom: 6, gap: 10 }}>
          {tone ? (
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: tone.background }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone.text }} />
              <HText weight="bold" size={12} color={tone.text}>
                {badgeText}
              </HText>
            </View>
          ) : badgeText ? (
            <View style={{ alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Palette.textMuted }}>
              <HText weight="bold" size={12} color={Brand.white}>
                {badgeText}
              </HText>
            </View>
          ) : null}
          <HText font="display" weight="bold" size={34} color={Brand.white} track={-0.02} style={{ lineHeight: 38 }} numberOfLines={2} accessibilityRole="header">
            {name}
          </HText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ borderRadius: 9, borderWidth: 1.5, borderColor: Brand.white, padding: 0 }}>
              <PlateDisplay plate={vehicle.immatriculation} size={15} />
            </View>
            <HText size={13} color={Brand.mutedOnDark}>
              {meta}
            </HText>
          </View>
        </View>
      </View>
      {children ? <View style={{ marginTop: 18, marginHorizontal: 20, gap: 14 }}>{children}</View> : null}
    </View>
  );
}
