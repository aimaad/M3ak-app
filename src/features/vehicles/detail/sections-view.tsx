import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { formatAmount, HText } from '@/features/dashboard/home-ui';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

import { VEHICLE_DOCUMENTS_BUCKET } from '../api';
import { VEHICLE_DOCUMENT_TYPES, type Vehicle, type VehicleDocumentType } from '../types';
import type { HistoryEvent } from './history';
import type { SpecKey, SpecTile } from './specs';

const CARD = { backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, padding: 16 } as const;
type IconName = keyof typeof Ionicons.glyphMap;

function SectionHeader({ title, actionLabel, onAction, actionA11y }: { title: string; actionLabel?: string; onAction?: () => void; actionA11y?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
      <HText font="display" weight="bold" size={17} accessibilityRole="header">
        {title}
      </HText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionA11y ?? actionLabel} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
          <HText weight="semibold" size={12} color={Brand.orangeUrgentText}>
            {actionLabel}
          </HText>
        </Pressable>
      ) : null}
    </View>
  );
}

const shortDate = (iso: string, language: string) => new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short' });

// ------------------------------------------------------------------ fiche technique

const SPEC_ICON: Record<SpecKey, IconName> = {
  categorie: 'car-outline',
  transmission: 'settings-outline',
  carburant: 'water-outline',
  kilometrage: 'speedometer-outline',
  couleur: 'color-palette-outline',
  annee: 'calendar-outline',
  nombrePlaces: 'people-outline',
  puissanceFiscale: 'flash-outline',
};

