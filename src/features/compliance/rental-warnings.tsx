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

  const warnings = rentalWarnings(complianceQuery.data, vehicleQuery.data, new Date(start), new Date(end), new Date());
  if (warnings.length === 0) return null;
  const day = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  return (
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
      <Pressable onPress={() => router.push({ pathname: '/flotte/[id]', params: { id: vehicleId } })} accessibilityRole="button" className="min-h-11 justify-center self-start">
        <ThemedText type="smallBold" themeColor="primary">
          {t('vehicleDetail.compliance.warnings.open')}
        </ThemedText>
      </Pressable>
    </View>
  );
}
