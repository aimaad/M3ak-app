import type { VehicleStatus } from './types';
import { BibipPalette } from '@/constants/theme';

export type StatusStyle = { background: string; text: string; dot: string };

// Couleurs fonctionnelles officielles : disponible = vert, en location = bleu, maintenance = ambre, indisponible = gris.
const STATUS_STYLES: Record<VehicleStatus, StatusStyle> = {
  disponible: { background: BibipPalette.successLight, text: BibipPalette.successText, dot: BibipPalette.success },
  en_location: { background: BibipPalette.infoLight, text: BibipPalette.infoText, dot: BibipPalette.info },
  maintenance: { background: BibipPalette.warningLight, text: BibipPalette.warningText, dot: BibipPalette.warning },
  a_inspecter: { background: BibipPalette.primaryLight, text: BibipPalette.primaryDeep, dot: BibipPalette.primary },
  en_preparation: { background: BibipPalette.primarySoft, text: BibipPalette.primary, dot: BibipPalette.mint },
  indisponible: { background: BibipPalette.neutralLight, text: BibipPalette.neutralText, dot: BibipPalette.neutral },
};

export function statusStyle(status: VehicleStatus): StatusStyle {
  return STATUS_STYLES[status];
}
