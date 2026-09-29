import AsyncStorage from '@react-native-async-storage/async-storage';

import { addToQueue, removeFromQueue } from './queue-logic';
import type { PendingPhoto } from './types';

const STORAGE_KEY = 'm3ak:pending-inspection-photos';

export async function loadQueue(): Promise<PendingPhoto[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PendingPhoto[]) : [];
}

async function saveQueue(queue: PendingPhoto[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function enqueuePhoto(photo: PendingPhoto): Promise<PendingPhoto[]> {
  const queue = addToQueue(await loadQueue(), photo);
  await saveQueue(queue);
  return queue;
}

export async function dequeuePhoto(id: string): Promise<PendingPhoto[]> {
  const queue = removeFromQueue(await loadQueue(), id);
  await saveQueue(queue);
  return queue;
}
