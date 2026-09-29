import type { PendingPhoto } from './types';

/** Ajoute une photo à la file ; une reprise du même angle remplace l'ancienne (pas de doublon). */
export function addToQueue(queue: PendingPhoto[], photo: PendingPhoto): PendingPhoto[] {
  return [
    ...queue.filter((p) => !(p.inspectionId === photo.inspectionId && p.angle === photo.angle)),
    photo,
  ];
}

export function removeFromQueue(queue: PendingPhoto[], id: string): PendingPhoto[] {
  return queue.filter((p) => p.id !== id);
}

export function pendingForInspection(queue: PendingPhoto[], inspectionId: string): PendingPhoto[] {
  return queue.filter((p) => p.inspectionId === inspectionId);
}
