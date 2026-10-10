import type { VehicleStatus } from './types';

export type StatusStyle = { background: string; text: string; dot: string };

const STATUS_STYLES: Record<VehicleStatus, StatusStyle> = {
  disponible: { background: '#DBEAFE', text: '#2563EB', dot: '#2563EB' },
  en_location: { background: '#E0F2FE', text: '#0369A1', dot: '#0369A1' },
  maintenance: { background: '#FEE2E2', text: '#DC2626', dot: '#DC2626' },
  a_inspecter: { background: '#211A2E', text: '#FFFFFF', dot: '#C4B5FD' },
  en_preparation: { background: '#FEF3C7', text: '#B45309', dot: '#B45309' },
  indisponible: { background: '#F1EEF7', text: '#81778F', dot: '#81778F' },
};

export function statusStyle(status: VehicleStatus): StatusStyle {
  return STATUS_STYLES[status];
}
