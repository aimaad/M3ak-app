import type { VehicleStatus } from './types';
import { M3akPalette } from '@/constants/theme';

export type StatusStyle = { background: string; text: string; dot: string };

const STATUS_STYLES: Record<VehicleStatus, StatusStyle> = {
  disponible: { background: '#DBEAFE', text: '#2563EB', dot: '#2563EB' },
  en_location: { background: '#E0F2FE', text: '#0369A1', dot: '#0369A1' },
  maintenance: { background: '#FEE2E2', text: '#DC2626', dot: '#DC2626' },
  a_inspecter: { background: M3akPalette.ink, text: '#FFFFFF', dot: '#6EE7B7' },
  en_preparation: { background: '#FEF3C7', text: '#B45309', dot: '#B45309' },
  indisponible: { background: '#F1EEF7', text: M3akPalette.muted, dot: M3akPalette.muted },
};

export function statusStyle(status: VehicleStatus): StatusStyle {
  return STATUS_STYLES[status];
}
