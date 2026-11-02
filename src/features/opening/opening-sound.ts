import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { readSoundEnabled } from './opening-storage';

const ENGINE = require('../../../assets/audio/m3ak-engine-start.mp3');
/** Volume modéré par défaut. */
const VOLUME = 0.7;
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
    if (!(await readSoundEnabled())) return;
    await setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    const created = createAudioPlayer(ENGINE);
    created.volume = VOLUME;
    player = created;
  } catch {
    player = null;
  }
}

/** Joue le moteur une seule fois par ouverture (jamais deux instances en même temps). */
export function playEngineSound(): void {
  if (!player || played) return;
  played = true;
  try {
    player.play();
  } catch {
    // Son indisponible : l'animation continue en silence.
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
