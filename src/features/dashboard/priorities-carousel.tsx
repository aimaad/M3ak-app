import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import type { Priority, PriorityKind } from './priorities';
import { PRIORITY_ROUTE, visiblePriorities } from './priorities';
import { ArrowIcon, ArrowLink, formatAmount, HText, MicroLabel } from './home-ui';

const CARD_WIDTH = 236;
const GAP = 12;

const COLOR: Record<PriorityKind, string> = {
  late: Brand.errorOnDark,
  unpaid: Brand.warningOnDark,
  documents: Brand.warningOnDark,
  maintenance: Brand.warningOnDark,
  stopped: Brand.mutedOnDark,
};


/**
 * « Priorités » : ce qui est anormal aujourd'hui, en cartes graphite qui défilent. 3 cartes au maximum ; le compteur donne le
 * total et « Analyse → » mène à la liste complète. Sans priorité : une seule carte « Tout est sous contrôle ».
 */
export function PrioritiesSection({
  priorities,
  aiTime,
}: {
  priorities: Priority[];
  aiTime: string | null;
}) {
  const { t } = useLanguage();
  const { cards, total } = visiblePriorities(priorities);
  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <MicroLabel color={Palette.textPrimary} size={11} track={0.16}>
            {t('accueil.home.priorities.title')}
          </MicroLabel>
          {total > 0 ? (
            <View
              accessibilityLabel={String(total)}
              style={{
                backgroundColor: Brand.graphite,
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <HText weight="semibold" size={11} color={Brand.white} style={{ lineHeight: 15 }}>
                {String(total)}
              </HText>
            </View>
          ) : null}
          {aiTime ? (
            <HText size={12} color={Palette.textSecondary} numberOfLines={1}>
              {t('accueil.home.priorities.aiTime', { time: aiTime })}
            </HText>
          ) : null}
        </View>
        <ArrowLink
          label={t('accueil.home.priorities.analysis')}
          onPress={() => router.push('/rapports')}
        />
      </View>

      {/* width 0 + minWidth 100 % : le carrousel défile sans jamais élargir l'écran (web). */}
      <View style={{ width: 0, minWidth: '100%' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + GAP}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 20, gap: GAP }}
        >
          {cards.length === 0 ? (
            <AllClear />
          ) : (
            cards.map((card) => <PriorityCard key={card.kind} priority={card} />)
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const cardStyle = {
  width: CARD_WIDTH,
  height: 168,
  borderRadius: 22,
  padding: 18,
  backgroundColor: Brand.graphite,
  justifyContent: 'space-between',
} as const;

function AllClear() {
  const { t } = useLanguage();
  return (
    <View style={cardStyle} accessible accessibilityLabel={t('accueil.home.priorities.allClear')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.successOnDark }}
        />
        <MicroLabel color={Brand.successOnDark} size={10} track={0.16}>
          {t('accueil.home.priorities.allClearLabel')}
        </MicroLabel>
      </View>
      <View style={{ gap: 4 }}>
        <HText
          font="display"
          weight="semibold"
          size={22}
          color={Brand.white}
          style={{ lineHeight: 28 }}
        >
          {t('accueil.home.priorities.allClear')}
        </HText>
        <HText size={14} color={Brand.mutedOnDark}>
          {t('accueil.home.priorities.allClearHint')}
        </HText>
      </View>
    </View>
  );
}

function PriorityCard({ priority }: { priority: Priority }) {
  const { t } = useLanguage();
  const base = `accueil.home.priorities.${priority.kind}`;
  const color = COLOR[priority.kind];
  const desc = t(`${base}.desc`, {
    count: priority.count,
    amount: formatAmount(priority.amount ?? 0),
  });
  return (
    <Pressable
      onPress={() => router.push(PRIORITY_ROUTE[priority.kind] as never)}
      accessibilityRole="button"
      accessibilityLabel={`${priority.count} ${desc}. ${t(`${base}.action`)}`}
      style={cardStyle}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <MicroLabel color={color} size={10} track={0.16}>
          {t(`${base}.label`)}
        </MicroLabel>
      </View>
      <View style={{ gap: 4 }}>
        <HText
          font="display"
          weight="semibold"
          size={40}
          color={Brand.white}
          track={-0.02}
          style={{ lineHeight: 42 }}
        >
          {String(priority.count)}
        </HText>
        <HText size={14} color={Brand.mutedOnDark} numberOfLines={2}>
          {desc}
        </HText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <HText weight="semibold" size={13} color={Brand.white}>
          {t(`${base}.action`)}
        </HText>
        <ArrowIcon color={Brand.orangeLight} />
      </View>
    </Pressable>
  );
}