export function SpecsGrid({ tiles, description, onEdit, onTile }: { tiles: SpecTile[]; description: string | null; onEdit: () => void; onTile: (tile: SpecTile) => void }) {
  const { t } = useLanguage();
  const valueOf = (tile: SpecTile): string => {
    if (tile.valueKey) return t(tile.valueKey);
    if (tile.key === 'kilometrage') return `${formatAmount(Number(tile.value))} ${t('flotte.km')}`;
    if (tile.key === 'puissanceFiscale') return t('vehicleDetail.specs.power', { n: tile.value });
    return String(tile.value);
  };
  return (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('vehicleDetail.specs.title')} actionLabel={t('vehicleDetail.specs.edit')} onAction={onEdit} actionA11y={t('vehicleDetail.editor.editA11y', { section: t('vehicleDetail.specs.title') })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tiles.map((tile) => {
          const label = t(`vehicleDetail.specs.${tile.key}`);
          const value = tile.missing ? t('vehicleDetail.specs.toComplete') : valueOf(tile);
          return (
            <Pressable
              key={tile.key}
              onPress={() => onTile(tile)}
              accessibilityRole="button"
              accessibilityLabel={tile.missing ? t('vehicleDetail.specs.a11yMissing', { label }) : t('vehicleDetail.specs.a11yValue', { label, value })}
              style={{
                flexGrow: 1,
                flexBasis: '45%',
                minHeight: 60,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 12,
                borderRadius: 18,
                backgroundColor: Brand.white,
                borderWidth: tile.missing ? 1.5 : 1,
                borderStyle: tile.missing ? 'dashed' : 'solid',
                borderColor: tile.missing ? Palette.primary : Palette.border,
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: Palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={SPEC_ICON[tile.key]} size={17} color={Brand.graphite} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <HText size={11} color={Palette.textSecondary}>
                  {label}
                </HText>
                <HText weight="bold" size={14} numberOfLines={1} color={tile.missing ? Brand.orangeUrgentText : Palette.textPrimary}>
                  {value}
                </HText>
              </View>
            </Pressable>
          );
        })}
      </View>
      {description ? (
        <HText size={13} color={Palette.textSecondary} style={{ lineHeight: 19, paddingHorizontal: 2 }}>
          {description}
        </HText>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ historique

const EVENT_STYLE = {
  rental: { icon: 'swap-horizontal' as IconName, background: Brand.graphite, ink: Brand.white },
  inspection: { icon: 'checkmark-done-outline' as IconName, background: Palette.successSoft, ink: Palette.success },
  maintenance: { icon: 'construct-outline' as IconName, background: Palette.surfaceAlt, ink: Brand.graphite },
};

export function describeEvent(event: HistoryEvent, t: (key: string, params?: Record<string, unknown>) => string, language: string): { title: string; sub: string; amount: string | null } {
  switch (event.kind) {
    case 'rental':
      return {
        title: event.name ? t('vehicleDetail.history.rental', { name: event.name }) : t('vehicleDetail.history.rentalNoName'),
        sub:
          event.days == null
            ? t('vehicleDetail.history.rentalSubNoDays', { from: shortDate(event.from, language), to: shortDate(event.to, language) })
            : t(event.days === 1 ? 'vehicleDetail.history.rentalSubOne' : 'vehicleDetail.history.rentalSub', { from: shortDate(event.from, language), to: shortDate(event.to, language), days: event.days }),
        amount: event.amount != null ? t('vehicleDetail.history.amount', { amount: formatAmount(event.amount) }) : null,
      };
    case 'inspection': {
      const date = shortDate(event.at, language);
      return {
        title: t(event.type === 'depart' ? 'vehicleDetail.history.inspectionDepart' : 'vehicleDetail.history.inspectionRetour'),
        sub: event.damageCount === 0 ? t('vehicleDetail.history.noDamage', { date }) : event.damageCount === 1 ? t('vehicleDetail.history.damageOne', { date }) : t('vehicleDetail.history.damageMany', { date, count: event.damageCount }),
        amount: null,
      };
    }
    default: {
      const date = shortDate(event.at, language);
      return {
        title: t(`maintenance.types.${event.type}`),
        sub: event.garage ? t('vehicleDetail.history.maintenanceSubGarage', { date, garage: event.garage }) : t('vehicleDetail.history.maintenanceSub', { date }),
        amount: event.amount != null ? t('vehicleDetail.history.amount', { amount: formatAmount(event.amount) }) : null,
      };
    }
  }
}

/** Frise verticale des événements (sans cadre : l'appelant fournit la carte ou l'écran). */
export function HistoryList({ events, onOpen }: { events: HistoryEvent[]; onOpen: (event: HistoryEvent) => void }) {
  const { t, language } = useLanguage();
  return (
    <View>
      {events.map((event, index) => {
        const style = EVENT_STYLE[event.kind];
        const { title, sub, amount } = describeEvent(event, t, language);
        return (
          <Pressable key={event.key} onPress={() => onOpen(event)} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.history.a11y', { title, sub: [sub, amount].filter(Boolean).join(' · ') })} style={{ flexDirection: 'row', gap: 12, minHeight: 56 }}>
            <View style={{ alignItems: 'center', width: 30 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: style.background }}>
                <Ionicons name={style.icon} size={14} color={style.ink} />
              </View>
              <View style={{ flex: 1, width: 2, backgroundColor: index === events.length - 1 ? 'transparent' : Palette.border }} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2, paddingBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <HText weight="semibold" size={14} style={{ flexShrink: 1 }}>
                  {title}
                </HText>
                {amount ? (
                  <HText weight="bold" size={13}>
                    {amount}
                  </HText>
                ) : null}
              </View>
              <HText size={12} color={Palette.textSecondary}>
                {sub}
              </HText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function HistoryCard({ events, onOpen, onSeeAll }: { events: HistoryEvent[]; onOpen: (event: HistoryEvent) => void; onSeeAll: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={[CARD, { gap: 10 }]}>
      <SectionHeader title={t('vehicleDetail.history.title')} actionLabel={events.length > 0 ? t('vehicleDetail.history.seeAll') : undefined} onAction={onSeeAll} />
      {events.length === 0 ? (
        <HText size={13} color={Palette.textSecondary}>
          {t('vehicleDetail.history.empty')}
        </HText>
      ) : (
        <HistoryList events={events} onOpen={onOpen} />
      )}
    </View>
  );
}

// ------------------------------------------------------------------ documents

function DocumentThumb({ vehicle, type, onOpen, onAdd }: { vehicle: Vehicle; type: VehicleDocumentType; onOpen: (url: string, label: string) => void; onAdd: () => void }) {
  const { t } = useLanguage();
  const document = vehicle.documents.find((doc) => doc.type === type);
  const { data: url } = useSignedUrl(VEHICLE_DOCUMENTS_BUCKET, document?.path);
  const label = t(`vehicle.documents.${type}`);
  if (!document) {
    return (
      <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={`${label}. ${t('vehicleDetail.documents.missing')}`} style={{ width: 112, gap: 8 }}>
        <View style={{ height: 78, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Palette.textMuted, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="camera-outline" size={24} color={Palette.textSecondary} />
        </View>
        <HText weight="semibold" size={12}>
          {label}
        </HText>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={() => url && onOpen(url, label)} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.documents.open', { label })} style={{ width: 112, gap: 8 }}>
      <View style={{ height: 78, borderRadius: 16, backgroundColor: Brand.surfaceOnDark, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {url ? <Image source={{ uri: url }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" /> : <Ionicons name="document-text-outline" size={26} color={Brand.white} />}
      </View>
      <HText weight="semibold" size={12}>
        {label}
      </HText>
    </Pressable>
  );
}

/** Rangée de vignettes des documents du véhicule : photo si elle existe (appui = plein écran), sinon « Ajouter la photo ». */
export function DocumentsRow({ vehicle, onAdd }: { vehicle: Vehicle; onAdd: () => void }) {
  const { t } = useLanguage();
  const [viewing, setViewing] = useState<{ url: string; label: string } | null>(null);
  return (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('vehicleDetail.documents.title')} actionLabel={t('vehicleDetail.specs.edit')} onAction={onAdd} actionA11y={t('vehicleDetail.editor.editA11y', { section: t('vehicleDetail.documents.title') })} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {VEHICLE_DOCUMENT_TYPES.map((type) => (
          <DocumentThumb key={type} vehicle={vehicle} type={type} onOpen={(url, label) => setViewing({ url, label })} onAdd={onAdd} />
        ))}
        <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.documents.add')} style={{ width: 112, gap: 8 }}>
          <View style={{ height: 78, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Palette.textMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={26} color={Palette.textSecondary} />
          </View>
          <HText weight="semibold" size={12}>
            {t('vehicleDetail.documents.add')}
          </HText>
        </Pressable>
      </ScrollView>
      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {viewing ? <Image source={{ uri: viewing.url }} accessibilityLabel={viewing.label} style={{ width: '100%', height: '80%' }} resizeMode="contain" /> : null}
          <Pressable onPress={() => setViewing(null)} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.documents.viewerClose')} style={{ marginTop: 16, minHeight: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: Brand.white, justifyContent: 'center' }}>
            <HText weight="semibold">{t('vehicleDetail.close')}</HText>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
