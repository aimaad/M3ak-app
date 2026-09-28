import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from '@/i18n/locales/ar.json';
import fr from '@/i18n/locales/fr.json';

export const SUPPORTED_LANGUAGES = ['fr', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const RTL_LANGUAGES: readonly SupportedLanguage[] = ['ar'];

export function isRTL(language: string): boolean {
  return (RTL_LANGUAGES as readonly string[]).includes(language);
}

function detectInitialLanguage(): SupportedLanguage {
  const deviceLanguage = Localization.getLocales()[0]?.languageCode;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(deviceLanguage ?? '')
    ? (deviceLanguage as SupportedLanguage)
    : 'fr';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
