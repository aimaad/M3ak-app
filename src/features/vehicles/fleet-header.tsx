import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Brand, Palette } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { FleetRing } from './fleet-ring';
import { FLEET_GROUPS, type FleetCounts, type FleetGroup } from './fleet-model';
import { GROUP_ON_DARK, withAlpha } from './fleet-style';
import { DEFAULT_VEHICLE_IMAGE } from './vehicle-image';

function Tile({ group, count, late, selected, onPress }: { group: FleetGroup; count: number; late: number; selected: boolean; onPress: () => void }) {
  const { t } = useLanguage();
  const label = t(`flotte.header.groups.${group}`);
  const color = GROUP_ON_DARK[group];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={late > 0 ? t('flotte.header.tileA11yLate', { label, count, late }) : t('flotte.header.tileA11y', { label, count })}
      style={{
        flex: 1,
        height: 84,
        borderRadius: 18,
        paddingTop: 14,
        paddingHorizontal: 12,
        paddingBottom: 12,
        justifyContent: 'flex-end',
        gap: 6,
        backgroundColor: selected ? Brand.borderOnDark : withAlpha(Brand.surfaceOnDark, 0.88),
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? Brand.orange : Brand.strokeOnDark,
        ...(selected ? { shadowColor: Brand.orange, shadowOpacity: 0.28, shadowRadius: 11, shadowOffset: { width: 0, height: 8 } } : {}),
      }}
    >
      {/* Petit trait coloré lumineux en haut à l'angle. */}
      <View style={{ position: 'absolute', start: 12, top: 12, width: 22, height: 4, borderRadius: 2, backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
      {/* Pastille « N en retard » sur la tuile En location (le chiffre compte toutes les locations, retards compris). */}
      {late > 0 ? (
        <View style={{ position: 'absolute', end: 8, top: 8, backgroundColor: Palette.error, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
          <HText weight="bold" size={10} color={Brand.white} numberOfLines={1} style={{ lineHeight: 13 }}>
            {t('flotte.header.tileLate', { count: late }).replace(/ /g, '\u00a0')}
          </HText>
        </View>
      ) : null}
      <HText font="display" weight="bold" size={24} color={Brand.white} style={{ lineHeight: 24 }}>
        {String(count)}
      </HText>
      <MicroLabel size={10} track={0.1} color={Brand.mutedOnDark} numberOfLines={1} style={{ lineHeight: 13 }}>
        {label}
      </MicroLabel>
    </Pressable>
  );
}

/**
 * En-tête graphite de Ma Flotte : photo (image par défaut) sous un voile radial, nom de l'agence, « Ma flotte », boutons galerie
 * et ajout, chiffre clé, anneau de répartition, 3 tuiles de statut qui filtrent, recherche, puis (enfant) le conseil BIBIP.
 */
export function FleetHeader({
  agencyName,
  counts,
  group,
  onToggleGroup,
  query,
  onQueryChange,
  onOpenFilters,
  onAdd,
  onGallery,
  onLatePress,
  children,
}: {
  agencyName: string;
  counts: FleetCounts;
  group: FleetGroup | null;
  onToggleGroup: (group: FleetGroup) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenFilters: () => void;
  onAdd: () => void;
  onGallery?: () => void;
  /** Tap sur « N retour(s) en retard » : filtre sur « En location ». */
  onLatePress?: () => void;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const circle = { width: 44, height: 44, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const };
  const ready =
    counts.free === 0 ? t('flotte.header.readyNone') : counts.free === 1 ? t('flotte.header.readyOne') : t('flotte.header.readyMany', { count: counts.free });

  return (
    <View style={{ backgroundColor: Brand.graphite, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden', paddingBottom: 22 }}>
      {/* Photo de fond sous un voile radial sombre (lisibilité du texte) */}
      <View pointerEvents="none" style={{ position: 'absolute', start: 0, end: 0, top: 70 + insets.top, height: 244 }}>
        <Image source={DEFAULT_VEHICLE_IMAGE} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.9 }} resizeMode="cover" accessibilityElementsHidden importantForAccessibility="no" />
        <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id="fleetVeil" cx="50%" cy="55%" rx="60%" ry="50%">
              <Stop offset="0" stopColor={Brand.orange} stopOpacity={0} />
              <Stop offset="0.8" stopColor={Brand.graphite} stopOpacity={0.55} />
              <Stop offset="1" stopColor={Brand.graphite} stopOpacity={0.55} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fleetVeil)" />
        </Svg>
      </View>

      {/* Haut : agence, titre, boutons */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ gap: 4, flex: 1 }}>
          <MicroLabel size={11} track={0.18} color={Brand.mutedOnDark} numberOfLines={1}>
            {agencyName}
          </MicroLabel>
          <HText font="display" weight="bold" size={30} track={-0.01} color={Brand.white} style={{ lineHeight: 36 }} accessibilityRole="header">
            {t('flotte.title')}
          </HText>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {onGallery ? (
            <Pressable onPress={onGallery} accessibilityRole="button" accessibilityLabel={t('flotte.header.gallery')} style={[circle, { borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: withAlpha(Brand.surfaceOnDark, 0.7) }]}>
              <Ionicons name="grid-outline" size={18} color={Brand.white} />
            </Pressable>
          ) : null}
          <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={t('flotte.addVehicleA11y')} style={[circle, { backgroundColor: Brand.orange, shadowColor: Brand.orange, shadowOpacity: 0.45, shadowRadius: 9, shadowOffset: { width: 0, height: 6 } }]}>
            <Ionicons name="add" size={22} color={Brand.white} />
          </Pressable>
        </View>
      </View>

      {/* Chiffre clé et anneau */}
      <View style={{ height: 150, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 6, paddingBottom: 4, flexShrink: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <HText font="display" weight="bold" size={56} track={-0.03} color={Brand.white} style={{ lineHeight: 56 }}>
              {String(counts.total)}
            </HText>
            <HText weight="medium" size={15} color={Brand.textOnDark}>
              {t(counts.total === 1 ? 'flotte.header.vehiclesOne' : 'flotte.header.vehiclesMany')}
            </HText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.successOnDark, shadowColor: Brand.successOnDark, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
            <HText weight="medium" size={12} color={Brand.mutedOnDark}>
              {ready}
            </HText>
          </View>
          {counts.late > 0 ? (
            <Pressable
              onPress={onLatePress}
              accessibilityRole="button"
              accessibilityLabel={t('flotte.header.lateLineA11y', { count: counts.late })}
              hitSlop={10}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.errorOnDark, shadowColor: Brand.errorOnDark, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
              <HText weight="semibold" size={12} color={Brand.errorOnDark}>
                {counts.late === 1 ? t('flotte.header.lateLineOne') : t('flotte.header.lateLineMany', { count: counts.late })}
              </HText>
            </Pressable>
          ) : null}
        </View>
        <FleetRing counts={counts} />
      </View>

      {/* Tuiles de statut : ce sont les filtres */}
      <View style={{ paddingTop: 18, paddingHorizontal: 20, flexDirection: 'row', gap: 8 }}>
        {FLEET_GROUPS.map((key) => (
          <Tile key={key} group={key} count={counts[key]} late={key === 'rented' ? counts.late : 0} selected={group === key} onPress={() => onToggleGroup(key)} />
        ))}
      </View>

      {/* Recherche et feuille Filtres et tri */}
      <View style={{ marginTop: 14, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark, borderRadius: 18, paddingVertical: 4, paddingStart: 14, paddingEnd: 4 }}>
        <Ionicons name="search" size={17} color={Brand.mutedOnDark} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('flotte.searchPlaceholder')}
          placeholderTextColor={Brand.mutedOnDark}
          accessibilityLabel={t('flotte.header.searchA11y')}
          testID="flotte-search"
          returnKeyType="search"
          style={{ flex: 1, minWidth: 0, height: 42, color: Brand.white, fontSize: 14 }}
        />
        <Pressable onPress={onOpenFilters} accessibilityRole="button" accessibilityLabel={t('flotte.header.filtersAndSort')} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: Brand.borderOnDark, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="options-outline" size={17} color={Brand.white} />
        </Pressable>
      </View>

      {children ? <View style={{ marginTop: 12, marginHorizontal: 20 }}>{children}</View> : null}
    </View>
  );
}
