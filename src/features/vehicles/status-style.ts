import type { VehicleStatus } from './types';

export type StatusStyle = { background: string; text: string; dot: string };

const STATUS_STYLES: Record<VehicleStatus, StatusStyle> = {
  disponible: { background: '#e5ebfd', text: '#1f5eff', dot: '#1f5eff' },
  en_location: { background: '#f3e8ff', text: '#7c3aed', dot: '#7c3aed' },
  maintenance: { background: '#fee2e2', text: '#dc2626', dot: '#dc2626' },
  a_inspecter: { background: '#101423', text: '#ffffff', dot: '#38e1ff' },
};

export function statusStyle(status: VehicleStatus): StatusStyle {
  return STATUS_STYLES[status];
}
