import type { VehicleStatus } from './types';
import { Brand, Palette } from '@/constants/theme';

export type StatusStyle = { background: string; text: string; dot: string };

// Couleurs fonctionnelles officielles : disponible = vert, en location = bleu, maintenance = ambre, indisponible = gris.
const STATUS_STYLES: Record<VehicleStatus, StatusStyle> = {
  disponible: { background: Palette.successSoft, text: Palette.success, dot: Palette.success },
  en_location: { background: Palette.infoSoft, text: Palette.info, dot: Palette.info },
  maintenance: { background: Palette.warningSoft, text: Palette.warning, dot: Palette.warning },
  a_inspecter: { background: Palette.primarySoft, text: Brand.graphite, dot: Palette.primary },
  en_preparation: { background: Palette.primarySoft, text: Palette.primary, dot: Brand.orangeLight },
  indisponible: { background: Palette.surfaceAlt, text: Palette.textSecondary, dot: Palette.textMuted },
};

export function statusStyle(status: VehicleStatus): StatusStyle {
  return STATUS_STYLES[status];
}
