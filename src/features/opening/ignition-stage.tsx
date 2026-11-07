import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ignitionLayout } from './ignition-layout';
import { markAssetReady, openingTime } from './opening-store';
import { ignitionCurves } from './opening-timeline';

const DARK = require('../../../assets/images/ignition/dark.webp');
const LIT = require('../../../assets/images/ignition/lit.webp');

const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

/**
 * L'ouverture : la photo sombre de la voiture (à peine une silhouette), puis, d'un seul coup, la photo où les phares sont
 * allumés (faisceaux et reflets sur le sol) ; le moteur démarre à cet instant (voir `opening-gate`). Enfin le noir se retire sur
 * l'application. Aucune autre animation : seules des opacités changent (fil d'interface).
 *
 * Les photos sont en paysage : la partie utile est ajustée à la largeur de l'écran sur fond noir, et leur haut et leur bas se
 * fondent dans le noir (pas de bord net).
 */
export function IgnitionStage() {
  const { width, height } = useWindowDimensions();
  const { frame, topFade, bottomFade } = ignitionLayout(width, height);
  const position = { position: 'absolute', ...frame } as const;

  const curves = useDerivedValue(() => ignitionCurves(openingTime.value));
  const stage = useAnimatedStyle(() => ({ opacity: curves.value.stage }));
  const dark = useAnimatedStyle(() => ({ opacity: curves.value.dark }));
  const lit = useAnimatedStyle(() => ({ opacity: curves.value.lit }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[FILL, { backgroundColor: '#000000' }, stage]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={FILL}>
        <Animated.Image
          source={DARK}
          resizeMode="stretch"
          fadeDuration={0}
          style={[position, dark]}
          onLoad={() => markAssetReady('ignition-dark')}
          accessible={false}
        />
        <Animated.Image
          source={LIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={[position, lit]}
          onLoad={() => markAssetReady('ignition-lit')}
          accessible={false}
        />
        {/* Fondus vers le noir en haut et en bas de la photo : aucun bord visible. */}
        <Svg width={width} height={height} style={FILL}>
          <Defs>
            <LinearGradient id="ig-top" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="1" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="ig-bottom" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={topFade.top} width={width} height={topFade.height} fill="url(#ig-top)" />
          <Rect
            x={0}
            y={bottomFade.top}
            width={width}
            height={bottomFade.height}
            fill="url(#ig-bottom)"
          />
        </Svg>
      </View>
    </Animated.View>
  );
}
