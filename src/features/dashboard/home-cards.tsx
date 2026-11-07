import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, Brand, Palette, Themes } from '@/constants/theme';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

import { buildAreaPaths, hasTrend } from './chart-path';
import type { DashboardMetrics, MetricsPeriod } from './kpis';

const mad = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} MAD`;
const periodKey = (period: MetricsPeriod) =>
  period === 'today' ? 'today' : period === '7d' ? 'days7' : 'days30';

/**
 * Carte : fond blanc et bordure `border`, sans ombre ni dégradé. Appuyable si `onPress`. `highlighted` : bordure et fond
 * teintés orange doux (l'action principale d'une rangée).
 */
export function GlassCard({
  children,
  onPress,
  highlighted = false,
  label,
  className,
}: {
  children: ReactNode;
  onPress?: () => void;
  highlighted?: boolean;
  label?: string;
  className?: string;
}) {
  const content = (
    <View
      className={`overflow-hidden rounded-[22px] ${className ?? ''}`}
      style={{
        borderWidth: 1,
        borderColor: highlighted ? Palette.primary : Palette.border,
        backgroundColor: highlighted ? Palette.primarySoft : Palette.card,
      }}
    >
      {children}
    </View>
  );
  if (!onPress) return <View style={{ borderRadius: 22 }}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ borderRadius: 22 }, { opacity: pressed ? 0.85 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

function IconTile({ icon, size = 30 }: { icon: keyof typeof Ionicons.glyphMap; size?: number }) {
  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.33,
        backgroundColor: Palette.surfaceAlt,
      }}
    >
      <Ionicons name={icon} size={size * 0.55} color={Brand.graphite} />
    </View>
  );
}

// ---------------------------------------------------------------- trois compteurs

const goRentals = () => router.push('/locations');

/** Locations en cours, départs et retours du jour : trois cartes côte à côte (tous les rôles, aucun montant). */
export function StatTrio({ metrics }: { metrics: DashboardMetrics }) {
  const { t, language } = useLanguage();
  const items: {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: number;
  }[] = [
    {
      key: 'active',
      icon: 'car-outline',
      label: t('accueil.operations.activeShort'),
      value: metrics.activity.active,
    },
    {
      key: 'departures',
      icon: 'calendar-outline',
      label: t('accueil.operations.departuresToday'),
      value: metrics.activity.departuresToday,
    },
    {
      key: 'returns',
      icon: 'arrow-undo-outline',
      label: t('accueil.operations.returnsToday'),
      value: metrics.activity.returnsToday,
    },
  ];
  return (
    <View className="flex-row" style={{ gap: 12 }}>
      {items.map((item) => (
        <View key={item.key} className="flex-1">
          <GlassCard onPress={goRentals} label={`${item.label} : ${item.value}`}>
            <View style={{ padding: 11, gap: 5 }}>
              <IconTile icon={item.icon} />
              <ThemedText
                numberOfLines={2}
                style={{
                  color: Palette.textSecondary,
                  fontSize: 12.5,
                  lineHeight: 16,
                  fontFamily: fontFamilyFor(language, 'semibold'),
                }}
              >
                {item.label}
              </ThemedText>
              <View className="flex-1 justify-end">
                <ThemedText
                  style={{
                    color: Palette.textPrimary,
                    fontSize: 28,
                    lineHeight: 34,
                    fontFamily: fontFamilyFor(language, 'extrabold'),
                  }}
                >
                  {String(item.value)}
                </ThemedText>
              </View>
            </View>
          </GlassCard>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- chiffre d'affaires

/** Carte mauve profond : montant encaissé sur la période, variation, courbe des encaissements (propriétaire seulement). */
export function RevenueCard({ metrics }: { metrics: DashboardMetrics }) {
  const { t, language } = useLanguage();
  const [width, setWidth] = useState(0);
  const key = periodKey(metrics.period);
  const { revenue } = metrics;
  const change = revenue.changePct;
  const negative = change !== null && change < 0;

  const chartWidth = Math.round(width * 0.6);
  const chartHeight = 70;
  const values = metrics.revenueTrend.map((point) => point.total);
  const trend = hasTrend(values);
  const { line, area, end } = buildAreaPaths(values, chartWidth, chartHeight, 8);

  const badge =
    change === null
      ? {
          bg: Palette.textPrimary,
          fg: Themes.dark.textSecondary,
          text: t('accueil.period.noCompare'),
          icon: 'remove' as const,
        }
      : {
          bg: negative ? Themes.dark.errorSoft : Themes.dark.successSoft,
          fg: negative ? Themes.dark.error : Themes.dark.success,
          text: `${change > 0 ? '+' : ''}${change} % ${t(`accueil.period.vs.${key}`)}`,
          icon: (negative ? 'arrow-down' : 'arrow-up') as 'arrow-down' | 'arrow-up',
        };

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      className="overflow-hidden rounded-[22px]"
    >
      <View
        className="overflow-hidden rounded-[22px]"
        style={{ backgroundColor: Brand.graphite }}
      >
        {chartWidth > 0 && trend && line ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 6,
              end: 0,
              width: chartWidth,
              height: chartHeight,
            }}
          >
            <Svg width={chartWidth} height={chartHeight}>
              <Path d={area} fill={Brand.orangeLight} fillOpacity={0.14} />
              <Path
                d={line}
                fill="none"
                stroke={Brand.orangeLight}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {end ? (
                <Circle
                  cx={Math.min(end.x, chartWidth - 5)}
                  cy={end.y}
                  r={4.5}
                  fill={Brand.graphite}
                  stroke={Brand.orangeLight}
                  strokeWidth={2.5}
                />
              ) : null}
            </Svg>
          </View>
        ) : null}

        {chartWidth > 0 && !trend ? (
          <View
            pointerEvents="none"
            className="items-center justify-center gap-2"
            style={{ position: 'absolute', bottom: 14, end: 18, width: chartWidth * 0.62 }}
          >
            <Svg width="100%" height={34} viewBox="0 0 120 34" preserveAspectRatio="xMidYMid meet">
              {[6, 20, 34, 48, 62, 76, 90, 104].map((x, index) => (
                <Rect
                  key={x}
                  x={x}
                  y={30 - [6, 10, 7, 14, 9, 16, 11, 18][index]}
                  width={7}
                  height={[6, 10, 7, 14, 9, 16, 11, 18][index]}
                  rx={3}
                  fill={Brand.orangeLight}
                  fillOpacity={0.22}
                />
              ))}
              <Rect x={4} y={31} width={112} height={1.5} rx={1} fill={Brand.orangeLight} fillOpacity={0.4} />
            </Svg>
            <ThemedText
              numberOfLines={3}
              style={{
                color: Themes.dark.textSecondary,
                fontSize: 11.5,
                lineHeight: 15,
                textAlign: 'center',
                fontFamily: fontFamilyFor(language, 'medium'),
              }}
            >
              {t('accueil.period.noTrend')}
            </ThemedText>
          </View>
        ) : null}

        <View className="gap-1 p-4" style={{ minHeight: 108 }}>
          <View className="flex-row items-center gap-2">
            <View
              className="h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: Themes.dark.surfaceAlt }}
            >
              <Ionicons name="bar-chart" size={19} color={Brand.white} />
            </View>
            <ThemedText
              numberOfLines={1}
              style={{
                color: Themes.dark.textSecondary,
                fontSize: 13,
                lineHeight: 18,
                fontFamily: fontFamilyFor(language, 'semibold'),
              }}
            >
              {t(`accueil.period.revenue.${key}`)}
            </ThemedText>
          </View>
          <ThemedText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            accessibilityLabel={`${t(`accueil.period.revenue.${key}`)} : ${mad(revenue.current)}`}
            style={{
              color: Brand.white,
              fontSize: 30,
              lineHeight: 38,
              fontFamily: fontFamilyFor(language, 'extrabold'),
            }}
          >
            {mad(revenue.current)}
          </ThemedText>
          <View
            className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
            style={{ backgroundColor: badge.bg }}
          >
            <Ionicons name={badge.icon} size={13} color={badge.fg} />
            <ThemedText
              numberOfLines={1}
              style={{
                color: badge.fg,
                fontSize: 12,
                lineHeight: 16,
                fontFamily: fontFamilyFor(language, 'bold'),
              }}
            >
              {badge.text}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- accès rapide

type Tile = { key: string; href: string; icon: keyof typeof Ionicons.glyphMap; labelKey: string };

const MAIN_TILES: Tile[] = [
  {
    key: 'rental',
    href: '/locations/nouveau',
    icon: 'car-sport-outline',
    labelKey: 'locations.addRental',
  },
  {
    key: 'bookings',
    href: '/locations/calendrier',
    icon: 'calendar-number-outline',
    labelKey: 'accueil.quick.bookings',
  },
  { key: 'fleet', href: '/flotte', icon: 'car-outline', labelKey: 'accueil.quick.fleet' },
  { key: 'clients', href: '/clients', icon: 'people-outline', labelKey: 'clients.title' },
];

/** Écrans sans onglet, visibles après « Tout voir » : sans eux, Contrats, Maintenance… seraient presque introuvables. */
const MORE_TILES: (Tile & { managersOnly?: boolean; ownerOnly?: boolean })[] = [
  {
    key: 'contracts',
    href: '/contrats',
    icon: 'document-text-outline',
    labelKey: 'contract.listTitle',
  },
  {
    key: 'maintenance',
    href: '/maintenance',
    icon: 'construct-outline',
    labelKey: 'maintenance.title',
  },
  { key: 'chat', href: '/chat', icon: 'chatbubbles-outline', labelKey: 'chat.title' },
  {
    key: 'company',
    href: '/entreprise',
    icon: 'business-outline',
    labelKey: 'entreprise.title',
    managersOnly: true,
  },
  {
    key: 'journal',
    href: '/journal',
    icon: 'shield-checkmark-outline',
    labelKey: 'journal.title',
    ownerOnly: true,
  },
];

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function QuickTile({ tile, highlighted = false }: { tile: Tile; highlighted?: boolean }) {
  const { t, language } = useLanguage();
  return (
    <View className="flex-1">
      <GlassCard
        onPress={() => router.push(tile.href as never)}
        highlighted={highlighted}
        label={t(tile.labelKey)}
      >
        <View className="items-center justify-center gap-2 px-1 py-3" style={{ minHeight: 78 }}>
          <Ionicons
            name={tile.icon}
            size={26}
            color={highlighted ? Palette.primary : Brand.graphite}
          />
          <ThemedText
            numberOfLines={2}
            style={{
              color: Palette.textPrimary,
              fontSize: 11,
              lineHeight: 14,
              textAlign: 'center',
              fontFamily: fontFamilyFor(language, highlighted ? 'bold' : 'semibold'),
            }}
          >
            {t(tile.labelKey)}
          </ThemedText>
        </View>
      </GlassCard>
    </View>
  );
}

/** Accès rapide : quatre grands raccourcis, et « Tout voir » déplie les autres écrans selon le rôle. */
export function QuickAccessTiles({ role }: { role: string | null | undefined }) {
  const { t, language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const more = MORE_TILES.filter(
    (tile) =>
      (!tile.ownerOnly || role === 'owner') &&
      (!tile.managersOnly || role === 'owner' || role === 'manager')
  );
  const arrow = isRTL(language) ? 'arrow-back' : 'arrow-forward';
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <ThemedText type="subtitle" style={{ fontSize: 17, lineHeight: 22 }}>
          {t('onboarding.quick.title')}
        </ThemedText>
        {more.length > 0 ? (
          <Pressable
            onPress={() => setExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            hitSlop={8}
            className="min-h-11 flex-row items-center justify-center"
            style={{ gap: 4 }}
          >
            <ThemedText
              style={{
                color: Palette.textPrimary,
                fontSize: 14,
                lineHeight: 20,
                fontFamily: fontFamilyFor(language, 'bold'),
              }}
            >
              {expanded ? t('accueil.quick.seeLess') : t('accueil.quick.seeAll')}
            </ThemedText>
            <Ionicons
              name={expanded ? 'chevron-up' : arrow}
              size={16}
              color={Palette.primary}
            />
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row" style={{ gap: 10 }}>
        {MAIN_TILES.map((tile, index) => (
          <QuickTile key={tile.key} tile={tile} highlighted={index === 0} />
        ))}
      </View>
      {expanded
        ? chunk(more, 4).map((row) => (
            <View
              key={row.map((tile) => tile.key).join('-')}
              className="flex-row"
              style={{ gap: 10 }}
            >
              {row.map((tile) => (
                <QuickTile key={tile.key} tile={tile} />
              ))}
              {Array.from({ length: 4 - row.length }).map((_, index) => (
                <View key={`spacer-${index}`} className="flex-1" />
              ))}
            </View>
          ))
        : null}
    </View>
  );
}
