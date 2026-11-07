import type { VehicleStatus } from '@/features/vehicles/types';
import { Brand, Palette } from '@/constants/theme';

/** Les quatre statuts principaux, chacun dans la couleur de son statut (vert, bleu, ambre, orange) ; tout le reste est regroupé dans « Autres ». */
const MAIN: { status: VehicleStatus; color: string }[] = [
  { status: 'disponible', color: Palette.success },
  { status: 'en_location', color: Palette.info },
  { status: 'maintenance', color: Palette.warning },
  { status: 'a_inspecter', color: Brand.orange },
];
export const OTHERS_COLOR = Palette.textMuted;

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
