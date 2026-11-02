import { Image, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { markAssetReady, openingTime } from '@/features/opening/opening-store';
import { carCurves, type CarCurves, type OpeningMode } from '@/features/opening/opening-timeline';

import { CAR_LAMPS } from './hero-layout';

export const CAR_UNLIT = require('../../../assets/images/ignition/car-unlit.webp');
export const CAR_LIT = require('../../../assets/images/ignition/car-lit.webp');

const NIGHT = '#100B19';
/** Mode de fusion des lumières (désactivable pour le diagnostic : EXPO_PUBLIC_OPENING_NO_BLEND=1). */
export const BLEND =
  process.env.EXPO_PUBLIC_OPENING_NO_BLEND === '1' ? undefined : ('screen' as const);

type Props = {
  width: number;
  height: number;
  /** Effets de l'ouverture (phares progressifs, lumière violette, halo). Sans effets : simple voiture, phares allumés. */
  effects: boolean;
  mode: OpeningMode;
  /** Précharge l'image « phares éteints » (utile avant le raccord du premier lancement). */
  preloadUnlit?: boolean;
};

/**
 * La voiture (un seul calque d'image à l'état final) et tous ses effets lumineux. Les effets sont confinés à la silhouette :
 * ce sont des copies teintées de la même image, jamais des rectangles. Tout est piloté par l'horloge unique de l'ouverture.
 */
export function CarLights({ width, height, effects, mode, preloadUnlit }: Props) {
  if (!effects) {
    return (
      <View style={{ width, height }} pointerEvents="none">
        <Image
          source={CAR_LIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={{ width, height }}
          onLoad={() => markAssetReady('car-lit')}
          accessible={false}
        />
        {preloadUnlit ? (
          <Image
            source={CAR_UNLIT}
            fadeDuration={0}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01 }}
            onLoad={() => markAssetReady('car-unlit')}
            accessible={false}
          />
        ) : null}
      </View>
    );
  }
  return <CarWithEffects width={width} height={height} mode={mode} />;
}

function fill(width: number, height: number) {
  return { position: 'absolute', left: 0, top: 0, width, height } as const;
}

