import type { FleetCounts, FleetGroup } from './fleet-model';

export const RING_SIZE = 112;
export const RING_STROKE = 9;
export const RING_RADIUS = 46;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
/** Espace entre deux segments (les extrémités arrondies en mangent la moitié de chaque côté). */
const GAP = 12;

export type RingSegment = { key: FleetGroup; /** Longueur du trait, sans l'espace. */ length: number; /** Début du trait sur le cercle. */ offset: number };

/**
 * Segments de l'anneau : un par groupe présent, proportionnel au nombre de véhicules, avec un petit espace entre deux segments.
 * Un seul groupe présent = cercle complet, sans espace. Flotte vide = aucun segment (le fond seul).
 */
export function ringSegments(counts: FleetCounts, circumference: number = RING_CIRCUMFERENCE, gap: number = GAP): RingSegment[] {
  const present = (['free', 'rented', 'immobilized'] as FleetGroup[]).filter((key) => counts[key] > 0);
  if (counts.total <= 0 || present.length === 0) return [];
  if (present.length === 1) return [{ key: present[0], length: circumference, offset: 0 }];
  let start = 0;
  return present.map((key) => {
    const share = (counts[key] / counts.total) * circumference;
    const segment = { key, length: Math.max(share - gap, 1), offset: start + gap / 2 };
    start += share;
    return segment;
  });
}
