import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import type { ArchiveBlock } from '../archive-guard';
import { formatDayLabel } from '../fleet-card';

/** Phrase qui explique le blocage (client, date, « et N autres réservations »). */
export function archiveReasonText(block: ArchiveBlock, t: (key: string, params?: Record<string, unknown>) => string, language: string, now: Date): string {
  const day = block.day ? formatDayLabel(block.day, language, 'short', now) : '';
  const named = block.name !== null;
  const main =
    block.kind === 'late'
      ? t(named ? 'vehicleDetail.archive.late' : 'vehicleDetail.archive.lateNoName', { name: block.name })
      : block.kind === 'rented'
        ? t(named ? 'vehicleDetail.archive.rented' : 'vehicleDetail.archive.rentedNoName', { name: block.name, day })
        : block.kind === 'reserved'
          ? t(named ? 'vehicleDetail.archive.reserved' : 'vehicleDetail.archive.reservedNoName', { name: block.name, day })
          : t('vehicleDetail.archive.status');
  const others = block.others > 0 ? t(block.others === 1 ? 'vehicleDetail.archive.others' : 'vehicleDetail.archive.othersMany', { count: block.others }) : null;
  return [main, others].filter(Boolean).join(' ');
}

/**
 * Bas de la fiche, propriétaire et responsable seulement : bouton « Archiver » si possible, sinon bouton verrouillé (désactivé, lu comme
 * tel) et la raison précise en dessous. L'employé ne voit rien.
 */
export function ArchiveSection({ block, now, onArchive }: { block: ArchiveBlock | null; now: Date; onArchive: () => void }) {
  const { t, language } = useLanguage();
  if (block) {
    return (
      <View style={{ gap: 10 }}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={t('vehicleDetail.archive.lockedButton')}
          style={{ height: 48, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: Palette.textMuted, backgroundColor: Brand.gaugeTrack, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name="lock-closed-outline" size={16} color={Palette.textSecondary} />
          <HText weight="semibold" size={13} color={Palette.textSecondary}>
            {t('vehicleDetail.archive.lockedButton')}
          </HText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 8 }}>
          <Ionicons name="information-circle-outline" size={15} color={Palette.textSecondary} style={{ marginTop: 1 }} />
          <HText size={12} color={Palette.textSecondary} style={{ flex: 1, lineHeight: 18 }}>
            {archiveReasonText(block, t, language, now)}
          </HText>
        </View>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onArchive}
      accessibilityRole="button"
      accessibilityLabel={t('vehicleDetail.archive.button')}
      style={{ height: 48, borderRadius: 24, borderWidth: 1, borderColor: Palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    >
      <Ionicons name="archive-outline" size={16} color={Palette.textSecondary} />
      <HText weight="semibold" size={13} color={Palette.textSecondary}>
        {t('vehicleDetail.archive.button')}
      </HText>
    </Pressable>
  );
}