function CarWithEffects({
  width,
  height,
  mode,
}: {
  width: number;
  height: number;
  mode: OpeningMode;
}) {
  const curves = useDerivedValue(() => carCurves(mode, openingTime.value));

  const lit = useAnimatedStyle(() => ({ opacity: curves.value.lit }));
  const dim = useAnimatedStyle(() => ({ opacity: curves.value.dim }));
  const pulse = useAnimatedStyle(() => ({ opacity: curves.value.pulse }));

  return (
    <View style={{ width, height }} pointerEvents="none">
      <FloorPulse width={width} height={height} curves={curves} />
      {/* Silhouette : tout ce qui suit est rogné à la voiture (aucun rectangle visible). */}
      <View style={{ width, height, overflow: 'hidden' }}>
        <Image
          source={CAR_UNLIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={fill(width, height)}
          onLoad={() => markAssetReady('car-unlit')}
          accessible={false}
        />
        <Animated.Image
          source={CAR_LIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={[fill(width, height), lit]}
          onLoad={() => markAssetReady('car-lit')}
          accessible={false}
        />
        {/* Obscurité : la voiture est « éteinte » dans la nuit, puis s'éclaire. */}
        <Animated.Image
          source={CAR_UNLIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={[fill(width, height), { tintColor: NIGHT }, dim]}
          accessible={false}
        />
        {mode === 'first'
          ? [-2, -1, 0, 1, 2].map((step) => (
              <AheadStep key={step} step={step} width={width} height={height} curves={curves} />
            ))
          : null}
        <LightBand width={width} height={height} curves={curves} />
        <Animated.View
          style={[fill(width, height), { mixBlendMode: BLEND }, pulse]}
          pointerEvents="none"
        >
          <Image
            source={CAR_UNLIT}
            resizeMode="stretch"
            fadeDuration={0}
            style={[fill(width, height), { tintColor: '#8D31CC' }]}
            accessible={false}
          />
        </Animated.View>
      </View>
      <HeadlightGlow
        curves={curves}
        x={CAR_LAMPS.near.x * width}
        y={CAR_LAMPS.near.y * height}
        size={width * 0.34}
        strength={1}
      />
      <HeadlightGlow
        curves={curves}
        x={CAR_LAMPS.far.x * width}
        y={CAR_LAMPS.far.y * height}
        size={width * 0.2}
        strength={0.8}
      />
    </View>
  );
}

/**
 * Zone « pas encore balayée » (premier lancement) : tant que le front de lumière n'est pas passé, la voiture reste presque noire.
 * Trois marches décalées donnent un bord doux.
 */
function AheadStep({
  step,
  width,
  height,
  curves,
}: {
  step: number;
  width: number;
  height: number;
  curves: SharedValue<CarCurves>;
}) {
  const outer = useAnimatedStyle(() => {
    const edge = (curves.value.edge + step * 0.025) * width;
    const c = curves.value;
    // Opacité de chaque marche pour que l'ensemble donne exactement le niveau voulu.
    const opacity = c.dimAhead > c.dim ? 1 - Math.pow((1 - c.dimAhead) / (1 - c.dim), 1 / 5) : 0;
    return { opacity, transform: [{ translateX: edge - width }] };
  });
  const inner = useAnimatedStyle(() => {
    const edge = (curves.value.edge + step * 0.025) * width;
    return { transform: [{ translateX: width - edge }] };
  });
  return (
    <Animated.View
      style={[fill(width, height), { overflow: 'hidden' }, outer]}
      pointerEvents="none"
    >
      <Animated.View style={[fill(width, height), inner]}>
        <Image
          source={CAR_UNLIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={[fill(width, height), { tintColor: NIGHT }]}
          accessible={false}
        />
      </Animated.View>
    </Animated.View>
  );
}

const BAND_SLICES = 13;
const BAND_SLICE_WIDTH = 0.013;

/**
 * Bande de lumière violette qui glisse sur la carrosserie. Elle est faite de fines tranches (largeur entière, positions
 * entières : aucune couture) de la silhouette de la voiture, dont l'intensité suit une courbe en cloche : la lumière suit les
 * formes du véhicule et n'a aucun bord net ni rectangle visible.
 */
function LightBand({
  width,
  height,
  curves,
}: {
  width: number;
  height: number;
  curves: SharedValue<CarCurves>;
}) {
  return (
    <>
      {Array.from({ length: BAND_SLICES }, (_, i) => (
        <BandSlice key={i} index={i} width={width} height={height} curves={curves} />
      ))}
    </>
  );
}

function BandSlice({
  index,
  width,
  height,
  curves,
}: {
  index: number;
  width: number;
  height: number;
  curves: SharedValue<CarCurves>;
}) {
  const sliceWidth = Math.max(2, Math.round(BAND_SLICE_WIDTH * width));
  const rank = index - (BAND_SLICES - 1) / 2;
  const spread = rank / (BAND_SLICES / 3.6);
  const weight = Math.exp(-spread * spread);
  const x = (edge: number) => Math.round(edge * width) + Math.round(rank * sliceWidth);
  const outer = useAnimatedStyle(() => ({
    opacity: curves.value.band * weight,
    transform: [{ translateX: x(curves.value.edge) }],
  }));
  const inner = useAnimatedStyle(() => ({
    transform: [{ translateX: -x(curves.value.edge) }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: sliceWidth,
          height,
          overflow: 'hidden',
          mixBlendMode: BLEND,
        },
        outer,
      ]}
      pointerEvents="none"
    >
      <Animated.View style={[fill(width, height), inner]}>
        {/* La voiture elle-même, éclaircie : la lumière révèle les vrais reflets du métal. */}
        <Image
          source={CAR_UNLIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={[fill(width, height), { opacity: 0.9 }]}
          accessible={false}
        />
        {/* Léger voile violet. */}
        <Image
          source={CAR_UNLIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={[fill(width, height), { tintColor: '#CB83F5', opacity: 0.18 }]}
          accessible={false}
        />
      </Animated.View>
    </Animated.View>
  );
}

/** Halo blanc lavande autour d'un phare (pas de rectangle : dégradé radial qui s'éteint avant les bords). */
function HeadlightGlow({
  curves,
  x,
  y,
  size,
  strength,
}: {
  curves: SharedValue<CarCurves>;
  x: number;
  y: number;
  size: number;
  strength: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: curves.value.glow * strength,
    transform: [{ scale: 0.75 + 0.25 * curves.value.glow }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          mixBlendMode: BLEND,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="cl-glow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#F8F3FC" stopOpacity="0.8" />
            <Stop offset="0.3" stopColor="#CB83F5" stopOpacity="0.4" />
            <Stop offset="0.7" stopColor="#8D31CC" stopOpacity="0.08" />
            <Stop offset="1" stopColor="#8D31CC" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#cl-glow)" />
      </Svg>
    </Animated.View>
  );
}

/** Impulsion violette très discrète sur le sol, sous la voiture. */
function FloorPulse({
  width,
  height,
  curves,
}: {
  width: number;
  height: number;
  curves: SharedValue<CarCurves>;
}) {
  const style = useAnimatedStyle(() => ({ opacity: curves.value.floor }));
  const w = width * 1.15;
  const h = height * 0.5;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: (width - w) / 2,
          top: height * 0.72,
          width: w,
          height: h,
          mixBlendMode: BLEND,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="cl-floor" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#8D31CC" stopOpacity="0.65" />
            <Stop offset="0.55" stopColor="#8D31CC" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#8D31CC" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#cl-floor)" />
      </Svg>
    </Animated.View>
  );
}
