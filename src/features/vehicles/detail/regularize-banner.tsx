import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import type { RegularizationIssue } from '@/features/compliance/logic';
import { useLanguage } from '@/i18n/use-language';

const dayText = (iso: string, language: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Indicateur « À régulariser » : assurance ou visite technique EXPIRÉE. Alerte rouge critique, visible tant qu'aucun renouvellement n'est enregistré.
 * Elle informe, elle ne bloque rien : tout reste utilisable (y compris la location). Le bouton « Régulariser » ouvre le renouvellement.
 */
export function RegularizeBanner({ issues, onRegularize }: { issues: RegularizationIssue[]; onRegularize: (kind: RegularizationIssue['kind']) => void }) {
  const { t, language } = useLanguage();
  if (issues.length === 0) return null;
  return (
    <View accessibilityRole="alert" style={{ gap: 10, borderRadius: 20, borderWidth: 2, borderColor: Palette.error, backgroundColor: Palette.errorSoft, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="alert-circle" size={22} color={Palette.error} />
        <HText font="display" weight="bold" size={17} color={Palette.error}>
          {t('vehicleDetail.compliance.regularize.banner')}
        </HText>
      </View>
      {issues.map((issue) => (
        <HText key={issue.kind} weight="semibold" size={14}>
          {t(`vehicleDetail.compliance.regularize.${issue.daysOver === 1 ? 'bannerLineOne' : 'bannerLine'}_${issue.kind}`, { days: issue.daysOver, date: dayText(issue.due, language) })}
        </HText>
      ))}
      <HText size={12} color={Palette.textSecondary}>
        {t('vehicleDetail.compliance.regularize.bannerNote')}
      </HText>
      <Pressable onPress={() => onRegularize(issues[0].kind)} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.compliance.regularize.button')} style={{ minHeight: 48, alignSelf: 'flex-start', paddingHorizontal: 22, borderRadius: 24, borderWidth: 2, borderColor: Palette.error, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' }}>
        <HText weight="semibold" size={14} color={Palette.error}>
          {t('vehicleDetail.compliance.regularize.button')}
        </HText>
      </Pressable>
    </View>
  );
}
