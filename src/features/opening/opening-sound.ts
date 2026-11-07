import type { AudioPlayer } from 'expo-audio';

import { readSoundEnabled } from './opening-storage';

const ENGINE = require('../../../assets/audio/m3ak-engine-start.mp3');
/** Volume : le fichier est déjà dosé (pic ≈ 0,96) ; le volume du téléphone reste maître. */
const VOLUME = 1;
/** Le fichier dure ≈ 1,38 s : on libère le lecteur peu après, sans jamais couper le son brutalement. */
const RELEASE_AFTER_MS = 2600;

let player: AudioPlayer | null = null;
let played = false;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Prépare le son d'introduction sans retarder l'affichage (appel non bloquant). Respecte le mode silencieux du téléphone
 * (`playsInSilentMode: false`) et se mélange à la musique éventuelle. Sans son disponible, l'animation reste silencieuse.
 */
export async function prepareEngineSound(): Promise<void> {
  try {
    // Interrupteur de diagnostic : EXPO_PUBLIC_DISABLE_OPENING_SOUND=1 coupe le son (animation seule).
    if (process.env.EXPO_PUBLIC_DISABLE_OPENING_SOUND === '1') return;
    if (!(await readSoundEnabled())) return;
    // Chargé à la demande : si le module audio natif manque ou est incompatible, l'app démarre quand même (en silence).
    const { createAudioPlayer, setAudioModeAsync } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-audio') as typeof import('expo-audio');
    await setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    const created = createAudioPlayer(ENGINE);
    created.volume = VOLUME;
    player = created;
  } catch (error) {
    // Visible dans le terminal d'Expo (développement) : permet de comprendre pourquoi on n'entend rien.
    if (__DEV__) console.warn("[BIBIP] son d'ouverture indisponible :", error);
    player = null;
  }
}

/** Joue le moteur une seule fois par ouverture (jamais deux instances en même temps). */
export function playEngineSound(): void {
  if (!player) {
    if (__DEV__)
      console.warn('[BIBIP] moteur : lecteur non prêt (son coupé ou module audio indisponible)');
    return;
  }
  if (played) return;
  played = true;
  try {
    player.seekTo(0).catch(() => {});
    player.play();
    if (__DEV__) console.log('[BIBIP] moteur lancé (volume', player.volume, ')');
  } catch (error) {
    // Son indisponible : l'animation continue en silence.
    if (__DEV__) console.warn('[BIBIP] lecture du moteur impossible :', error);
  }
  releaseTimer = setTimeout(releaseEngineSound, RELEASE_AFTER_MS);
}

/** Interrompt le son (introduction passée par l'utilisateur) avec une courte décroissance, sans claquement. */
export function stopEngineSound(): void {
  const current = player;
  if (!current || !played) {
    releaseEngineSound();
    return;
  }
  let volume = VOLUME;
  const fade = setInterval(() => {
    volume -= 0.14;
    try {
      if (volume <= 0) {
        clearInterval(fade);
        releaseEngineSound();
      } else {
        current.volume = volume;
      }
    } catch {
      clearInterval(fade);
    }
  }, 30);
}

/** Libère les ressources audio. */
export function releaseEngineSound(): void {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = null;
  const current = player;
  player = null;
  if (!current) return;
  try {
    current.pause();
    current.remove();
  } catch {
    // Déjà libéré.
  }
}
