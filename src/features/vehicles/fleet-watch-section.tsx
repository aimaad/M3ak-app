import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import type { WatchIcon, WatchItem } from './fleet-watch';

const ICON: Record<WatchIcon, keyof typeof Ionicons.glyphMap> = {
  shield: 'shield-checkmark-outline',
  calendar: 'calendar-outline',
  wrench: 'construct-outline',
  document: 'document-text-outline',
};

function WatchCard({ item, width, onOpen }: { item: WatchItem; width: number | '100%'; onOpen: () => void }) {
  const { t } = useLanguage();
  const title = t(item.source === 'maintenance' ? `maintenance.types.${item.type}` : `vehicle.documents.${item.type}`);
  const due =
    item.due.kind === 'expired' ? t('flotte.watch.expired') : item.due.kind === 'km' ? t('flotte.watch.dueKm', { km: item.due.km.toLocaleString('fr-FR') }) : item.due.days === 0 ? t('flotte.watch.dueToday') : t('flotte.watch.dueDays', { days: item.due.days });
  const hot = item.urgency === 'hot';
  const expired = item.urgency === 'expired';
  const accent = expired ? Palette.error : hot ? Brand.orange : Brand.graphite;
  const dueColor = expired ? Palette.error : hot ? Brand.orangeUrgentText : Palette.textPrimary;
  const boxColor = expired ? Palette.errorSoft : hot ? Brand.orange : Palette.surface;
  const iconColor = expired ? Palette.error : hot ? Brand.white : Brand.graphite;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t('flotte.watch.cardA11y', { title, vehicle: item.vehicleName, due })}
      style={{ width, minHeight: 44, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 20, padding: 14, gap: 12, shadowColor: Palette.shadow, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: boxColor, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={ICON[item.icon]} size={17} color={iconColor} />
        </View>
        <HText font="display" weight="bold" size={15} color={dueColor}>
          {due}
        </HText>
      </View>
      <View style={{ gap: 2 }}>
        <HText weight="semibold" size={14} numberOfLines={1}>
          {title}
        </HText>
        <HText size={12} color={Palette.textSecondary} numberOfLines={1}>
          {item.vehicleName}
        </HText>
      </View>
      {/* Barre d'urgence : d'autant plus pleine que l'échéance est proche. */}
      <View style={{ height: 5, borderRadius: 3, backgroundColor: '#EEF0F0', overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ width: `${Math.round(item.fill * 100)}%`, borderRadius: 3, backgroundColor: accent }} />
      </View>
    </Pressable>
  );
}

/**
 * « À SURVEILLER » : documents et entretiens qui arrivent à échéance (30 jours ou 1 000 km) ou dépassés, cartes qui défilent
 * horizontalement ; « Tout voir » les déplie en liste. Masqué s'il n'y a rien. Un tap ouvre la section concernée de la fiche.
 */
export function FleetWatchSection({ items, onOpen }: { items: WatchItem[]; onOpen: (item: WatchItem) => void }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  return (
    <View style={{ paddingTop: 24, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="header">
          <MicroLabel size={11} track={0.16}>
            {t('flotte.watch.title')}
          </MicroLabel>
          <View style={{ backgroundColor: Palette.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
            <HText weight="semibold" size={11} color={Brand.white} style={{ lineHeight: 15 }}>
              {String(items.length)}
            </HText>
          </View>
        </View>
        <Pressable onPress={() => setExpanded((value) => !value)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <HText weight="semibold" size={13}>
            {t(expanded ? 'flotte.watch.collapse' : 'flotte.watch.seeAll')}
          </HText>
        </Pressable>
      </View>

      {expanded ? (
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {items.map((item) => (
            <WatchCard key={item.key} item={item} width="100%" onOpen={() => onOpen(item)} />
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
          renderItem={({ item }) => <WatchCard item={item} width={214} onOpen={() => onOpen(item)} />}
        />
      )}
    </View>
  );
}
