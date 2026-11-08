import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { meteringToLevel } from './voice-utils';

/**
 * Format d'enregistrement : WAV 16 kHz mono sur iPhone, AAC (ADTS) 16 kHz mono sur Android. Ce sont des formats que le
 * serveur de transcription accepte tels quels ; 2 minutes pèsent 3,8 Mo (WAV) ou environ 1 Mo (AAC).
 */
export const RECORDING_OPTIONS: RecordingOptions = {
  extension: Platform.OS === 'ios' ? '.wav' : '.aac',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: Platform.OS === 'ios' ? 256000 : 64000,
  isMeteringEnabled: true,
  android: { outputFormat: 'aac_adts', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.LINEARPCM, audioQuality: AudioQuality.MAX, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};

export type RecorderPhase = 'idle' | 'recording' | 'paused';
export type StartResult = 'ok' | 'denied' | 'blocked';

/** Ouvre les réglages du téléphone (permission micro refusée). */
export function openMicrophoneSettings() {
  void Linking.openSettings();
}

/** Enregistreur de messages vocaux : permission, démarrage, pause, arrêt (fichier et durée), niveau du micro en temps réel. */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, 80);
  const [phase, setPhase] = useState<RecorderPhase>('idle');

  useEffect(
    () => () => {
      void recorder.stop().catch(() => undefined);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
    [recorder]
  );

  const start = useCallback(async (): Promise<StartResult> => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return permission.canAskAgain ? 'denied' : 'blocked';
    // iOS impose « playsInSilentMode: true » dès qu'on enregistre (sinon : « Impossible audio mode »).
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'duckOthers' });
    } catch {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    }
    try {
      await recorder.prepareToRecordAsync();
    } catch (error) {
      // Format 16 kHz refusé par ce téléphone : on retombe sur le format standard (m4a), que le serveur accepte aussi.
      console.warn('Enregistrement : format 16 kHz refusé, repli sur le format standard.', error instanceof Error ? error.message : error);
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
    }
    recorder.record();
    setPhase('recording');
    return 'ok';
  }, [recorder]);

  const pause = useCallback(() => {
    recorder.pause();
    setPhase('paused');
  }, [recorder]);

  const resume = useCallback(() => {
    recorder.record();
    setPhase('recording');
  }, [recorder]);

  /** Arrête et rend le fichier avec sa durée ; null s'il n'y a rien. */
  const stop = useCallback(async (): Promise<{ uri: string; ms: number } | null> => {
    const ms = state.durationMillis;
    await recorder.stop();
    setPhase('idle');
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    const uri = recorder.uri;
    return uri ? { uri, ms } : null;
  }, [recorder, state.durationMillis]);

  /** Annule : l'enregistrement est jeté. */
  const cancel = useCallback(async () => {
    await recorder.stop().catch(() => undefined);
    setPhase('idle');
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
  }, [recorder]);

  return { phase, ms: state.durationMillis, level: meteringToLevel(state.metering), start, pause, resume, stop, cancel };
}
