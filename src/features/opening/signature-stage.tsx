import { Image, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { BIBIP_LOGO, BIBIP_LOGO_RATIO, BRAND_NAME } from '@/components/logo';
import { BibipPalette, fontFamilyFor } from '@/constants/theme';
import { rectCenter } from '@/features/dashboard/hero-layout';

import { LOGO_PATHS, LOGO_VIEWBOX } from './logo-path';
import { markAssetReady, openingTime, useHeroHeight, useLogoTarget } from './opening-store';
import { stageCurves, type StageCurves } from './opening-timeline';
import { signatureGeometry } from './signature-layout';

const FRONT_LIT = require('../../../assets/images/signature/front-lit.webp');
const FRONT_UNLIT = require('../../../assets/images/signature/front-unlit.webp');
const THREE_QUARTER = require('../../../assets/images/signature/three-quarter.webp');

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Curves = SharedValue<StageCurves>;
type Progress = 'line' | 'trace1' | 'trace2' | 'trail';

const FILL = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;

/** Un trait lumineux qui se dessine (progression pilotée par l'horloge) : halo large, trait moyen, cœur clair. */
function GlowStroke({
  d,
  length,
  curves,
  field,
  layers,
  cap = 'round',
}: {
  d: string;
  length: number;
  curves: Curves;
  field: Progress;
  layers: readonly { width: number; color: string; opacity: number }[];
  cap?: 'round' | 'butt';
}) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - curves.value[field]),
  }));
  return (
    <>
      {layers.map((layer, index) => (
        <AnimatedPath
          key={index}
          d={d}
          fill="none"
          stroke={layer.color}
          strokeOpacity={layer.opacity}
          strokeWidth={layer.width}
          strokeLinecap={cap}
          strokeLinejoin="round"
          strokeDasharray={[length, length]}
          animatedProps={animatedProps}
        />
      ))}
    </>
  );
}

const GLOW_LAYERS = [
  { width: 16, color: BibipPalette.primary, opacity: 0.22 },
  { width: 6, color: BibipPalette.primary, opacity: 0.7 },
  { width: 2.2, color: BibipPalette.mint, opacity: 1 },
] as const;
const LIME_LAYERS = [
  { width: 14, color: BibipPalette.lime, opacity: 0.2 },
  { width: 5, color: BibipPalette.lime, opacity: 0.65 },
  { width: 2, color: BibipPalette.mint, opacity: 1 },
] as const;

/**
 * Scène d'introduction « Signature Ignition » (2,0 s), posée par-dessus l'application : ligne d'impulsion, voiture de face
 * qui s'éveille, B du logo tracé par la lumière, logo qui rejoint le coin du hero, voiture qui passe en trois-quarts à droite,
 * puis le fond se retire sur le showroom et le dashboard. Tout est animé individuellement par une seule horloge ; aucun
 * élément ne déclenche de rendu React pendant l'animation.
 */
