import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { parseRecentChecks, pushRecentCheck, type RecentCheck } from './recent-checks';

const KEY = 'bibip.vehicle.checks.v1';

/** Les 5 dernières vérifications, gardées dans la mémoire locale du téléphone (jamais envoyées au serveur). */
export function useRecentChecks() {
  const [checks, setChecks] = useState<RecentCheck[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => alive && setChecks(parseRecentChecks(raw)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const remember = useCallback((check: Omit<RecentCheck, 'at'>) => {
    setChecks((previous) => {
      const next = pushRecentCheck(previous, { ...check, at: Date.now() });
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  return { checks, remember };
}
