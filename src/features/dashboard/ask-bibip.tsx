import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { BriefingCard } from './briefing-card';
import { HText } from './home-ui';

const SUGGESTIONS = ['late', 'unpaid', 'tomorrow'] as const;

/**
 * Carte « BIBIP » (briefing du jour + question) posée à cheval sur l'en-tête, puis les pastilles de questions suggérées : une
 * pastille envoie la question tout de suite à l'assistant (si l'IA est active).
 */
export function AskBibip({ chatActive, ...card }: { chatActive: boolean } & React.ComponentProps<typeof BriefingCard>) {
  const { t } = useLanguage();
  const ask = (question: string) =>
    router.push(chatActive ? { pathname: '/chat/[id]', params: { id: 'nouveau', question } } : '/chat');
  return (
    <View style={{ marginTop: -32, gap: 12 }}>
      <BriefingCard {...card} chatActive={chatActive} />

      {/* width 0 + minWidth 100 % : la rangée défile sans jamais élargir l'écran (web). */}
      <View style={{ width: 0, minWidth: '100%' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {SUGGESTIONS.map((key) => {
            const question = t(`accueil.home.ask.${key}`);
            return (
              <Pressable key={key} onPress={() => ask(question)} accessibilityRole="button" style={{ height: 44, justifyContent: 'center' }}>
                <View style={{ height: 36, borderRadius: 18, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.card, paddingHorizontal: 14, justifyContent: 'center' }}>
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
