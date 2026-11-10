import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { parseSnoozeMap, snoozeAdvice, type SnoozeMap } from './fleet-advice';

const KEY = 'bibip.flotte.advice.snooze.v1';

/** « Plus tard » : conseils masqués 24 h, gardés dans la mémoire locale du téléphone (jamais envoyés au serveur). */
export function useAdviceSnooze() {
  const [snoozed, setSnoozed] = useState<SnoozeMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => alive && setSnoozed(parseSnoozeMap(raw)))
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(snoozed)).catch(() => undefined);
  }, [loaded, snoozed]);

  const snooze = useCallback((key: string) => setSnoozed((previous) => snoozeAdvice(previous, key, new Date())), []);
  return { snoozed, loaded, snooze };
}
