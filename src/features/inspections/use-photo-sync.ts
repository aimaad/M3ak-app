import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { uploadInspectionPhoto } from './api';
import { deleteLocalPhoto } from './local-photo-storage';
import { pendingForInspection } from './queue-logic';
import { dequeuePhoto, enqueuePhoto, loadQueue } from './queue-storage';
import type { PendingPhoto } from './types';

/**
 * Gère la file d'attente locale des photos d'inspection pas encore envoyées :
 * capture toujours possible hors ligne, envoi automatique dès que le réseau revient.
 */
export function usePhotoSync(inspectionId: string | undefined, agencyId: string | undefined) {
  const queryClient = useQueryClient();
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    const all = await loadQueue();
    setPendingPhotos(inspectionId ? pendingForInspection(all, inspectionId) : []);
  }, [inspectionId]);

  useEffect(() => {
    // Lecture asynchrone d'AsyncStorage au montage ; le setState a lieu après l'await,
    // pas synchronement dans le corps de l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshQueue();
  }, [refreshQueue]);

  const syncNow = useCallback(async () => {
    if (!inspectionId || !agencyId || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const all = await loadQueue();
      const mine = pendingForInspection(all, inspectionId);

      for (const photo of mine) {
        try {
          await uploadInspectionPhoto(agencyId, inspectionId, photo.angle, photo.localUri);
          await dequeuePhoto(photo.id);
          deleteLocalPhoto(photo.localUri);
        } catch {
          // Toujours hors ligne ou erreur réseau : la photo reste en file, on réessaiera.
        }
      }

      await refreshQueue();
      queryClient.invalidateQueries({ queryKey: ['inspection-photos', inspectionId] });
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [inspectionId, agencyId, queryClient, refreshQueue]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        syncNow();
      }
    });
    return unsubscribe;
  }, [syncNow]);

  const addPending = useCallback(
    async (photo: PendingPhoto) => {
      await enqueuePhoto(photo);
      await refreshQueue();
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        syncNow();
      }
    },
    [refreshQueue, syncNow]
  );

  return { pendingPhotos, isSyncing, syncNow, addPending };
}
