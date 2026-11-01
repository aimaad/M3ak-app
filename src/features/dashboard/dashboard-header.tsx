import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, Pressable, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';
import { NotificationBell } from '@/features/notifications/notification-bell';
import {
  endOpening,
  openingTime,
  startOpening,
  useOpeningStatus,
} from '@/features/opening/opening-store';
import { OPENING_PHASES as P } from '@/features/opening/opening-timeline';
import { Reveal, useReveal } from '@/features/opening/reveal';
import { useLanguage } from '@/i18n/use-language';
import { getInitials } from '@/lib/initials';

import { headerFirstName } from './header-format';
import { HeroOpening, type MarkTarget } from './hero-opening';
import { HERO_DARK, HERO_FADE_HEIGHT, HeroScene } from './hero-scene';
import type { DashboardPeriod } from './kpis';
import { PeriodTabs } from './period-tabs';

// Version éclaircie du logo, sur fond transparent : lisible directement sur le fond sombre (sans pastille).
const MARK = require('../../../assets/images/logo-m3ak-ribbon-light.png');
/** Proportions du logo (640 × 373). */
const MARK_RATIO = 640 / 373;

const DARK = HERO_DARK;
/** Petite ligne décorative : champagne rosé vers champagne clair (seule touche dorée de l'interface). */
const CHAMPAGNE = '#C9A58B';
const CHAMPAGNE_LIGHT = '#E8C7A8';
const FADE_HEIGHT = HERO_FADE_HEIGHT;
const TABS_GAP = 21;
/** Hauteur de la petite barre fixe (sous la zone de sécurité). */
const COMPACT_BAR = 56;

function LogoMark({ height }: { height: number }) {
  return (
    <Image source={MARK} resizeMode="contain" style={{ width: height * MARK_RATIO, height }} />
  );
}

/** Rond de profil (photo ou initiales) à contour lavande : ouvre le profil. Même bouton dans le hero et dans la petite barre. */
function ProfileButton({ path, initials }: { path: string | null | undefined; initials: string }) {
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={() => router.push('/profil')}
      accessibilityRole="button"
      accessibilityLabel={t('accueil.header.profile')}
      className="h-11 w-11 items-center justify-center rounded-full border-2 border-lavender active:border-white"
    >
      <Avatar path={path} size={40} initials={initials} />
    </Pressable>
  );
}

/** Bouton rond de 44 × 44 : disque translucide et trait fin. */
function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/25 active:bg-white/25"
    >
      <Ionicons name={icon} size={21} color="#FFFFFF" />
    </Pressable>
  );
}

type DashboardHeaderProps = {
  /** Prénom du profil (peut manquer). */
  prenom?: string | null;
  /** Nom complet, utilisé si le prénom manque. */
  fullName?: string | null;
  agencyName?: string | null;
  avatarPath?: string | null;
  /** Période choisie (Aujourd'hui / 7 jours / 30 jours) et son changement : le sélecteur est posé sur le bas du hero. */
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  /** Hauteur mesurée du hero (pour que la petite barre sache quand apparaître). */
  onHeight?: (height: number) => void;
  /** Position de défilement de la page : sert uniquement à la parallaxe discrète de la photo. */
  scrollY?: SharedValue<number>;
};

/**
 * Hero du tableau de bord : photo, logo M3ak et actions (question à M3ak, notifications, profil), salutation, accroche et
 * sélecteur de période. Il fait partie du contenu de la page et défile normalement avec elle (il ne reste pas collé en haut).
 * Aucune largeur fixe : tout se réduit ou se coupe proprement jusqu'à 320 dp.
 */
