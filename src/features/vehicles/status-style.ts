import type { VehicleStatus } from './types';
import { M3akPalette } from '@/constants/theme';

export type StatusStyle = { background: string; text: string; dot: string };

// Couleurs fonctionnelles officielles : disponible = vert, en location = bleu, maintenance = ambre, indisponible = gris.
const STATUS_STYLES: Record<VehicleStatus, StatusStyle> = {
  disponible: { background: M3akPalette.successLight, text: M3akPalette.successText, dot: M3akPalette.success },
  en_location: { background: M3akPalette.infoLight, text: M3akPalette.infoText, dot: M3akPalette.info },
  maintenance: { background: M3akPalette.warningLight, text: M3akPalette.warningText, dot: M3akPalette.warning },
  a_inspecter: { background: M3akPalette.mauveLight, text: M3akPalette.mauveDeep, dot: M3akPalette.mauve },
  en_preparation: { background: M3akPalette.mauveSoft, text: M3akPalette.mauve, dot: M3akPalette.lavender },
  indisponible: { background: M3akPalette.neutralLight, text: M3akPalette.neutralText, dot: M3akPalette.neutral },
};

export function statusStyle(status: VehicleStatus): StatusStyle {
  return STATUS_STYLES[status];
}
