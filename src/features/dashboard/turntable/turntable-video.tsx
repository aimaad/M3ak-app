import { useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

import { shouldRunShowroom } from '../showroom/showroom-math';
import type { turntableLayout } from './turntable-math';

/**
 * Voiture 360° du hero : vidéo MP4 en boucle (rendu Blender du vrai modèle 3D, décor du hero inclus), posée exactement sur
 * l'emplacement de l'ancienne voiture de la photo. Muette, sans contrôles, sans écran toujours allumé ni lecture en arrière-plan.
 *
 * Suspension : la lecture est mise en pause (et reprend là où elle s'était arrêtée) dès que l'écran n'est plus affiché, que
 * l'application passe en arrière-plan, que le hero est sorti de l'écran par le défilement, ou que l'utilisateur a demandé de
 * réduire les animations. Tant que la première image n'est pas affichée, la vidéo est invisible : on voit la photo fixe, sans
 * clignotement. En cas d'erreur de lecture, `onFail` ramène le hero à la photo fixe.
 */
export function TurntableVideo({
  source,
  layout,
  scrollY,
  heroHeight,
  onReady,
  onFail,
}: {
  source: VideoSource;
  layout: ReturnType<typeof turntableLayout>;
  scrollY?: SharedValue<number>;
  heroHeight: number;
  onReady?: () => void;
  onFail: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [heroVisible, setHeroVisible] = useState(true);
  const [ready, setReady] = useState(false);

  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.keepScreenOnWhilePlaying = false;
    instance.staysActiveInBackground = false;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setAppActive(state === 'active')
    );
    return () => subscription.remove();
  }, []);

  // Le hero n'est plus à l'écran dès que la page a défilé de plus de sa hauteur : l'état ne change qu'à ce passage.
  useAnimatedReaction(
    () => (scrollY ? scrollY.value < heroHeight - 40 : true),
    (visible, previous) => {
      if (visible !== previous) runOnJS(setHeroVisible)(visible);
    },
    [heroHeight]
  );

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') onFail();
    });
    return () => subscription.remove();
  }, [player, onFail]);

  // `loaded` vaut toujours vrai ici : la lecture doit démarrer pour que la première image s'affiche.
  const run = shouldRunShowroom({ focused, appActive, heroVisible, reduceMotion, loaded: true });
  useEffect(() => {
    if (run) player.play();
    else player.pause();
  }, [run, player]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
        opacity: ready ? 1 : 0,
      }}
    >
      <VideoView
        player={player}
        nativeControls={false}
        allowsPictureInPicture={false}
        // La vidéo a exactement les proportions de la zone : « fill » ne déforme rien. Sur Android, « textureView » suit
        // correctement le défilement et la parallaxe (le « surfaceView » par défaut se rogne et se décale).
        contentFit="fill"
        surfaceType="textureView"
        onFirstFrameRender={() => {
          setReady(true);
          onReady?.();
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
