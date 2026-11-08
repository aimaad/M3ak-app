import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { BriefingLang } from './briefing-texts';

const KEY = 'bibip.home.briefing.lang.v1';

/** Langue du briefing : darija si l'app est en arabe, français sinon ; le choix de l'utilisateur est mémorisé sur l'appareil. */
export function useBriefingLang(appLanguage: string): [BriefingLang, (lang: BriefingLang) => void] {
  const [chosen, setChosen] = useState<BriefingLang | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((value) => {
        if (!cancelled && (value === 'fr' || value === 'darija')) setChosen(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((lang: BriefingLang) => {
    setChosen(lang);
    AsyncStorage.setItem(KEY, lang).catch(() => undefined);
  }, []);

  return [chosen ?? (appLanguage === 'ar' ? 'darija' : 'fr'), setLang];
}
