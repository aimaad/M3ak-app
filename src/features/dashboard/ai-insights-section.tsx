import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import type { InsightsAvailability } from '@/features/ocr/availability';
import { useLanguage } from '@/i18n/use-language';

import type { AiInsights, InsightRecommendation } from './insights';
import { insightsErrorMessageKey } from './insights-api';
import { SectionTitle } from './kpi-card';

const PRIORITY_COLOR: Record<InsightRecommendation['priority'], string> = {
  high: M3akPalette.danger,
  medium: M3akPalette.warning,
  low: M3akPalette.success,
};
const TREND_SYMBOL = { up: '▲', down: '▼', flat: '▬' } as const;

function UnavailableCard({ titleKey, availability }: { titleKey: string; availability: InsightsAvailability }) {
  const { t } = useLanguage();
  const messageKey =
    availability === 'owner_can_enable'
      ? 'accueil.ai.unavailable.ownerCanEnable'
      : availability === 'ask_owner'
        ? 'accueil.ai.unavailable.askOwner'
        : 'accueil.ai.unavailable.noKey';
  return (
    <Card className="gap-2">
      <ThemedText type="smallBold">{t(titleKey)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t(messageKey)}
      </ThemedText>
      {availability === 'owner_can_enable' ? (
        <Button label={t('accueil.ai.openSettings')} variant="secondary" size="sm" onPress={() => router.push('/entreprise')} />
      ) : null}
    </Card>
  );
}

/**
 * Indicateurs et recommandations proposés par l'IA. Si l'IA n'est pas configurée pour l'entreprise (ou pas activée par
 * le propriétaire), chaque bloc dit clairement qu'il ne peut pas être affiché et pourquoi.
 */
export function AiInsightsSection({
  availability,
  isLoading,
  error,
  data,
  onRefresh,
}: {
  availability: InsightsAvailability;
  isLoading: boolean;
  error: unknown;
  data: { insights: AiInsights; at: number } | undefined;
  onRefresh: () => boolean;
}) {
  const { t, language } = useLanguage();
  const [cooldownHint, setCooldownHint] = useState(false);

  if (availability === 'role_not_allowed') return null;

  if (availability === 'loading') {
    return (
      <View className="gap-3">
        <SectionTitle>{t('accueil.ai.title')}</SectionTitle>
        <ActivityIndicator color={M3akPalette.mauve} />
      </View>
    );
  }

  if (availability !== 'active') {
    return (
      <View className="gap-3">
        <SectionTitle>{t('accueil.ai.title')}</SectionTitle>
        <UnavailableCard titleKey="accueil.ai.indicatorsTitle" availability={availability} />
        <UnavailableCard titleKey="accueil.ai.recommendationsTitle" availability={availability} />
      </View>
    );
  }

  const insights = data?.insights;
  const time = data ? new Date(data.at).toLocaleString(language === 'ar' ? 'ar' : 'fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <SectionTitle>{t('accueil.ai.title')}</SectionTitle>
        <Button
          label={t('accueil.ai.refresh')}
          variant="secondary"
          size="sm"
          disabled={isLoading}
          onPress={() => setCooldownHint(!onRefresh())}
        />
      </View>
      {cooldownHint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('accueil.ai.cooldown')}
        </ThemedText>
      ) : null}

      {isLoading && !insights ? (
        <Card className="flex-row items-center gap-3">
          <ActivityIndicator color={M3akPalette.mauve} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('accueil.ai.loading')}
          </ThemedText>
        </Card>
      ) : error ? (
        <Card className="gap-1">
          <ThemedText type="small" style={{ color: M3akPalette.danger }}>
            {t(insightsErrorMessageKey(error))}
          </ThemedText>
        </Card>
      ) : insights ? (
        <>
          {insights.summary ? (
            <Card className="gap-2">
              <ThemedText type="small">{insights.summary}</ThemedText>
              {time ? (
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                  {t('accueil.ai.analysedAt', { time })}
                </ThemedText>
              ) : null}
            </Card>
          ) : null}

          {insights.indicators.length > 0 ? (
            <View className="gap-2">
              <ThemedText type="smallBold">{t('accueil.ai.indicatorsTitle')}</ThemedText>
              {insights.indicators.map((indicator) => (
                <Card key={indicator.label} className="gap-1">
                  <View className="flex-row items-center justify-between gap-3">
                    <ThemedText type="small" themeColor="textSecondary" className="flex-1">
                      {indicator.label}
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor="primary">
                      {`${TREND_SYMBOL[indicator.trend]} ${indicator.value}`}
                    </ThemedText>
                  </View>
                  {indicator.explanation ? (
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                      {indicator.explanation}
                    </ThemedText>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}

          {insights.recommendations.length > 0 ? (
            <View className="gap-2">
              <ThemedText type="smallBold">{t('accueil.ai.recommendationsTitle')}</ThemedText>
              {insights.recommendations.map((recommendation) => (
                <Card key={recommendation.title} className="gap-1">
                  <View className="flex-row items-center justify-between gap-3">
                    <ThemedText type="smallBold" className="flex-1">
                      {recommendation.title}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: PRIORITY_COLOR[recommendation.priority] }}>
                      {t(`accueil.ai.priority.${recommendation.priority}`)}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {recommendation.detail}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                    {t(`accueil.ai.area.${recommendation.area}`)}
                  </ThemedText>
                </Card>
              ))}
            </View>
          ) : null}

          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('accueil.ai.disclaimer')}
          </ThemedText>
        </>
      ) : null}
    </View>
  );
}
