import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';

import type { MessageLanguage } from './language';

/** Texte à lire : sans mise en forme ni liens. */
export function speakableText(text: string): string {
  return text.replace(/\*\*/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
}

/** Voix du téléphone : français ou arabe. Un seul son à la fois ; un nouvel appui sur le même message l'arrête. */
export function useSpeech() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => () => void Speech.stop(), []);

  const toggle = useCallback(
    (id: string, text: string, language: MessageLanguage) => {
      if (speakingId === id) {
        void Speech.stop();
        setSpeakingId(null);
        return;
      }
      void Speech.stop();
      setSpeakingId(id);
      Speech.speak(speakableText(text), {
        language: language === 'ar' ? 'ar-SA' : 'fr-FR',
        onDone: () => setSpeakingId((current) => (current === id ? null : current)),
        onStopped: () => setSpeakingId((current) => (current === id ? null : current)),
        onError: () => setSpeakingId((current) => (current === id ? null : current)),
      });
    },
    [speakingId]
  );

  return { speakingId, toggle };
}
