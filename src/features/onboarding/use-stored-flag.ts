import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * Drapeau mémorisé sur l'appareil (par clé). Renvoie null tant que la valeur de CETTE clé n'est pas lue, puis vrai/faux,
 * et une fonction asynchrone pour passer à vrai. Si le stockage échoue, on considère « faux » : au pire la chose réapparaît.
 */
export function useStoredFlag(key: string | null): [boolean | null, () => Promise<void>] {
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

  const setFlag = useCallback(async () => {
    if (!key) return;
    setStored({ key, value: true });
    // On attend l'écriture : l'écran suivant relit la valeur, il doit déjà la trouver.
    await AsyncStorage.setItem(key, '1').catch(() => undefined);
  }, [key]);

  return [key && stored?.key === key ? stored.value : null, setFlag];
}
