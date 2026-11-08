import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';

import { synthesizeSpeech } from './api';
import { detectMessageLanguage } from './language';
import { speakableText } from './speech';
import { chunkForSpeech } from './stream';

const MAX_CLIP_MS = 120_000;
let clipCounter = 0;

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Écrit le son reçu dans le cache du téléphone (supprimé après lecture). */
async function writeClip(base64: string): Promise<File> {
  clipCounter += 1;
  const file = new File(Paths.cache, `bibip-voix-${Date.now()}-${clipCounter}.wav`);
  await file.write(bytesFromBase64(base64));
  return file;
}

/**
 * File de lecture à voix naturelle : chaque phrase ajoutée est synthétisée tout de suite (en avance), puis jouée dans l'ordre,
 * sans trou. Si la voix naturelle n'est pas disponible pour une phrase, la voix du téléphone la lit à la place.
 * `stop()` coupe tout immédiatement.
 */
export class VoiceQueue {
  private chain: Promise<void> = Promise.resolve();
  private generation = 0;
  private pending = 0;
  private player: AudioPlayer | null = null;
  private cancelCurrent: (() => void) | null = null;

  constructor(private onSpeaking?: (speaking: boolean) => void) {}

  enqueue(raw: string) {
    const text = speakableText(raw);
    if (!text) return;
    const generation = this.generation;
    // Synthèse lancée tout de suite : pendant qu'une phrase est lue, la suivante se prépare.
    const clip = synthesizeSpeech(text).then(writeClip).catch(() => null);
    this.pending += 1;
    this.onSpeaking?.(true);
    this.chain = this.chain
      .then(async () => {
        if (generation !== this.generation) return;
        const file = await clip;
        if (generation !== this.generation) {
          file?.delete();
          return;
        }
        if (file) await this.play(file);
        else await this.phoneSpeak(text);
      })
      .catch(() => undefined)
      .finally(() => {
        if (generation !== this.generation) return;
        this.pending -= 1;
        if (this.pending <= 0) this.onSpeaking?.(false);
      });
  }

  /** Résolu quand tout ce qui a été ajouté est lu (ou après `stop()`). */
  idle(): Promise<void> {
    return this.chain;
  }

  get busy(): boolean {
    return this.pending > 0;
  }

  stop() {
    this.generation += 1;
    this.pending = 0;
    this.cancelCurrent?.();
    void Speech.stop();
    this.chain = Promise.resolve();
    this.onSpeaking?.(false);
  }

  private async play(file: File) {
    // Lecture demandée par l'utilisateur : elle sonne même si le téléphone est en silencieux.
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    await new Promise<void>((resolve) => {
      const player = createAudioPlayer({ uri: file.uri });
      this.player = player;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(safety);
        this.cancelCurrent = null;
        try {
          player.pause();
          player.remove();
        } catch {
          // déjà libéré
        }
        if (this.player === player) this.player = null;
        try {
          file.delete();
        } catch {
          // fichier déjà supprimé
        }
        resolve();
      };
      const safety = setTimeout(done, MAX_CLIP_MS);
      this.cancelCurrent = done;
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) done();
      });
      try {
        player.play();
      } catch {
        done();
      }
    });
  }

  private phoneSpeak(text: string) {
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      this.cancelCurrent = done;
      Speech.speak(text, { language: detectMessageLanguage(text) === 'ar' ? 'ar-SA' : 'fr-FR', onDone: done, onStopped: done, onError: done });
    });
  }
}

/** « Écouter » sous une réponse : une seule lecture à la fois ; un nouvel appui sur le même message l'arrête. */
export function useListen() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [queue] = useState(() => new VoiceQueue((speaking) => (speaking ? undefined : setSpeakingId(null))));

  useEffect(() => () => queue.stop(), [queue]);

  const toggle = useCallback(
    (id: string, text: string) => {
      const wasSpeaking = speakingId === id;
      queue.stop();
      if (wasSpeaking) return;
      setSpeakingId(id);
      chunkForSpeech(speakableText(text)).forEach((chunk) => queue.enqueue(chunk));
    },
    [queue, speakingId]
  );

  return { speakingId, toggle };
}
