import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { endOpening, startOpening } from './opening-store';
import type { OpeningEnd } from './opening-state';

const INTRO = require('../../../assets/video/bibip-intro-vertical-court.mp4');

/** Instant (ms après le début de la lecture) de l'allumage des phares : une seule vibration légère. */
const HAPTIC_AT_MS = 850;
/** Si la vidéo ne démarre pas dans ce délai (fichier illisible, lecteur lent), on passe directement à l'application. */
const START_LIMIT_MS = 4000;
/** Fondu final vers l'application. */
const FADE_MS = 350;

/**
 * Vidéo d'ouverture plein écran : rideau noir, vidéo en `cover`, son mélangé à la musique éventuelle du téléphone (elle n'est
 * pas coupée). Un toucher la passe (voir `opening-gate`). À la fin, ou en cas d'erreur, fondu vers l'application.
 */
export function IntroVideo({ skipped }: { skipped: boolean }) {
  const opacity = useSharedValue(1);
  const finished = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const player = useVideoPlayer(INTRO, (instance) => {
    instance.loop = false;
    instance.audioMixingMode = 'mixWithOthers';
    instance.play();
  });

  const finish = (reason: OpeningEnd) => {
    if (finished.current) return;
    finished.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (reason === 'aborted') {
      endOpening(reason);
      return;
    }
    opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (done) => {
      if (done) runOnJS(endOpening)(reason);
    });
    if (reason === 'skipped') player.pause();
  };

  // Toucher : le gate nous le signale.
  useEffect(() => {
    if (skipped) finish('skipped');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipped]);

  // Garde-fou : la lecture doit démarrer rapidement.
  useEffect(() => {
    const guard = setTimeout(() => finish('aborted'), START_LIMIT_MS);
    timers.current.push(guard);
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEventListener(player, 'playToEnd', () => finish('completed'));
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') finish('aborted');
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Dès que la lecture démarre : on annule le garde-fou, et on programme l'unique vibration (phares allumés).
  useEffect(() => {
    if (!isPlaying || finished.current) return;
    startOpening();
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => {
        if (finished.current) return;
        try {
          // Chargé à la demande : sans module de vibration, l'ouverture reste simplement muette côté toucher.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Haptics = require('expo-haptics') as typeof import('expo-haptics');
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        } catch {
          // Pas de vibration disponible.
        }
      }, HAPTIC_AT_MS),
      // Sécurité : jamais bloqué si l'événement de fin n'arrive pas (durée 4,4 s).
      setTimeout(() => finish('completed'), 6500),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        fullscreenOptions={{ enable: false }}
      />
    </Animated.View>
  );
}
