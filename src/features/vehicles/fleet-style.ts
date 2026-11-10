import { Brand, Palette } from '@/constants/theme';

import type { FleetGroup, FleetSection } from './fleet-model';

/** Couleur d'un groupe sur fond sombre (en-tête : trait des tuiles, segments de l'anneau). */
export const GROUP_ON_DARK: Record<FleetGroup, string> = {
  free: Brand.successOnDark,
  rented: Brand.textOnDark,
  immobilized: Brand.warningOnDark,
};

/** Couleur d'un jour de la frise et de la légende, sur fond clair : libre vert, loué graphite, immobilisé ambre. */
export const WEEK_COLOR: Record<FleetGroup, string> = {
  free: Palette.success,
  rented: Brand.graphite,
  immobilized: Brand.parcInspect,
};

/** Point d'en-tête de section (fond clair) ; « Indisponibles » est gris. */
export const SECTION_DOT: Record<FleetSection, string> = {
  inspect: Brand.parcInspect,
  maintenance: Brand.parcInspect,
  unavailable: Palette.textMuted,
  rented: Brand.graphite,
  free: Palette.success,
};

/** Un jeton de couleur avec une transparence (« #202527 » + 0,88 → rgba) : jamais de couleur en dur. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
