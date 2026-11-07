import { useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';

import { markAssetReady, openingTime } from './opening-store';
import { ignitionCurves } from './opening-timeline';

const DARK = require('../../../assets/images/ignition/dark.webp');
const LIT = require('../../../assets/images/ignition/lit.webp');
/** Les deux photos (mêmes dimensions et même cadrage : seule la lumière change). */
const IMAGE = { width: 941, height: 1671 } as const;

const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

/**
 * L'ouverture : la photo sombre de la voiture (à peine une silhouette), puis la photo allumée apparaît par-dessus en fondu
 * continu : les phares, leurs reflets sur le sol et la ligne de lumière s'éveillent comme sur une vraie voiture. Le moteur
 * démarre ensuite (voir `opening-gate`). Enfin le noir se retire sur l'application. Aucune autre animation.
 *
 * Les photos couvrent l'écran (cadrage centré sur la voiture) ; seules des opacités sont animées (fil d'interface).
 */
export function IgnitionStage() {
  const { width, height } = useWindowDimensions();
  const scale = Math.max(width / IMAGE.width, height / IMAGE.height);
  const w = IMAGE.width * scale;
  const h = IMAGE.height * scale;
  const frame = {
    position: 'absolute',
    left: (width - w) / 2,
    top: (height - h) / 2,
    width: w,
    height: h,
  } as const;

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
          style={[frame, dark]}
          onLoad={() => markAssetReady('ignition-dark')}
          accessible={false}
        />
        <Animated.Image
          source={LIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={[frame, lit]}
          onLoad={() => markAssetReady('ignition-lit')}
          accessible={false}
        />
      </View>
    </Animated.View>
  );
}
