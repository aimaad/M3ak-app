import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export type FleetView = 'list' | 'gallery';

const KEY = 'bibip.flotte.view.v1';

/** Lit le choix mémorisé ; toute autre valeur (ou rien) donne la liste. */
export function parseFleetView(raw: string | null | undefined): FleetView {
  return raw === 'gallery' ? 'gallery' : 'list';
}

/** Vue de Ma Flotte (liste ou galerie), gardée dans la mémoire locale du téléphone : on retrouve son choix à la prochaine ouverture. */
export function useFleetView() {
  const [view, setViewState] = useState<FleetView>('list');

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => alive && setViewState(parseFleetView(raw)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const setView = useCallback((next: FleetView) => {
    setViewState(next);
    AsyncStorage.setItem(KEY, next).catch(() => undefined);
  }, []);
  return { view, setView };
}
