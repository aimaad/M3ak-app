import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { HText } from './home-ui';

const SUGGESTIONS = ['late', 'unpaid', 'tomorrow'] as const;

/** Ombre de la carte (élément flottant : grise, très légère) : 0 12 32 à 12 %. */
const FLOAT_SHADOW = Platform.select({
  default: {
    shadowColor: Palette.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
})!;

/**
 * « Demander à BIBIP » : carte posée à cheval sur l'en-tête, avec des questions suggérées. Un toucher ouvre l'assistant (si l'IA
 * est active) ; une suggestion lui envoie la question tout de suite ; le micro ouvre la saisie prête à dicter.
 */
export function AskBibip({ chatActive }: { chatActive: boolean }) {
  const { t } = useLanguage();
  const open = () => router.push(chatActive ? '/chat/nouveau' : '/chat');
  const ask = (question: string) =>
    router.push(
      chatActive ? { pathname: '/chat/[id]', params: { id: 'nouveau', question } } : '/chat'
    );
  return (
    <View style={{ marginTop: -32, gap: 12 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${t('accueil.home.ask.title')}. ${t('accueil.home.ask.hint')}`}
          style={[
            {
              minHeight: 64,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 10,
              paddingEnd: 14,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: Palette.border,
              backgroundColor: Palette.card,
            },
            FLOAT_SHADOW,
          ]}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: Brand.graphite,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="sparkles-outline" size={20} color={Brand.orange} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <HText weight="semibold" size={15} numberOfLines={1}>
              {t('accueil.home.ask.title')}
            </HText>
            <HText size={13} color={Palette.textSecondary} numberOfLines={2}>
              {t('accueil.home.ask.hint')}
            </HText>
          </View>
          <Pressable
            onPress={() =>
              router.push(
                chatActive
                  ? { pathname: '/chat/[id]', params: { id: 'nouveau', dictate: '1' } }
                  : '/chat'
              )
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('accueil.home.ask.mic')}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: Palette.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="mic-outline" size={17} color={Palette.textPrimary} />
            </View>
          </Pressable>
        </Pressable>
      </View>

      {/* width 0 + minWidth 100 % : la rangée défile sans jamais élargir l'écran (web). */}
      <View style={{ width: 0, minWidth: '100%' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {SUGGESTIONS.map((key) => {
            const question = t(`accueil.home.ask.${key}`);
            return (
              <Pressable
                key={key}
                onPress={() => ask(question)}
                accessibilityRole="button"
                style={{ height: 44, justifyContent: 'center' }}
              >
                <View
                  style={{
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: Palette.border,
                    backgroundColor: Palette.card,
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                  }}
                >
                  <HText weight="medium" size={13}>
                    {question}
                  </HText>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
