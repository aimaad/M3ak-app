import { useSyncExternalStore } from 'react';

import {
  nextStatusOnArm,
  nextStatusOnEnd,
  nextStatusOnStart,
  type OpeningEnd,
  type OpeningStatus,
} from './opening-state';

let status: OpeningStatus = 'idle';
let consumed = false;
const listeners = new Set<() => void>();

function setStatus(next: OpeningStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
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
 * À appeler une fois au lancement à froid, avant le premier affichage : pose le rideau noir de la vidéo.
 * Sans effet si les animations sont réduites, sur écran « bureau », ou si EXPO_PUBLIC_DISABLE_OPENING=1 (diagnostic).
 */
export function armOpening(options: { reduceMotion: boolean; disabled: boolean }) {
  const forcedOff = process.env.EXPO_PUBLIC_DISABLE_OPENING === '1';
  const next = nextStatusOnArm(status, consumed || forcedOff, options);
  consumed = true;
  setStatus(next.status);
}

/** La vidéo est en lecture. */
export function startOpening() {
  setStatus(nextStatusOnStart(status));
}

/** Termine : l'application apparaît (la vidéo se retire en fondu côté écran). */
export function endOpening(_reason: OpeningEnd) {
  if (status === 'idle') return;
  setStatus(nextStatusOnEnd());
}
