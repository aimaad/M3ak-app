import { useSyncExternalStore } from 'react';
import { cancelAnimation, Easing, makeMutable, withTiming } from 'react-native-reanimated';

import {
  chooseMode,
  nextStatusOnArm,
  nextStatusOnEnd,
  nextStatusOnStart,
  shouldRememberFirst,
  type OpeningEnd,
  type OpeningStatus,
} from './opening-state';
import {
  playEngineSound,
  prepareEngineSound,
  releaseEngineSound,
  stopEngineSound,
} from './opening-sound';
import { markFirstPlayed, readFirstPlayed } from './opening-storage';
import { DONE_TIME, durationOf, type OpeningMode } from './opening-timeline';

/**
 * Horloge unique de l'ouverture (ms). Par défaut elle est « terminée » : sans ouverture, tout est déjà à son état final
 * (aucun élément n'est jamais masqué par erreur). `armOpening` la ramène à 0 avant le premier affichage.
 */
export const openingTime = makeMutable<number>(DONE_TIME);
/** Position (y, en dp) du bord haut du rideau : 0 = plein écran (attente), sinon le bas du hero (pendant la lecture). */
export const curtainTop = makeMutable<number>(0);

/** Images nécessaires avant de lancer la chronologie (aucun scintillement de chargement). */
const REQUIRED_ASSETS = ['showroom', 'car-unlit', 'car-lit'] as const;
export type OpeningAsset = (typeof REQUIRED_ASSETS)[number];

let status: OpeningStatus = 'idle';
let mode: OpeningMode = 'instant';
let consumed = false;
let heroHeight = 0;
let endTimer: ReturnType<typeof setTimeout> | null = null;
const ready = new Set<OpeningAsset>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setStatus(next: OpeningStatus) {
  if (next === status) return;
  status = next;
  emit();
}

export function getOpeningStatus(): OpeningStatus {
  return status;
}

/** Scénario courant (fixé avant le premier affichage, ne change plus pendant la session). */
export function getOpeningMode(): OpeningMode {
  return mode;
}

export function getHeroHeight(): number {
  return heroHeight;
}

export function useOpeningStatus(): OpeningStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getOpeningStatus,
    getOpeningStatus
  );
}

/**
 * À appeler une fois au lancement, avant le premier affichage : lit la mémoire (première ouverture ou non), choisit le
 * scénario et pose le rideau. Ne bloque jamais plus de ~0,8 s (la mémoire illisible donne la version courte).
 */
export async function prepareOpening(options: { reduceMotion: boolean; disabled: boolean }) {
  // Interrupteur de secours (diagnostic) : EXPO_PUBLIC_DISABLE_OPENING=1 désactive toute l'ouverture.
  const forcedOff = process.env.EXPO_PUBLIC_DISABLE_OPENING === '1';
  if (consumed || forcedOff || options.reduceMotion || options.disabled) {
    consumed = true;
    return;
  }
  mode = chooseMode(await readFirstPlayed());
  const next = nextStatusOnArm(status, consumed, options);
  consumed = next.consumed;
  if (next.status === 'armed') {
    openingTime.value = 0;
    curtainTop.value = 0;
    void prepareEngineSound();
  }
  setStatus(next.status);
}

function allAssetsReady(): boolean {
  return REQUIRED_ASSETS.every((name) => ready.has(name));
}

/** Une image de l'ouverture est chargée. */
export function markAssetReady(asset: OpeningAsset) {
  if (ready.has(asset)) return;
  ready.add(asset);
  emit();
}

/** Vrai quand toutes les images nécessaires sont chargées. */
export function useAssetsReady(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    allAssetsReady,
    allAssetsReady
  );
}

/** Lance la chronologie (le hero est affiché ; `height` = hauteur du hero à l'écran). */
export function startOpening(height: number) {
  if (nextStatusOnStart(status) !== 'playing') return;
  heroHeight = height;
  // Le rideau ne couvre plus que le dessous du hero (le hero lui-même est géré par ses propres calques).
  curtainTop.value = height;
  const duration = durationOf(mode);
  openingTime.value = withTiming(duration, { duration, easing: Easing.linear });
  setStatus('playing');
  endTimer = setTimeout(() => endOpening('completed'), duration + 80);
}

/** Déclenche le moteur (appelé à l'instant d'allumage des phares) : sans effet si l'ouverture est déjà terminée. */
export function triggerEngineSound() {
  if (status === 'playing') playEngineSound();
}

/** Termine immédiatement : l'interface finale apparaît d'un coup. */
export function endOpening(reason: OpeningEnd) {
  if (endTimer) clearTimeout(endTimer);
  endTimer = null;
  if (status === 'idle') return;
  const wasMode = mode;
  setStatus(nextStatusOnEnd());
  cancelAnimation(openingTime);
  openingTime.value = DONE_TIME;
  if (shouldRememberFirst(wasMode, reason)) void markFirstPlayed();
  // Fin naturelle : le son se termine de lui-même (libéré ensuite) ; introduction passée : courte décroissance ; abandon : libération.
  if (reason === 'skipped') stopEngineSound();
  else if (reason === 'aborted') releaseEngineSound();
}
