import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getSignedUrl } from '@/features/storage/api';

import { CHAT_AUDIO_BUCKET } from './api';
import { playedFraction } from './voice-utils';

/** Lecture des messages vocaux (stockage privé, lien temporaire) : un seul audio à la fois ; un appui sur le même message le met en pause. */
export function useVoicePlayback() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const currentId = useRef<string | null>(null);

  const release = useCallback(() => {
    const player = playerRef.current;
    playerRef.current = null;
    if (!player) return;
    try {
      player.pause();
      player.remove();
    } catch {
      // déjà libéré
    }
  }, []);

  useEffect(() => release, [release]);

  const toggle = useCallback(
    async (id: string, path: string, totalMs: number) => {
      if (currentId.current === id && playerRef.current) {
        const player = playerRef.current;
        if (player.playing) {
          player.pause();
          setPlayingId(null);
        } else {
          player.play();
          setPlayingId(id);
        }
        return;
      }
      release();
      currentId.current = id;
      setPlayingId(id);
      try {
        const url = await getSignedUrl(CHAT_AUDIO_BUCKET, path);
        // Lecture demandée par l'utilisateur : elle sonne même si le téléphone est en silencieux.
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        const player = createAudioPlayer({ uri: url });
        playerRef.current = player;
        player.addListener('playbackStatusUpdate', (status) => {
          setProgress((previous) => ({ ...previous, [id]: playedFraction(status.currentTime, totalMs) }));
          if (status.didJustFinish) {
            setPlayingId((current) => (current === id ? null : current));
            setProgress((previous) => ({ ...previous, [id]: 0 }));
            currentId.current = null;
          }
        });
        player.play();
      } catch {
        setPlayingId(null);
        currentId.current = null;
      }
    },
    [release]
  );

  return { playingId, progress, toggle };
}
