import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { useStoredFlag } from './use-stored-flag';
import { dismissKey, progressOf, shouldShowGettingStarted, type StartStep } from './getting-started';

type Props = {
  steps: StartStep[] | null;
  userId: string | undefined;
  agencyId: string | undefined;
  /** Évite de proposer des étapes « à faire » pendant que les données se chargent. */
  ready: boolean;
};

/** Carte « Premiers pas » de l'accueil : étapes cliquables vers le bon écran, barre de progression, masquable. */
export function GettingStartedCard({ steps, userId, agencyId, ready }: Props) {
  const { t } = useLanguage();
  const [dismissed, dismiss] = useStoredFlag(dismissKey(userId, agencyId));

  if (!ready || dismissed === null || !shouldShowGettingStarted(steps, dismissed) || !steps) return null;
  const { done, total } = progressOf(steps);

  return (
    <View className="gap-3 rounded-2xl border border-line bg-white p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <ThemedText type="smallBold">{t('onboarding.start.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('onboarding.start.progress', { done, total })}
          </ThemedText>
        </View>
        <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('onboarding.start.hide')}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('onboarding.start.hide')}
          </ThemedText>
        </Pressable>
      </View>

      <ProgressBar fraction={done / total} />

      <View className="gap-1">
        {steps.map((step) => (
          <Pressable
            key={step.key}
            disabled={step.done || !step.href}
            onPress={() => step.href && router.push(step.href)}
            accessibilityRole={step.done ? 'text' : 'link'}
            accessibilityState={{ checked: step.done }}
            className="min-h-12 flex-row items-center gap-3 rounded-2xl px-2"
          >
            <Ionicons
              name={step.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={step.done ? '#15803D' : M3akPalette.mauve}
            />
            <View className="flex-1">
              <ThemedText
                type="smallBold"
                style={{ color: step.done ? M3akPalette.subtle : M3akPalette.ink, textDecorationLine: step.done ? 'line-through' : 'none' }}
              >
                {t(`onboarding.start.steps.${step.key}.title`)}
              </ThemedText>
              {!step.done ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`onboarding.start.steps.${step.key}.hint`)}
                </ThemedText>
              ) : null}
            </View>
            {!step.done ? <Ionicons name="chevron-forward" size={18} color={M3akPalette.subtle} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
