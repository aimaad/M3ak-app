import AsyncStorage from '@react-native-async-storage/async-storage';

/** Préférence : son d'introduction (activé par défaut). */
const SOUND_KEY = 'm3ak.opening.sound.v1';
/** Préférence : vibration d'accompagnement du moteur (activée par défaut). */
const HAPTICS_KEY = 'm3ak.opening.haptics.v1';
const READ_TIMEOUT_MS = 800;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), READ_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

export function readSoundEnabled(): Promise<boolean> {
  return withTimeout(
    AsyncStorage.getItem(SOUND_KEY).then((value) => value !== '0'),
    true
  );
}

/** Active / désactive le son d'introduction (préférence conservée). */
export async function setOpeningSoundEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
  } catch {
    // Préférence non enregistrée : sans conséquence.
  }
}

export function readHapticsEnabled(): Promise<boolean> {
  return withTimeout(
    AsyncStorage.getItem(HAPTICS_KEY).then((value) => value !== '0'),
    true
  );
}

/** Active / désactive la vibration d'accompagnement du moteur (préférence conservée). */
export async function setOpeningHapticsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(HAPTICS_KEY, enabled ? '1' : '0');
  } catch {
    // Préférence non enregistrée : sans conséquence.
  }
}
