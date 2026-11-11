/**
 * Logique de l'écran Photos (pure, testée) : la liste `vehicles.photos` est ordonnée, la PREMIÈRE est la photo principale.
 * Les 6 angles conseillés ne servent qu'une fois chacun ; « autre » (ou une ancienne photo sans angle) peut se répéter. 12 photos au maximum.
 * Les règles de droits sont aussi appliquées par la base (migration 0067).
 */
import type { AgencyRole } from '@/features/agency/types';

import { MAX_VEHICLE_PHOTOS, NAMED_PHOTO_ANGLES, type PhotoAngle, type VehiclePhoto } from '../types';

export type NamedAngle = (typeof NAMED_PHOTO_ANGLES)[number];

export type PhotoRights = {
  /** Ajouter une photo : tous les rôles. */
  canAdd: boolean;
  /** Changer la principale, réordonner, remplacer, supprimer : propriétaire et responsable seulement. */
  canManage: boolean;
};

export const photoRights = (role: AgencyRole | undefined): PhotoRights => ({ canAdd: role !== undefined, canManage: role === 'owner' || role === 'manager' });

const angleOf = (photo: VehiclePhoto): PhotoAngle => photo.angle ?? 'autre';

/** La photo de chaque angle conseillé (null si pas encore prise), dans l'ordre des angles. */
export function angleSlots(photos: VehiclePhoto[]): { angle: NamedAngle; photo: VehiclePhoto | null }[] {
  return NAMED_PHOTO_ANGLES.map((angle) => ({ angle, photo: photos.find((photo) => photo.angle === angle) ?? null }));
}

/** Photos libres (« autre » ou sans angle), dans l'ordre de la liste. */
export const otherPhotos = (photos: VehiclePhoto[]): VehiclePhoto[] => photos.filter((photo) => angleOf(photo) === 'autre');

export const isMainPhoto = (photos: VehiclePhoto[], path: string) => photos[0]?.path === path;
export const canAddMore = (photos: VehiclePhoto[]) => photos.length < MAX_VEHICLE_PHOTOS;
/** Nombre de photos sur les 6 angles conseillés. */
export const filledAngles = (photos: VehiclePhoto[]) => angleSlots(photos).filter((slot) => slot.photo).length;

/** « Mettre en principale » : la photo passe en tête, les autres gardent leur ordre. */
export function makeMain(photos: VehiclePhoto[], path: string): VehiclePhoto[] {
  const target = photos.find((photo) => photo.path === path);
  return target ? [target, ...photos.filter((photo) => photo.path !== path)] : photos;
}

/** Supprimer : si c'était la principale, la suivante le devient (c'est la nouvelle tête de liste). */
export const removePhoto = (photos: VehiclePhoto[], path: string): VehiclePhoto[] => photos.filter((photo) => photo.path !== path);

/** Déplacer d'un cran vers l'avant (-1) ou l'arrière (+1) de la liste ; sans effet au bout. */
export function movePhoto(photos: VehiclePhoto[], path: string, delta: -1 | 1): VehiclePhoto[] {
  const from = photos.findIndex((photo) => photo.path === path);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= photos.length) return photos;
  const next = [...photos];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export type AddResult = { ok: true; photos: VehiclePhoto[] } | { ok: false; reason: 'full' | 'angle_taken' };

/** Ajouter à la fin ; refusé si 12 photos ou si l'angle conseillé est déjà pris (il faut alors remplacer). */
export function addPhoto(photos: VehiclePhoto[], photo: VehiclePhoto): AddResult {
  if (!canAddMore(photos)) return { ok: false, reason: 'full' };
  if (photo.angle && photo.angle !== 'autre' && photos.some((existing) => existing.angle === photo.angle)) return { ok: false, reason: 'angle_taken' };
  return { ok: true, photos: [...photos, photo] };
}

/** Remplacer : la nouvelle photo prend la place (et l'angle) de l'ancienne ; la principale reste principale. */
export function replacePhoto(photos: VehiclePhoto[], oldPath: string, photo: VehiclePhoto): VehiclePhoto[] {
  return photos.map((existing) => (existing.path === oldPath ? { ...photo, angle: existing.angle } : existing));
}

export const sameOrder = (a: VehiclePhoto[], b: VehiclePhoto[]) => a.length === b.length && a.every((photo, index) => photo.path === b[index].path);
