import type { VehicleStatus } from '@/features/vehicles/types';

/** Les quatre statuts principaux, chacun dans une nuance de violet de la palette ; tout le reste est regroupé dans « Autres ». */
const MAIN: { status: VehicleStatus; color: string }[] = [
  { status: 'disponible', color: '#087F70' },
  { status: 'en_location', color: '#7DDCC8' },
  { status: 'maintenance', color: '#0A3A34' },
  { status: 'a_inspecter', color: '#BFE6DE' },
];
export const OTHERS_COLOR = '#A9B3B0';

export type FleetShare = { key: string; value: number; color: string };

/** Répartition réelle du parc : les quatre statuts principaux, puis « autres » (préparation, indisponible) seulement s'il y en a. */
export function fleetShares(counts: Record<VehicleStatus, number>): FleetShare[] {
  const main = MAIN.map(({ status, color }) => ({ key: status, value: counts[status], color }));
  const others = counts.en_preparation + counts.indisponible;
  return others > 0 ? [...main, { key: 'others', value: others, color: OTHERS_COLOR }] : main;
}

/** Pourcentage arrondi d'une part ; 0 si le parc est vide. */
export function sharePercent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
