import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { availableSorts, type FleetSort, type VehicleFilters } from './filters';
import { withAlpha } from './fleet-style';
import type { FuelType, Vehicle, VehicleTransmission } from './types';

export type SheetOptions = { categories: NonNullable<Vehicle['categorie']>[]; brands: string[]; fuels: FuelType[]; transmissions: VehicleTransmission[] };

const sheetChip = (selected: boolean) => ({
  minHeight: 44,
  paddingHorizontal: 16,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: selected ? Brand.graphite : Palette.border,
  backgroundColor: selected ? Brand.graphite : Palette.card,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

function OptionGroup<T extends string>({ title, all, value, values, label, onPick }: { title: string; all: string; value: T | 'all'; values: T[]; label: (v: T) => string; onPick: (v: T | 'all') => void }) {
  if (values.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <MicroLabel size={10} color={Palette.textSecondary}>
        {title}
      </MicroLabel>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {[{ v: 'all' as const, text: all }, ...values.map((v) => ({ v, text: label(v) }))].map(({ v, text }) => (
          <Pressable key={v} onPress={() => onPick(v)} accessibilityRole="button" accessibilityState={{ selected: value === v }} style={sheetChip(value === v)}>
            <HText weight="semibold" size={14} color={value === v ? Brand.white : Palette.textPrimary}>
              {text}
            </HText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Feuille « Filtres et tri » : catégorie, marque, carburant, boîte (seulement les valeurs qui existent dans la flotte), tri, et le lien
 * « Voir les archivés ». Les choix s'appliquent tout de suite ; « Réinitialiser » remet tout à zéro.
 */
export function FiltersSheet({
  visible,
  onClose,
  filters,
  onChange,
  sort,
  onSort,
  options,
  showPrice,
  resultCount,
  onReset,
}: {
  visible: boolean;
  onClose: () => void;
  filters: VehicleFilters;
  onChange: (patch: Partial<VehicleFilters>) => void;
  sort: FleetSort;
  onSort: (sort: FleetSort) => void;
  options: SheetOptions;
  showPrice: boolean;
  resultCount: number;
  onReset: () => void;
}) {
  const { t } = useLanguage();
  const chip = sheetChip;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: withAlpha(Brand.graphite, 0.55) }} onPress={onClose} accessibilityLabel={t('flotte.sheet.close')} />
      <View style={{ backgroundColor: Palette.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, maxHeight: '88%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <HText font="display" weight="bold" size={20} accessibilityRole="header">
            {t('flotte.sheet.title')}
          </HText>
          <Pressable onPress={onReset} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <HText weight="semibold" size={14} color={Palette.primary}>
              {t('flotte.sheet.reset')}
            </HText>
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 8 }}>
          <OptionGroup
            title={t('flotte.sheet.category')}
            all={t('flotte.sheet.all')}
            value={filters.categorie === 'toutes' || !filters.categorie ? 'all' : filters.categorie}
            values={options.categories}
            label={(v) => t(`vehicle.category.${v}`)}
            onPick={(v) => onChange({ categorie: v === 'all' ? 'toutes' : v })}
          />
          <OptionGroup title={t('flotte.sheet.brand')} all={t('flotte.sheet.all')} value={filters.marque === 'toutes' ? 'all' : filters.marque} values={options.brands} label={(v) => v} onPick={(v) => onChange({ marque: v === 'all' ? 'toutes' : v })} />
          <OptionGroup
            title={t('flotte.sheet.fuel')}
            all={t('flotte.sheet.all')}
            value={filters.carburant === 'tous' ? 'all' : filters.carburant}
            values={options.fuels}
            label={(v) => t(`vehicle.fuel.${v}`)}
            onPick={(v) => onChange({ carburant: v === 'all' ? 'tous' : v })}
          />
          <OptionGroup
            title={t('flotte.sheet.transmission')}
            all={t('flotte.sheet.all')}
            value={filters.transmission === 'toutes' ? 'all' : filters.transmission}
            values={options.transmissions}
            label={(v) => t(`vehicle.transmission.${v}`)}
            onPick={(v) => onChange({ transmission: v === 'all' ? 'toutes' : v })}
          />

          <View style={{ gap: 8 }}>
            <MicroLabel size={10} color={Palette.textSecondary}>
              {t('flotte.sheet.sort')}
            </MicroLabel>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {availableSorts(showPrice).map((option) => (
                <Pressable key={option} onPress={() => onSort(option)} accessibilityRole="button" accessibilityState={{ selected: sort === option }} style={chip(sort === option)}>
                  <HText weight="semibold" size={14} color={sort === option ? Brand.white : Palette.textPrimary}>
                    {t(`flotte.sheet.sorts.${option}`)}
                  </HText>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => {
              onChange({ includeArchived: !filters.includeArchived });
              onClose();
            }}
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <HText weight="semibold" size={14} color={Palette.primary}>
              {filters.includeArchived ? t('flotte.sheet.hideArchived') : t('flotte.showArchived')}
            </HText>
          </Pressable>
        </ScrollView>

        <Pressable onPress={onClose} accessibilityRole="button" style={{ marginTop: 12, minHeight: 52, borderRadius: 26, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
          <HText weight="semibold" size={15} color={Brand.white}>
            {t(resultCount === 1 ? 'flotte.sheet.showOne' : 'flotte.sheet.showMany', { count: resultCount })}
          </HText>
        </Pressable>
      </View>
    </Modal>
  );
}
