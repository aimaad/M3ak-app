import { Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { FLEET_GROUPS, type FleetSection, type WeekKind } from './fleet-model';
import { SECTION_LABEL_KEY } from './fleet-card-text';
import { SECTION_DOT, WEEK_COLOR } from './fleet-style';

/** En-tête de section : point coloré, libellé, nombre et filet jusqu'au bord. */
export function FleetSectionHeader({ section, count, late = 0 }: { section: FleetSection; count: number; late?: number }) {
  const { t } = useLanguage();
  return (
    <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 10 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SECTION_DOT[section] }} />
      <MicroLabel size={11} track={0.16}>
        {t(SECTION_LABEL_KEY[section])}
      </MicroLabel>
      <HText weight="semibold" size={11} color={Palette.textSecondary}>
        {String(count)}
      </HText>
      {late > 0 ? (
        <HText weight="bold" size={11} color={Palette.error}>
          {t('flotte.card.sections.lateNote', { count: late })}
        </HText>
      ) : null}
      <View style={{ flex: 1, height: 1, backgroundColor: Palette.border }} />
    </View>
  );
}

/** Légende unique sous la liste : Libre, Loué, Immobilisé, En retard (les couleurs de la frise). */
export function FleetLegend() {
  const { t } = useLanguage();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, paddingTop: 16, paddingBottom: 8, flexWrap: 'wrap' }}>
      {([...FLEET_GROUPS, 'late'] as WeekKind[]).map((group) => (
        <View key={group} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: WEEK_COLOR[group] }} />
          <HText size={11} color={Palette.textSecondary}>
            {t(`flotte.card.legend.${group}`)}
          </HText>
        </View>
      ))}
    </View>
  );
}

/** Squelettes aux dimensions des cartes (chargement). */
export function FleetSkeleton({ count = 3 }: { count?: number }) {
  const block = (width: number | `${number}%`, height: number, radius = 8) => <View style={{ width, height, borderRadius: radius, backgroundColor: Palette.surfaceAlt }} />;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={{ backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, padding: 10, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {block(128, 96, 18)}
            <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 2 }}>
              <View style={{ gap: 8 }}>
                {block('70%', 16)}
                {block(84, 20, 6)}
              </View>
              {block('50%', 12)}
            </View>
          </View>
          <View style={{ gap: 8, paddingHorizontal: 4 }}>
            {block('60%', 12)}
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {Array.from({ length: 7 }, (_, day) => (
                <View key={day} style={{ flex: 1 }}>
                  {block('100%', 8, 4)}
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: Brand.gaugeTrack }}>
            <View style={{ flex: 1 }}>{block('100%', 12)}</View>
            {block(110, 44, 22)}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Message centré (liste vide, aucun résultat, erreur) avec un bouton facultatif. */
export function FleetMessage({ title, body, actionLabel, onAction }: { title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 48, gap: 10 }}>
      <HText font="display" weight="bold" size={18} style={{ textAlign: 'center' }}>
        {title}
      </HText>
      {body ? (
        <HText size={14} color={Palette.textSecondary} style={{ textAlign: 'center' }}>
          {body}
        </HText>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={{ marginTop: 8, minHeight: 48, borderRadius: 24, paddingHorizontal: 24, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
          <HText weight="semibold" size={14} color={Brand.white}>
            {actionLabel}
          </HText>
        </Pressable>
      ) : null}
    </View>
  );
}
