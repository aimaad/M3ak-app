import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { dismissKey, progressOf, shouldShowGettingStarted, type StartStep } from './getting-started';

/** Mémorise (sur l'appareil) que la personne a masqué la liste ; au pire elle réapparaît, sans conséquence. */
function useDismissed(key: string | null): [boolean | null, () => void] {
  const [stored, setStored] = useState<{ key: string; value: boolean } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((value) => !cancelled && setStored({ key, value: value === '1' }))
      .catch(() => !cancelled && setStored({ key, value: false }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const dismiss = useCallback(() => {
    if (!key) return;
    setStored({ key, value: true });
    AsyncStorage.setItem(key, '1').catch(() => undefined);
  }, [key]);

  // Tant que la valeur de CETTE clé n'est pas lue, on ne sait pas encore (null) : rien n'est affiché.
  return [key && stored?.key === key ? stored.value : null, dismiss];
}

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
  const [dismissed, dismiss] = useDismissed(dismissKey(userId, agencyId));

  if (!ready || dismissed === null || !shouldShowGettingStarted(steps, dismissed) || !steps) return null;
  const { done, total } = progressOf(steps);

  return (
    <View className="gap-3 rounded-3xl border border-[#E4DCF5] bg-white p-4">
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
                style={{ color: step.done ? '#8A82A0' : '#211A2E', textDecorationLine: step.done ? 'line-through' : 'none' }}
              >
                {t(`onboarding.start.steps.${step.key}.title`)}
              </ThemedText>
              {!step.done ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`onboarding.start.steps.${step.key}.hint`)}
                </ThemedText>
              ) : null}
            </View>
            {!step.done ? <Ionicons name="chevron-forward" size={18} color="#8A82A0" /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
