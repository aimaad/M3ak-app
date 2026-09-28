import { useCallback } from 'react';
import { I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isRTL, type SupportedLanguage } from '@/i18n';

export function useLanguage() {
  const { i18n, t } = useTranslation();

  const changeLanguage = useCallback(
    async (language: SupportedLanguage) => {
      const shouldBeRTL = isRTL(language);
      const restartNeeded = shouldBeRTL !== I18nManager.isRTL;

      await i18n.changeLanguage(language);
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);

      return { restartNeeded };
    },
    [i18n]
  );

  return {
    language: i18n.language as SupportedLanguage,
    changeLanguage,
    t,
  };
}
