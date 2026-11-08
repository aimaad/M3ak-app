import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';

import { Brand, HomeFonts, Palette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import type { Briefing, BriefingPart } from './briefing';
import type { BriefingLang } from './briefing-texts';
import { ArrowIcon, HText, Skeleton } from './home-ui';

/** Ombre de la carte (élément flottant : grise, très légère) : 0 12 32 à 12 %. */
const FLOAT_SHADOW = Platform.select({
  default: { shadowColor: Palette.shadow, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
})!;

type Props = {
  briefing: Briefing | null;
  lang: BriefingLang;
  onLangChange: (lang: BriefingLang) => void;
  /** Heure (ms) de la dernière mise à jour des données. */
  updatedAt: number;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

/**
 * Carte « BIBIP » à cheval sur l'en-tête : le briefing du jour en une phrase (construite par des modèles, sans IA), la ligne de
 * priorité, un sélecteur Darija / FR et le champ « Demander à BIBIP… » qui ouvre l'assistant.
 */
export function BriefingCard({ briefing, lang, onLangChange, updatedAt, loading, error, onRetry }: Props) {
  const { t, language } = useLanguage();
  const darija = lang === 'darija';
  const time = updatedAt > 0 ? new Date(updatedAt).toLocaleTimeString(language === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <View
      style={[
        { marginHorizontal: 20, borderRadius: 22, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.card, padding: 16, gap: 12 },
        FLOAT_SHADOW,
      ]}
    >
      {/* Ligne du haut */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles-outline" size={18} color={Brand.orange} />
          </View>
          <View style={{ flexShrink: 1, gap: 2 }}>
            <HText weight="semibold" size={14} numberOfLines={1}>
              {t('accueil.home.briefing.title')}
            </HText>
            <HText size={11} color={Palette.textSecondary} numberOfLines={1}>
              {t('accueil.home.briefing.updated', { time })}
            </HText>
          </View>
        </View>
        <View
          accessibilityRole="tablist"
          accessibilityLabel={t('accueil.home.briefing.langLabel')}
          style={{ flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: 10, padding: 3 }}
        >
          {(['darija', 'fr'] as const).map((key) => {
            const active = key === lang;
            return (
              <Pressable
                key={key}
                onPress={() => onLangChange(key)}
                hitSlop={{ top: 7, bottom: 7, left: 2, right: 2 }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(key === 'darija' ? 'accueil.home.briefing.darija' : 'accueil.home.briefing.french')}
                style={{ height: 30, minWidth: 52, borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? Brand.graphite : 'transparent' }}
              >
                <HText weight="semibold" size={12} color={active ? Brand.white : Palette.textSecondary} style={{ lineHeight: 16 }}>
                  {t(key === 'darija' ? 'accueil.home.briefing.darija' : 'accueil.home.briefing.french')}
                </HText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Phrase du jour */}
      {loading ? (
        <View style={{ gap: 8 }} accessibilityElementsHidden>
          <Skeleton height={20} radius={6} />
          <Skeleton height={20} radius={6} width="70%" />
        </View>
      ) : error || !briefing ? (
        <View style={{ alignItems: 'flex-start', gap: 6 }}>
          <HText size={14} color={Palette.textSecondary}>
            {t('accueil.home.briefing.error')}
          </HText>
          <Pressable onPress={onRetry} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <HText weight="semibold" size={13}>
              {t('accueil.home.briefing.retry')}
            </HText>
          </Pressable>
        </View>
      ) : (
        <View accessible accessibilityLabel={t('accueil.home.briefing.a11y', { text: briefing.plain })} style={{ gap: 10 }}>
          <Sentence parts={briefing.main} darija={darija} />
          <Sub parts={briefing.priority} darija={darija} />
        </View>
      )}

      {/* Champ de question */}
      <Pressable
        onPress={() => router.push('/chat')}
        accessibilityRole="button"
        accessibilityLabel={t('accueil.home.briefing.openChat')}
        style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingStart: 14, paddingEnd: 6 }}
      >
        <HText size={14} color={Palette.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
          {t('accueil.home.briefing.ask')}
        </HText>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowIcon color={Brand.white} size={16} />
        </View>
      </Pressable>
    </View>
  );
}

/** Phrase principale : FR en Montserrat 600 16 px ; darija en Cairo 700 18 px, alignée à droite et lue de droite à gauche. */
function Sentence({ parts, darija }: { parts: BriefingPart[]; darija: boolean }) {
  const { language } = useLanguage();
  const size = darija ? 18 : 16;
  const base = darija
    ? { fontFamily: HomeFonts.arabic.bold, textAlign: 'right' as const, writingDirection: 'rtl' as const }
    : { fontFamily: language === 'ar' ? HomeFonts.arabic.semibold : HomeFonts.display.semibold, textAlign: 'left' as const, writingDirection: 'ltr' as const };
  const strong = darija ? HomeFonts.arabic.bold : language === 'ar' ? HomeFonts.arabic.bold : HomeFonts.display.bold;
  return (
    <HText size={size} color={Palette.textPrimary} style={[base, { lineHeight: Math.round(size * (darija ? 1.7 : 1.5)) }]}>
      {parts.map((part, index) => (
        <HText key={index} size={size} color={part.strong ? Brand.orange : Palette.textPrimary} style={[base, part.strong ? { fontFamily: strong } : null, { lineHeight: Math.round(size * (darija ? 1.7 : 1.5)) }]}>
          {part.text}
        </HText>
      ))}
    </HText>
  );
}

/** Ligne de priorité : 13 px, gris ; les chiffres en évidence (graphite, gras). */
function Sub({ parts, darija }: { parts: BriefingPart[]; darija: boolean }) {
  const { language } = useLanguage();
  const family = darija || language === 'ar' ? HomeFonts.arabic.medium : HomeFonts.text.regular;
  const strongFamily = darija || language === 'ar' ? HomeFonts.arabic.bold : HomeFonts.text.semibold;
  const base = { fontFamily: family, lineHeight: 20, ...(darija ? { textAlign: 'right' as const, writingDirection: 'rtl' as const } : { textAlign: 'left' as const, writingDirection: 'ltr' as const }) };
  return (
    <HText size={13} color={Palette.textSecondary} style={base}>
      {parts.map((part, index) => (
        <HText key={index} size={13} color={part.strong ? Palette.textPrimary : Palette.textSecondary} style={[base, part.strong ? { fontFamily: strongFamily } : null]}>
          {part.text}
        </HText>
      ))}
    </HText>
  );
}