export function DashboardHeader({
  prenom,
  fullName,
  agencyName,
  avatarPath,
  period,
  onPeriodChange,
  onHeight,
  scrollY,
}: DashboardHeaderProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // Ouverture : chaque élément du hero apparaît à son heure sur l'horloge unique (voir features/opening). Hors ouverture,
  // l'horloge est à la fin et tout est simplement visible.
  const opening = useOpeningStatus();
  const [imageReady, setImageReady] = useState(false);
  const [wrapperBox, setWrapperBox] = useState<{ x: number; y: number } | null>(null);
  const [markBox, setMarkBox] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const markTarget: MarkTarget | null =
    wrapperBox && markBox
      ? {
          x: wrapperBox.x + markBox.x,
          y: wrapperBox.y + markBox.y,
          width: markBox.w,
          height: markBox.h,
        }
      : null;
  // Le vrai logo prend la place du logo volant à l'instant exact de son arrivée.
  const markVisible = useAnimatedStyle(() => ({
    opacity: openingTime.value >= P.flightEnd ? 1 : 0,
  }));
  const nameReveal = useReveal(P.awakeningStart + 100, P.awakeningStart + 600);
  const greetingReveal = useReveal(P.awakeningStart + 250, P.awakeningStart + 750, 10);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // Dès que la photo est affichée et que le logo est mesuré, on lance la chronologie ; sinon on abandonne proprement.
  const ready = !!size && imageReady && !!markTarget;
  useEffect(() => {
    if (opening === 'armed' && ready && size) startOpening(size.height);
  }, [opening, ready, size]);
  const logoHeight = screenWidth < 340 ? 40 : screenWidth < 375 ? 46 : 52;
  const showName = screenWidth >= 340;
  const showAgency = screenWidth >= 375 && !!agencyName?.trim();

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => {
      if (
        previous &&
        Math.abs(previous.width - width) < 1 &&
        Math.abs(previous.height - height) < 1
      )
        return previous;
      onHeight?.(height);
      return { width, height };
    });
  };

  const firstName = headerFirstName(prenom, fullName);
  const initials = getInitials(fullName ?? firstName);
  const greeting = firstName
    ? t('accueil.header.greeting', { name: firstName })
    : t('accueil.header.greetingNoName');
  // Le prénom est mis en lavande lumineuse : on coupe le texte traduit autour d'un repère à la place du prénom.
  const MARKER = '\uE000';
  const greetingParts = firstName
    ? t('accueil.header.greeting', { name: MARKER }).split(MARKER)
    : null;
  const hasTwoParts = greetingParts?.length === 2;

  return (
    <View onLayout={onLayout} style={{ backgroundColor: DARK, overflow: 'hidden' }}>
      {/* Les onglets restent montés : on ne règle la barre d'état (icônes claires) que lorsque l'Accueil est affiché. */}
      {focused ? <StatusBar style="light" /> : null}
      {size ? (
        <HeroScene
          width={size.width}
          height={size.height}
          scrollY={scrollY}
          reduceMotion={reduceMotion}
          onReady={() => setImageReady(true)}
          onError={endOpening}
        />
      ) : null}
      {size && opening !== 'idle' ? (
        <HeroOpening width={size.width} height={size.height} markTarget={markTarget} />
      ) : null}

      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: FADE_HEIGHT,
          paddingStart: insets.left + 20,
          paddingEnd: insets.right + 20,
        }}
      >
        <View className="flex-row items-center justify-between" style={{ minHeight: 48, gap: 12 }}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="M3ak"
            onLayout={(event) => {
              const { x, y } = event.nativeEvent.layout;
              setWrapperBox((previous) =>
                previous && previous.x === x && previous.y === y ? previous : { x, y }
              );
            }}
            // Mise en page en style (et non en classe) : les classes ne s'appliquent pas au conteneur animé.
            style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Animated.View
              onLayout={(event) => {
                const { x, y, width, height } = event.nativeEvent.layout;
                setMarkBox((previous) =>
                  previous &&
                  previous.x === x &&
                  previous.y === y &&
                  previous.w === width &&
                  previous.h === height
                    ? previous
                    : { x, y, w: width, h: height }
                );
              }}
              style={markVisible}
            >
              <LogoMark height={logoHeight} />
            </Animated.View>
            {showName ? (
              <Animated.View
                style={[
                  { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
                  nameReveal,
                ]}
              >
                <View
                  style={{
                    width: 1,
                    height: logoHeight * 0.62,
                    backgroundColor: 'rgba(255,255,255,0.35)',
                  }}
                />
                <View className="shrink">
                  <ThemedText
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={{
                      color: '#FFFFFF',
                      fontSize: 22,
                      lineHeight: 26,
                      letterSpacing: -0.3,
                      fontFamily: fontFamilyFor('fr', 'extrabold'),
                    }}
                  >
                    M3ak
                  </ThemedText>
                  {showAgency ? (
                    <ThemedText
                      numberOfLines={1}
                      style={{
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: 11,
                        lineHeight: 14,
                        fontFamily: fontFamilyFor(language, 'medium'),
                      }}
                    >
                      {agencyName?.trim()}
                    </ThemedText>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}
          </View>
          <View className="shrink-0 flex-row items-center" style={{ gap: 8 }}>
            <Reveal from={P.awakeningStart + 150} to={P.awakeningStart + 600}>
              <HeaderIconButton
                icon="search-outline"
                label={t('accueil.header.search')}
                onPress={() => router.push('/chat')}
              />
            </Reveal>
            <Reveal from={P.awakeningStart + 230} to={P.awakeningStart + 680}>
              <NotificationBell tone="onForest" />
            </Reveal>
            <Reveal from={P.awakeningStart + 310} to={P.awakeningStart + 760}>
              <ProfileButton path={avatarPath} initials={initials} />
            </Reveal>
          </View>
        </View>

        <Animated.View style={[{ marginTop: 18, maxWidth: '62%' }, greetingReveal]}>
          <ThemedText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            accessibilityRole="header"
            style={{
              color: '#FFFFFF',
              fontSize: 24,
              lineHeight: 31,
              fontFamily: fontFamilyFor(language, 'bold'),
            }}
          >
            {greetingParts && hasTwoParts ? (
              <>
                {greetingParts[0]}
                <ThemedText
                  style={{
                    color: M3akPalette.lavender,
                    fontSize: 24,
                    lineHeight: 31,
                    fontFamily: fontFamilyFor(language, 'bold'),
                  }}
                >
                  {firstName}
                </ThemedText>
                {greetingParts[1]}
              </>
            ) : (
              greeting
            )}
          </ThemedText>
          <ThemedText
            numberOfLines={3}
            style={{
              marginTop: 4,
              maxWidth: '100%',
              color: 'rgba(255,255,255,0.86)',
              fontSize: 11.5,
              lineHeight: 16,
              fontFamily: fontFamilyFor(language, 'medium'),
            }}
          >
            {t('accueil.header.tagline')}
          </ThemedText>
          <View
            style={{ marginTop: 12, width: 38, height: 3, borderRadius: 2, overflow: 'hidden' }}
          >
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="kh-accent" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={CHAMPAGNE} />
                  <Stop offset="1" stopColor={CHAMPAGNE_LIGHT} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#kh-accent)" />
            </Svg>
          </View>
        </Animated.View>

        <View style={{ marginTop: TABS_GAP + 6 }}>
          <Reveal from={P.awakeningStart + 450} to={P.end}>
            <PeriodTabs value={period} onChange={onPeriodChange} />
          </Reveal>
        </View>
      </View>
    </View>
  );
}

/**
 * Petite barre fixe en haut (logo M3ak, notifications, profil) : invisible tant que le hero est à l'écran, elle apparaît en
 * fondu dès que le hero a défilé et reste alors collée en haut. `scrollY` vient de la liste (fil d'interface, sans saccade).
 */
export function CompactTopBar({
  scrollY,
  heroHeight,
  prenom,
  fullName,
  avatarPath,
}: {
  scrollY: SharedValue<number>;
  heroHeight: number;
  prenom?: string | null;
  fullName?: string | null;
  avatarPath?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const barHeight = insets.top + COMPACT_BAR;
  // Elle apparaît quand les boutons du hero (en haut) sortent de l'écran, bien avant la fin du hero.
  const from = Math.max(insets.top + 40, Math.min(heroHeight - barHeight - 40, 120));
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [from, from + 50], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [from, from + 50], [-10, 0], Extrapolation.CLAMP) },
    ],
  }));
  const props = useAnimatedProps(() => ({
    pointerEvents: scrollY.value > from + 20 ? ('auto' as const) : ('none' as const),
  }));
  const initials = getInitials(fullName ?? headerFirstName(prenom, fullName));

  return (
    <Animated.View
      animatedProps={props}
      style={[
        {
          position: 'absolute',
          top: 0,
          start: 0,
          end: 0,
          height: barHeight,
          paddingTop: insets.top,
          paddingStart: insets.left + 20,
          paddingEnd: insets.right + 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          backgroundColor: DARK,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.08)',
          shadowColor: '#000000',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        style,
      ]}
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="M3ak"
        className="shrink flex-row items-center"
        style={{ gap: 8 }}
      >
        <LogoMark height={40} />
        <ThemedText
          numberOfLines={1}
          style={{
            color: '#FFFFFF',
            fontSize: 20,
            lineHeight: 24,
            letterSpacing: -0.3,
            fontFamily: fontFamilyFor('fr', 'extrabold'),
          }}
        >
          M3ak
        </ThemedText>
      </View>
      <View className="shrink-0 flex-row items-center" style={{ gap: 8 }}>
        <NotificationBell tone="onForest" />
        <ProfileButton path={avatarPath} initials={initials} />
      </View>
    </Animated.View>
  );
}
