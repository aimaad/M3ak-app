import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/theme';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

import { useVehicleCompliance } from './hooks';
import { rentalWarnings } from './logic';

/**
 * Avertissements d'assurance, de visite technique et de vignette avant de louer (ou de remettre) un véhicule. Jamais bloquant :
 * l'employé est informé, la location reste possible. N'affiche rien tant que les données ne sont pas là, ni quand tout est en règle.
 */
export function RentalComplianceWarnings({ vehicleId, start, end }: { vehicleId: string | undefined; start: string | null; end: string | null }) {
  const { t, language } = useLanguage();
  const vehicleQuery = useVehicle(vehicleId);
  const complianceQuery = useVehicleCompliance(vehicleId);
  if (!vehicleId || !start || !end || !vehicleQuery.data || !complianceQuery.data) return null;

  const all = rentalWarnings(complianceQuery.data, vehicleQuery.data, new Date(start), new Date(end), new Date());
  if (all.length === 0) return null;
  // Assurance ou visite technique EXPIRÉE : alerte rouge « À régulariser » ; le reste (expire pendant la location, vignette, non renseigné) : avertissement orange.
  const critical = all.filter((warning) => warning.code === 'expired' && (warning.kind === 'assurance' || warning.kind === 'visite_technique'));
  const warnings = all.filter((warning) => !critical.includes(warning));
  const day = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const open = (kind?: string) => router.push({ pathname: '/flotte/[id]', params: kind ? { id: vehicleId, regulariser: kind } : { id: vehicleId } });

  return (
    <View className="gap-3">
      {critical.length > 0 ? (
        <View accessibilityRole="alert" className="gap-2 rounded-2xl border-2 border-error bg-error-soft p-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="alert-circle" size={20} color={Palette.error} />
            <ThemedText type="smallBold" style={{ color: Palette.error }}>
              {t('vehicleDetail.compliance.regularize.title')}
            </ThemedText>
          </View>
          {critical.map((warning) => (
            <ThemedText key={`${warning.kind}:${warning.code}`} type="small">
              {`• ${t(`vehicleDetail.compliance.warnings.${warning.kind}.${warning.code}`, { date: day(warning.due) })}`}
            </ThemedText>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            {t('vehicleDetail.compliance.regularize.footer')}
          </ThemedText>
          <Pressable onPress={() => open(critical[0].kind)} accessibilityRole="button" className="min-h-11 justify-center self-start rounded-full border border-error px-4">
            <ThemedText type="smallBold" style={{ color: Palette.error }}>
              {t('vehicleDetail.compliance.regularize.button')}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      {warnings.length > 0 ? (
        <View accessibilityRole="alert" className="gap-2 rounded-2xl border border-warning bg-warning-soft p-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning-outline" size={18} color={Palette.warning} />
            <ThemedText type="smallBold">{t('vehicleDetail.compliance.warnings.title')}</ThemedText>
          </View>
          {warnings.map((warning) => (
            <ThemedText key={`${warning.kind}:${warning.code}`} type="small">
              {`• ${t(`vehicleDetail.compliance.warnings.${warning.kind}.${warning.code}`, { date: day(warning.due) })}`}
            </ThemedText>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            {t('vehicleDetail.compliance.warnings.footer')}
          </ThemedText>
          <Pressable onPress={() => open()} accessibilityRole="button" className="min-h-11 justify-center self-start">
            <ThemedText type="smallBold" themeColor="primary">
              {t('vehicleDetail.compliance.warnings.open')}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
