import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Palette } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { FLEET_GROUPS, type FleetCounts, type FleetGroup, type FleetItem } from './fleet-model';
import { plateSpoken, plateText } from './fleet-card';
import { GROUP_ON_DARK, withAlpha } from './fleet-style';
import { fleetName } from './fleet-model';
import { VehicleImage } from './vehicle-image';

/** En-tête compact de la galerie : « N VÉHICULES », « Ma flotte », bouton liste, « + » et pastilles de statut. */
export function GalleryHeader({
  counts,
  group,
  onToggleGroup,
  onList,
  onAdd,
}: {
  counts: FleetCounts;
  group: FleetGroup | null;
  onToggleGroup: (group: FleetGroup) => void;
  onList: () => void;
  onAdd: () => void;
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const circle = { width: 44, height: 44, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: Brand.strokeOnDark };
  const pill = (selected: boolean) => ({
    flexShrink: 0,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    ...(selected ? { backgroundColor: Brand.white } : { borderWidth: 1, borderColor: Brand.strokeOnDark }),
  });
  const entries: { key: FleetGroup | null; label: string; count: number }[] = [
    { key: null, label: t('flotte.gallery.all'), count: counts.total },
    ...FLEET_GROUPS.map((key) => ({ key, label: t(`flotte.header.groups.${key}`), count: counts[key] })),
  ];
  return (
    <View style={{ backgroundColor: Brand.graphite, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 20, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 4, flex: 1 }}>
          <MicroLabel size={11} track={0.16} color={Brand.mutedOnDark}>
            {t(counts.total === 1 ? 'flotte.gallery.countOne' : 'flotte.gallery.countMany', { count: counts.total })}
          </MicroLabel>
          <HText font="display" weight="bold" size={28} color={Brand.white} accessibilityRole="header">
            {t('flotte.title')}
          </HText>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={onList} accessibilityRole="button" accessibilityLabel={t('flotte.header.list')} style={circle}>
            <Ionicons name="list-outline" size={20} color={Brand.white} />
          </Pressable>
          <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={t('flotte.addVehicleA11y')} style={[circle, { backgroundColor: Brand.surfaceOnDark }]}>
            <Ionicons name="add" size={22} color={Brand.white} />
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0" contentContainerStyle={{ gap: 8, paddingEnd: 20 }} style={{ marginEnd: -20 }}>
        {entries.map((entry) => {
          const selected = entry.key === group;
          return (
            <Pressable
              key={entry.key ?? 'all'}
              onPress={() => (entry.key === null ? (group !== null ? onToggleGroup(group) : undefined) : onToggleGroup(entry.key))}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t('flotte.header.tileA11y', { label: entry.label, count: entry.count })}
              style={pill(selected)}
            >
              <HText weight="semibold" size={13} color={selected ? Brand.graphite : Brand.textOnDark}>
                {entry.label}
              </HText>
              <View style={{ borderRadius: 9, paddingHorizontal: 7, paddingVertical: 1, backgroundColor: selected ? Brand.orange : Brand.borderOnDark }}>
                <HText weight="semibold" size={11} color={Brand.white}>
                  {String(entry.count)}
                </HText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Carte de la galerie : image, pastille de statut, nom, immatriculation et prix (propriétaire seulement). */
export function GalleryCard({ item, showPrice, onOpen }: { item: FleetItem; showPrice: boolean; onOpen: () => void }) {
  const { t } = useLanguage();
  const { vehicle, group } = item;
  const name = fleetName(vehicle);
  // Libellé au singulier, comme sur la carte de la liste (« Disponible », « En location », « À inspecter », « En retard »).
  const statusKey = item.late ? 'late' : item.section;
  const status = t(`flotte.card.status.${statusKey}`);
  const plate = plateText(vehicle.immatriculation);
  const price = showPrice && vehicle.prixJour > 0 ? vehicle.prixJour : null;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t('flotte.gallery.cardA11y', { name, status, plate: plateSpoken(vehicle.immatriculation) })}
      style={{ flex: 1, minWidth: 0, gap: 10 }}
    >
      <VehicleImage vehicle={vehicle} height={118} radius={18}>
        <View
          style={{
            position: 'absolute',
            start: 8,
            top: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: withAlpha(Brand.graphite, 0.88),
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: item.late ? Brand.errorOnDark : GROUP_ON_DARK[group] }} />
          <HText weight="semibold" size={11} color={Brand.white}>
            {status}
          </HText>
        </View>
      </VehicleImage>
      <View style={{ gap: 5, paddingHorizontal: 2 }}>
        <HText font="display" weight="bold" size={14} numberOfLines={1}>
          {name}
        </HText>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <View style={{ flexShrink: 1, minWidth: 0, borderWidth: 1.5, borderColor: Brand.graphite, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
            <HText weight="semibold" size={10} track={0.04} numberOfLines={1}>
              {plate}
            </HText>
          </View>
          {price !== null ? (
            <HText weight="bold" size={13} style={{ flexShrink: 0 }}>
              {`${price} `}
              <HText weight="medium" size={10} color={Palette.textSecondary}>
                {t('flotte.gallery.perDay')}
              </HText>
            </HText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