export function SignatureStage() {
  const { width, height } = useWindowDimensions();
  const heroHeight = useHeroHeight();
  const logoTarget = useLogoTarget();
  const g = signatureGeometry(width, height, heroHeight);
  const curves = useDerivedValue(() => stageCurves(openingTime.value));

  const background = useAnimatedStyle(() => ({ opacity: curves.value.background }));
  const backgroundBelow = useAnimatedStyle(() => ({ opacity: curves.value.backgroundBelow }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: curves.value.lineOpacity }));
  const trailStyle = useAnimatedStyle(() => ({ opacity: curves.value.trailOpacity }));
  const bStyle = useAnimatedStyle(() => ({ opacity: curves.value.bGlow }));
  const bFill = useAnimatedStyle(() => ({ opacity: curves.value.bFill }));
  const frontStyle = useAnimatedStyle(() => ({ opacity: curves.value.front }));
  const litStyle = useAnimatedStyle(() => ({ opacity: curves.value.lit }));
  const floorStyle = useAnimatedStyle(() => ({ opacity: curves.value.floor }));
  const wordmarkStyle = useAnimatedStyle(() => ({ opacity: curves.value.wordmark }));

  // Voiture en trois-quarts : part de la place de la voiture de face et glisse jusqu'à sa place dans le hero.
  const threeFrom = rectCenter(g.three.start);
  const threeTo = rectCenter(g.three.end);
  const threeScale = g.three.start.width / g.three.end.width;
  const threeStyle = useAnimatedStyle(() => {
    const k = 1 - curves.value.threeQuarterMove;
    return {
      opacity: curves.value.threeQuarter,
      transform: [
        { translateX: (threeFrom.x - threeTo.x) * k },
        { translateY: (threeFrom.y - threeTo.y) * k },
        { scale: 1 + (threeScale - 1) * k },
      ],
    };
  });

  // Logo : naît à la place du B tracé, puis rejoint (en rétrécissant) sa pastille dans le hero.
  const tileHeight = logoTarget ? logoTarget.height : 0;
  const padding = Math.round(tileHeight * 0.12);
  const innerHeight = tileHeight - padding * 2;
  const innerWidth = innerHeight * BIBIP_LOGO_RATIO;
  const logoFrom = rectCenter(g.logo);
  const logoTo = logoTarget
    ? { x: logoTarget.x + logoTarget.width / 2, y: logoTarget.y + logoTarget.height / 2 }
    : logoFrom;
  const logoScale = innerWidth > 0 ? g.logo.width / innerWidth : 1;
  const logoStyle = useAnimatedStyle(() => {
    const k = 1 - curves.value.logoFly;
    return {
      opacity: curves.value.logo,
      transform: [
        { translateX: (logoFrom.x - logoTo.x) * k },
        { translateY: (logoFrom.y - logoTo.y) * k },
        { scale: 1 + (logoScale - 1) * k },
      ],
    };
  });
  const tileStyle = useAnimatedStyle(() => ({ opacity: curves.value.tile }));

  return (
    <View
      pointerEvents="none"
      style={FILL}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Fond : vert forêt presque noir. Sur le hero il se retire dès 1,35 s (le showroom apparaît), sous le hero dès 1,5 s. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: heroHeight,
            backgroundColor: BibipPalette.night,
          },
          background,
        ]}
      />
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, top: heroHeight, bottom: 0 },
          backgroundBelow,
        ]}
      >
        <Svg width={width} height={Math.max(height - heroHeight, 0)}>
          <Defs>
            <LinearGradient id="sg-bg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={BibipPalette.night} />
              <Stop offset="0.6" stopColor={BibipPalette.night} />
              <Stop offset="1" stopColor={BibipPalette.primaryDeep} />
            </LinearGradient>
          </Defs>
          <Path d={`M0 0 H${width} V${height} H0 Z`} fill="url(#sg-bg)" />
        </Svg>
      </Animated.View>

      {/* Scène 1 : la ligne émeraude se dessine du centre vers les extrémités. */}
      <Animated.View style={[FILL, lineStyle]}>
        <Svg width={width} height={height}>
          <GlowStroke
            d={g.line.left.d}
            length={g.line.left.length}
            curves={curves}
            field="line"
            layers={GLOW_LAYERS}
          />
          <GlowStroke
            d={g.line.right.d}
            length={g.line.right.length}
            curves={curves}
            field="line"
            layers={GLOW_LAYERS}
          />
        </Svg>
      </Animated.View>

      {/* Scène 3 : le B du logo (contours exacts du logo fourni) est tracé par la lumière, derrière la voiture. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: g.logo.left,
            top: g.logo.top,
            width: g.logo.width,
            height: g.logo.height,
          },
          bStyle,
        ]}
      >
        <Svg
          width={g.logo.width}
          height={g.logo.height}
          viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
        >
          <Defs>
            <LinearGradient id="sg-bfill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={BibipPalette.primary} stopOpacity="0.55" />
              <Stop offset="1" stopColor={BibipPalette.primaryDeep} stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          <GlowStroke
            d={LOGO_PATHS[0].d}
            length={LOGO_PATHS[0].length}
            curves={curves}
            field="trace1"
            layers={GLOW_LAYERS.map((l) => ({ ...l, width: l.width * 2.6 }))}
          />
          {LOGO_PATHS[1] ? (
            <GlowStroke
              d={LOGO_PATHS[1].d}
              length={LOGO_PATHS[1].length}
              curves={curves}
              field="trace2"
              layers={LIME_LAYERS.map((l) => ({ ...l, width: l.width * 2.6 }))}
            />
          ) : null}
        </Svg>
        <Animated.View style={[FILL, bFill]}>
          <Svg
            width={g.logo.width}
            height={g.logo.height}
            viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
          >
            <Path
              d={LOGO_PATHS.map((p) => p.d).join(' ')}
              fill="url(#sg-bfill)"
              fillRule="evenodd"
            />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Traînée lumineuse qui prolonge le mouvement vers le sol. */}
      <Animated.View style={[FILL, trailStyle]}>
        <Svg width={width} height={height}>
          <GlowStroke
            d={g.trail.d}
            length={g.trail.length}
            curves={curves}
            field="trail"
            layers={[
              { width: 22, color: BibipPalette.primary, opacity: 0.2 },
              { width: 8, color: BibipPalette.primary, opacity: 0.6 },
              { width: 2.4, color: BibipPalette.mint, opacity: 0.95 },
            ]}
          />
        </Svg>
      </Animated.View>

      {/* Reflet des phares sur le sol : la voiture retournée, qui s'estompe vers le bas. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: g.front.left,
            top: g.front.top + g.front.height - 2,
            width: g.front.width,
            height: g.front.height * 0.55,
            overflow: 'hidden',
          },
          floorStyle,
        ]}
      >
        <Image
          source={FRONT_LIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: g.front.width,
            height: g.front.height,
            transform: [{ scaleY: -1 }],
          }}
          accessible={false}
        />
        <Svg
          width={g.front.width}
          height={g.front.height * 0.55}
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          <Defs>
            <LinearGradient id="sg-floor" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={BibipPalette.night} stopOpacity="0.2" />
              <Stop offset="0.85" stopColor={BibipPalette.night} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path d={`M0 0 H${g.front.width} V${g.front.height * 0.55} H0 Z`} fill="url(#sg-floor)" />
        </Svg>
      </Animated.View>

      {/* Scène 2 : la Mercedes de face apparaît dans l'obscurité, puis les phares s'allument. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: g.front.left,
            top: g.front.top,
            width: g.front.width,
            height: g.front.height,
          },
          frontStyle,
        ]}
      >
        <Image
          source={FRONT_UNLIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={{ width: g.front.width, height: g.front.height }}
          onLoad={() => markAssetReady('front-unlit')}
          accessible={false}
        />
        <Animated.Image
          source={FRONT_LIT}
          resizeMode="stretch"
          fadeDuration={0}
          style={[
            { position: 'absolute', left: 0, top: 0, width: g.front.width, height: g.front.height },
            litStyle,
          ]}
          onLoad={() => markAssetReady('front-lit')}
          accessible={false}
        />
      </Animated.View>

      {/* Scène 4 : la même voiture, en trois-quarts, rejoint sa place dans le hero. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: g.three.end.left,
            top: g.three.end.top,
            width: g.three.end.width,
            height: g.three.end.height,
          },
          threeStyle,
        ]}
      >
        <Image
          source={THREE_QUARTER}
          resizeMode="stretch"
          fadeDuration={0}
          style={{ width: g.three.end.width, height: g.three.end.height }}
          accessible={false}
        />
      </Animated.View>

      {/* Le nom BIBIP accompagne le logo quand il se forme. */}
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, top: g.wordmark.top, alignItems: 'center' },
          wordmarkStyle,
        ]}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: '#FFFFFF',
            fontSize: g.wordmark.fontSize,
            lineHeight: g.wordmark.fontSize * 1.25,
            letterSpacing: 3,
            fontFamily: fontFamilyFor('fr', 'extrabold'),
            transform: [{ skewX: '-10deg' }],
          }}
        >
          {BRAND_NAME}
        </Text>
      </Animated.View>

      {/* Le logo (le même que dans le hero) se forme à la place du B puis rejoint sa pastille ivoire en haut à gauche. */}
      {logoTarget ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: logoTarget.x,
              top: logoTarget.y,
              width: logoTarget.width,
              height: logoTarget.height,
              alignItems: 'center',
              justifyContent: 'center',
            },
            logoStyle,
          ]}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                borderRadius: Math.round(tileHeight * 0.3),
                backgroundColor: BibipPalette.background,
              },
              tileStyle,
            ]}
          />
          <Image
            source={BIBIP_LOGO}
            resizeMode="contain"
            style={{ width: innerWidth, height: innerHeight }}
            accessible={false}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
