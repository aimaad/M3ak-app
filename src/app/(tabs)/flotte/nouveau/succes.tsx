import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Brand, Palette } from '@/constants/theme';
import { dayKey } from '@/features/dashboard/availability';
import { ArrowIcon, HText } from '@/features/dashboard/home-ui';
import { canRentNow, getCreatedVehicle } from '@/features/vehicles/add/created';
import { plateText } from '@/features/vehicles/fleet-card';
import { withAlpha } from '@/features/vehicles/fleet-style';
import { DEFAULT_VEHICLE_IMAGE, VehicleImage, vehicleName } from '@/features/vehicles/vehicle-image';
import { useLanguage } from '@/i18n/use-language';

/**
 * Véhicule ajouté : confirmation, carte du véhicule, ce qui reste à compléter, puis « Louer maintenant » (seulement si le véhicule est
 * disponible et son prix fixé), « Ajouter un autre » et « Voir dans Ma flotte ».
 */
export default function VehiculeAjouteScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    scale.value = reduceMotion ? 1 : withSpring(1, { damping: 11, stiffness: 190 });
  }, [scale, reduceMotion]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const created = getCreatedVehicle();
  if (!created) return <Redirect href="/flotte" />;
  const { vehicle, missing } = created;
  const name = vehicleName(vehicle);
  const free = vehicle.statut === 'disponible';
  const details = [vehicle.categorie ? t(`vehicle.category.${vehicle.categorie}`) : '', t(`vehicle.fuel.${vehicle.carburant}`), vehicle.transmission ? t(`vehicle.transmission.${vehicle.transmission}`) : ''].filter(Boolean).join(' · ');
  const labels = missing.map((key) => t(`vehicleAdd.success.missing.${key}`));
  const onlyPrice = missing.length === 1 && missing[0] === 'price';
  const rentable = canRentNow(vehicle);

  return (
    <View style={{ flex: 1, backgroundColor: Brand.graphite }}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={{ position: 'absolute', start: -40, end: -40, top: 40, height: 294 }} accessibilityElementsHidden importantForAccessibility="no">
        <Image source={DEFAULT_VEHICLE_IMAGE} style={{ width: '100%', height: '100%', opacity: 0.7 }} resizeMode="cover" />
        <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id="doneVeil" cx="50%" cy="50%" rx="60%" ry="55%">
              <Stop offset="0.3" stopColor={Brand.graphite} stopOpacity={0} />
              <Stop offset="0.95" stopColor={Brand.graphite} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#doneVeil)" />
        </Svg>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 160, paddingHorizontal: 20, paddingBottom: 220, gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Animated.View style={[{ width: 72, height: 72, borderRadius: 36, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 10, borderColor: withAlpha(Brand.orange, 0.18), shadowColor: Brand.orange, shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }, badgeStyle]}>
            <Ionicons name="checkmark" size={34} color={Brand.white} />
          </Animated.View>
          <HText font="display" weight="bold" size={26} color={Brand.white} style={{ textAlign: 'center', lineHeight: 30 }} accessibilityRole="header" accessibilityLiveRegion="polite">
            {t('vehicleAdd.success.title', { name })}
          </HText>
          <HText size={14} color={Brand.mutedOnDark}>
            {t(free ? 'vehicleAdd.success.subtitleFree' : 'vehicleAdd.success.subtitlePrep')}
          </HText>
        </View>

        <View style={{ marginTop: 8, flexDirection: 'row', gap: 12, backgroundColor: Brand.white, borderRadius: 22, padding: 10, shadowColor: Palette.shadow, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 18 } }}>
          <VehicleImage vehicle={vehicle} width={104} height={78} radius={16}>
            <View style={{ position: 'absolute', start: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: free ? withAlpha(Palette.success, 0.92) : withAlpha(Brand.warningOnDark, 0.95) }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: free ? Brand.white : Brand.graphite }} />
              <HText weight="bold" size={9} color={free ? Brand.white : Brand.graphite} style={{ lineHeight: 12 }}>
                {t(free ? 'vehicleAdd.success.statusFree' : 'vehicleAdd.success.statusPrep')}
              </HText>
            </View>
          </VehicleImage>
          <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 6 }}>
            <HText font="display" weight="bold" size={15} numberOfLines={1}>
              {name}
            </HText>
            <View style={{ alignSelf: 'flex-start', borderWidth: 1.5, borderColor: Brand.graphite, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1, direction: 'ltr' }}>
              <HText weight="bold" size={11} style={{ writingDirection: 'ltr' }}>
                {plateText(vehicle.immatriculation)}
              </HText>
            </View>
            <HText size={12} color={Palette.textSecondary} numberOfLines={2}>
              {details}
            </HText>
          </View>
        </View>

        {missing.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: Brand.surfaceOnDark }}>
            <HText size={12} color={Brand.textOnDark} style={{ flex: 1, lineHeight: 17 }}>
              {t(onlyPrice ? 'vehicleAdd.success.toCompleteOwnerPrice' : 'vehicleAdd.success.toComplete')}
              {labels.map((label, index) => (
                <HText key={label} size={12} weight="bold" color={Brand.white}>
                  {label}
                  {index < labels.length - 2 ? t('vehicleAdd.success.comma') : index === labels.length - 2 ? t('vehicleAdd.success.and') : ''}
                </HText>
              ))}
            </HText>
            <Pressable onPress={() => router.push(`/flotte/${vehicle.id}`)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <HText weight="semibold" size={12} color={Brand.orangeLight}>
                {t('vehicleAdd.success.complete')}
              </HText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ position: 'absolute', start: 20, end: 20, bottom: insets.bottom + 18, gap: 10 }}>
        {rentable ? (
          <Pressable
            onPress={() => router.replace({ pathname: '/locations/nouveau', params: { vehicleId: vehicle.id, date: dayKey(new Date()) } })}
            accessibilityRole="button"
            style={{ height: 54, borderRadius: 27, backgroundColor: Brand.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: Brand.orange, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } }}
          >
            <HText weight="semibold" size={15} color={Brand.white}>
              {t('vehicleAdd.success.rentNow')}
            </HText>
            <ArrowIcon color={Brand.white} size={16} />
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: t('vehicleAdd.success.addAnother'), onPress: () => router.replace('/flotte/nouveau') },
            { label: t('vehicleAdd.success.seeInFleet'), onPress: () => router.replace('/flotte') },
          ].map((button) => (
            <Pressable key={button.label} onPress={button.onPress} accessibilityRole="button" style={{ flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: Brand.surfaceOnDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
              <HText weight="semibold" size={13} color={Brand.white} numberOfLines={1}>
                {button.label}
              </HText>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
