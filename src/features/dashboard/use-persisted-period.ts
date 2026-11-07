import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { DASHBOARD_PERIODS, type DashboardPeriod } from './kpis';

const KEY = 'bibip.home.period.v1';

/** Période choisie sur l'accueil, mémorisée sur l'appareil (« Aujourd'hui » par défaut ou si la lecture échoue). */
export function usePersistedPeriod(): [DashboardPeriod, (period: DashboardPeriod) => void] {
  const [period, setPeriodState] = useState<DashboardPeriod>('today');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((value) => {
        if (!cancelled && DASHBOARD_PERIODS.includes(value as DashboardPeriod)) setPeriodState(value as DashboardPeriod);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const setPeriod = useCallback((next: DashboardPeriod) => {
    setPeriodState(next);
    AsyncStorage.setItem(KEY, next).catch(() => undefined);
  }, []);

  return [period, setPeriod];
}
