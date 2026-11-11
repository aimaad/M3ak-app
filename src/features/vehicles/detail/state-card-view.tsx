import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { ArrowIcon, HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import type { StateAction, StateCard as StateCardModel, StateKind } from './state-card';

const ICON: Record<StateKind, { name: keyof typeof Ionicons.glyphMap; background: string; ink: string }> = {
  free: { name: 'checkmark', background: Palette.success, ink: Brand.white },
  rented: { name: 'time-outline', background: Brand.textOnDark, ink: Brand.graphite },
  late: { name: 'alert-circle-outline', background: Palette.error, ink: Brand.white },
  inspect: { name: 'clipboard-outline', background: Brand.warningOnDark, ink: Brand.graphite },
  preparation: { name: 'clipboard-outline', background: Brand.warningOnDark, ink: Brand.graphite },
  maintenance: { name: 'construct-outline', background: Brand.warningOnDark, ink: Brand.graphite },
  unavailable: { name: 'ban-outline', background: Palette.textMuted, ink: Brand.white },
};

const BUTTON: Record<StateAction['tone'], object> = {
  orange: { backgroundColor: Brand.orange, shadowColor: Brand.orange, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } },
  red: { backgroundColor: Palette.error, shadowColor: Palette.error, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } },
  graphite: { backgroundColor: Brand.graphite, borderWidth: 1, borderColor: Brand.strokeOnDark },
  neutral: { backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark },
};

/** Carte d'état (fond sombre) : icône, titre, détail, barre de progression éventuelle, puis les boutons (principal 1,4× et secondaire). */
export function StateCardView({ card, name, onAction }: { card: StateCardModel; name: string; onAction: (action: StateAction) => void }) {
  const { t } = useLanguage();
  const late = card.kind === 'late';
  const icon = ICON[card.kind];
  const labelOf = (action: StateAction) => (action.id === 'call' && !action.labelParams?.name ? t('vehicleDetail.action.callNoName') : t(action.labelKey, action.labelParams));
  const title = t(card.title.key, card.title.params);
  const detail = card.detail ? t(card.detail.key, card.detail.params) : null;
  const barColor = card.progress?.tone === 'late' ? Brand.errorOnDark : Brand.textOnDark;

  return (
    <View style={{ gap: 14 }}>
      <View accessible accessibilityLabel={[title, detail].filter(Boolean).join('. ')} style={{ borderRadius: 22, padding: 16, gap: 14, backgroundColor: late ? Brand.errorDeep : Brand.surfaceOnDark, borderWidth: 1, borderColor: late ? Palette.error : Brand.strokeOnDark }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: icon.background, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon.name} size={20} color={icon.ink} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <HText weight="semibold" size={15} color={Brand.white} style={{ lineHeight: 20 }}>
              {title}
            </HText>
            {detail ? (
              <HText size={12} color={Brand.mutedOnDark} style={{ lineHeight: 17 }}>
                {detail}
              </HText>
            ) : null}
          </View>
        </View>
        {card.progress ? (
          <View style={{ gap: 6 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: Brand.strokeOnDark, overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ width: `${Math.min(100, Math.max(0, card.progress.percent))}%`, borderRadius: 3, backgroundColor: barColor }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <HText size={11} color={Brand.mutedOnDark}>
                {t(card.progress.left.key, card.progress.left.params)}
              </HText>
              <HText size={11} weight={late ? 'bold' : 'regular'} color={late ? Brand.errorOnDark : Brand.mutedOnDark}>
                {t(card.progress.right.key, card.progress.right.params)}
              </HText>
            </View>
          </View>
        ) : null}
      </View>

      {card.actions.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {card.actions.map((action, index) => {
            const primary = index === 0 && card.actions.length > 1;
            return (
              <Pressable
                key={action.id}
                onPress={() => onAction(action)}
                accessibilityRole="button"
                accessibilityLabel={`${labelOf(action)} : ${name}`}
                style={[{ flex: primary ? 1.4 : 1, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 }, BUTTON[index === 0 ? action.tone : action.tone === 'orange' ? 'orange' : 'neutral']]}
              >
                <HText weight="semibold" size={14} color={Brand.white} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {labelOf(action)}
                </HText>
                {index === 0 && action.id !== 'makeUnavailable' ? <ArrowIcon color={Brand.white} size={16} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
