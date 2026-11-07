import { useSyncExternalStore } from 'react';
import { cancelAnimation, Easing, makeMutable, withTiming } from 'react-native-reanimated';

import {
  nextStatusOnArm,
  nextStatusOnEnd,
  nextStatusOnStart,
  type OpeningEnd,
  type OpeningStatus,
} from './opening-state';
import {
  playEngineSound,
  prepareEngineSound,
  releaseEngineSound,
  stopEngineSound,
} from './opening-sound';
import { DONE_TIME, IGN } from './opening-timeline';

/**
 * Horloge unique de l'ouverture (ms). Par défaut elle est « terminée » : sans ouverture, tout est déjà à son état final
 * (aucun élément n'est jamais masqué par erreur). `armOpening` la ramène à 0 avant le premier affichage.
 */
export const openingTime = makeMutable<number>(DONE_TIME);

/** Images nécessaires avant de lancer la chronologie (aucun scintillement de chargement). */
const REQUIRED_ASSETS = ['ignition-dark', 'ignition-lit'] as const;
export type OpeningAsset = (typeof REQUIRED_ASSETS)[number] | 'showroom' | 'three-quarter';

let status: OpeningStatus = 'idle';
let consumed = false;
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

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOpeningStatus(): OpeningStatus {
  return status;
}

export function useOpeningStatus(): OpeningStatus {
  return useSyncExternalStore(subscribe, getOpeningStatus, getOpeningStatus);
}

/**
 * À appeler une fois au lancement à froid, avant le premier affichage : pose le fond sombre et prépare le son.
 * Sans effet si les animations sont réduites, sur écran « bureau », ou si EXPO_PUBLIC_DISABLE_OPENING=1 (diagnostic).
 */
export function armOpening(options: { reduceMotion: boolean; disabled: boolean }) {
  const forcedOff = process.env.EXPO_PUBLIC_DISABLE_OPENING === '1';
  const next = nextStatusOnArm(status, consumed || forcedOff, options);
  consumed = true;
  if (next.status === 'armed') {
    openingTime.value = 0;
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
  return useSyncExternalStore(subscribe, allAssetsReady, allAssetsReady);
}

/** Lance la chronologie (le hero est affiché et les images de l'ouverture sont chargées). */
export function startOpening() {
  if (nextStatusOnStart(status) !== 'playing') return;
  openingTime.value = withTiming(IGN.end, { duration: IGN.end, easing: Easing.linear });
  setStatus('playing');
  endTimer = setTimeout(() => endOpening('completed'), IGN.end + 80);
}

/** Déclenche le moteur (appelé à l'instant précis du démarrage) : sans effet si l'ouverture est déjà terminée. */
export function triggerEngineSound() {
  if (status === 'playing') playEngineSound();
}

/** Termine immédiatement : l'interface finale apparaît d'un coup. */
export function endOpening(reason: OpeningEnd) {
  if (endTimer) clearTimeout(endTimer);
  endTimer = null;
  if (status === 'idle') return;
  setStatus(nextStatusOnEnd());
  cancelAnimation(openingTime);
  openingTime.value = DONE_TIME;
  // Fin naturelle : le son se termine de lui-même (libéré ensuite) ; introduction passée : courte décroissance ; abandon : libération.
  if (reason === 'skipped') stopEngineSound();
  else if (reason === 'aborted') releaseEngineSound();
}
