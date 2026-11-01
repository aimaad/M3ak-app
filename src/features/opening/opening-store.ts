import { useSyncExternalStore } from 'react';
import { cancelAnimation, Easing, makeMutable, withTiming } from 'react-native-reanimated';

import {
  nextStatusOnArm,
  nextStatusOnEnd,
  nextStatusOnStart,
  type OpeningStatus,
} from './opening-state';
import { OPENING_PHASES } from './opening-timeline';

/**
 * Horloge unique de l'ouverture (ms). Par défaut elle est à la FIN : sans ouverture, tout est déjà à son état final
 * (aucun élément n'est jamais masqué par erreur). `armOpening` la ramène à 0 avant le premier affichage.
 */
export const openingTime = makeMutable<number>(OPENING_PHASES.end);
/** Position (y, en dp) du bord haut du rideau : 0 = plein écran (attente), sinon le bas du hero (pendant la lecture). */
export const curtainTop = makeMutable<number>(0);

let status: OpeningStatus = 'idle';
let consumed = false;
let endTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function setStatus(next: OpeningStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function getOpeningStatus(): OpeningStatus {
  return status;
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

/** À appeler une fois, avant le premier affichage de l'app. */
export function armOpening(options: { reduceMotion: boolean; disabled: boolean }) {
  const next = nextStatusOnArm(status, consumed, options);
  consumed = next.consumed;
  if (next.status === 'armed') {
    openingTime.value = 0;
    curtainTop.value = 0;
  }
  setStatus(next.status);
}

/** Lance la chronologie (le hero est affiché ; `heroBottom` = bas du hero à l'écran). */
export function startOpening(heroBottom: number) {
  if (nextStatusOnStart(status) !== 'playing') return;
  curtainTop.value = heroBottom;
  openingTime.value = withTiming(OPENING_PHASES.end, {
    duration: OPENING_PHASES.end,
    easing: Easing.linear,
  });
  setStatus('playing');
  endTimer = setTimeout(endOpening, OPENING_PHASES.end + 80);
}

/** Termine immédiatement (interaction, changement d'écran, erreur, délai dépassé) : l'interface finale apparaît d'un coup. */
export function endOpening() {
  if (endTimer) clearTimeout(endTimer);
  endTimer = null;
  if (status === 'idle') return;
  cancelAnimation(openingTime);
  openingTime.value = OPENING_PHASES.end;
  setStatus(nextStatusOnEnd());
}
