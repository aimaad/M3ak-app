import type { VehiclePhoto } from '../../types';
import { addPhoto, angleSlots, canAddMore, filledAngles, isMainPhoto, makeMain, movePhoto, otherPhotos, photoRights, removePhoto, replacePhoto } from '../logic';

const photo = (path: string, angle?: VehiclePhoto['angle']): VehiclePhoto => ({ path, uploadedAt: '2026-11-01T10:00:00Z', ...(angle ? { angle } : {}) });
const paths = (list: VehiclePhoto[]) => list.map((item) => item.path);

describe('photo principale', () => {
  const photos = [photo('a', 'avant'), photo('b', 'arriere'), photo('c', 'interieur')];

  it('la première de la liste est la principale', () => {
    expect(isMainPhoto(photos, 'a')).toBe(true);
    expect(isMainPhoto(photos, 'b')).toBe(false);
  });

  it('« Mettre en principale » passe la photo en tête sans changer l’ordre des autres', () => {
    const next = makeMain(photos, 'c');
    expect(paths(next)).toEqual(['c', 'a', 'b']);
    expect(isMainPhoto(next, 'c')).toBe(true);
  });

  it('supprimer la principale : la suivante devient principale', () => {
    const next = removePhoto(photos, 'a');
    expect(paths(next)).toEqual(['b', 'c']);
    expect(isMainPhoto(next, 'b')).toBe(true);
  });

  it('supprimer une photo qui n’est pas principale ne change pas la principale', () => {
    expect(isMainPhoto(removePhoto(photos, 'b'), 'a')).toBe(true);
  });

  it('supprimer la dernière photo : liste vide, aucune principale', () => {
    expect(removePhoto([photo('a')], 'a')).toEqual([]);
  });

  it('remplacer la principale : la nouvelle reste en tête avec le même angle', () => {
    const next = replacePhoto(photos, 'a', photo('z'));
    expect(paths(next)).toEqual(['z', 'b', 'c']);
    expect(next[0].angle).toBe('avant');
  });
});

describe('ordre', () => {
  const photos = [photo('a'), photo('b'), photo('c')];
  it('déplacer vers l’arrière / l’avant', () => {
    expect(paths(movePhoto(photos, 'a', 1))).toEqual(['b', 'a', 'c']);
    expect(paths(movePhoto(photos, 'c', -1))).toEqual(['a', 'c', 'b']);
  });
  it('sans effet aux extrémités ou pour une photo inconnue', () => {
    expect(movePhoto(photos, 'a', -1)).toBe(photos);
    expect(movePhoto(photos, 'c', 1)).toBe(photos);
    expect(movePhoto(photos, 'x', 1)).toBe(photos);
  });
  it('déplacer la principale vers l’arrière change la principale', () => {
    expect(isMainPhoto(movePhoto(photos, 'a', 1), 'b')).toBe(true);
  });
});

describe('angles et limite', () => {
  it('6 angles dans l’ordre, photo ou null', () => {
    const slots = angleSlots([photo('a', 'avant'), photo('c', 'coffre'), photo('o', 'autre'), photo('old')]);
    expect(slots.map((slot) => slot.angle)).toEqual(['avant', 'arriere', 'cote_gauche', 'cote_droit', 'interieur', 'coffre']);
    expect(slots.filter((slot) => slot.photo).map((slot) => slot.photo?.path)).toEqual(['a', 'c']);
    expect(filledAngles([photo('a', 'avant'), photo('c', 'coffre'), photo('o', 'autre')])).toBe(2);
  });

  it('« autre » et les anciennes photos sans angle vont dans « Autre photo »', () => {
    expect(paths(otherPhotos([photo('a', 'avant'), photo('o', 'autre'), photo('old')]))).toEqual(['o', 'old']);
  });

  it('ajout : à la fin ; un angle conseillé déjà pris est refusé ; « autre » peut se répéter', () => {
    const base = [photo('a', 'avant')];
    expect(addPhoto(base, photo('b', 'arriere'))).toEqual({ ok: true, photos: [photo('a', 'avant'), photo('b', 'arriere')] });
    expect(addPhoto(base, photo('x', 'avant'))).toEqual({ ok: false, reason: 'angle_taken' });
    const withOther = addPhoto(base, photo('o1', 'autre'));
    expect(withOther.ok && addPhoto(withOther.photos, photo('o2', 'autre')).ok).toBe(true);
  });

  it('12 photos au maximum', () => {
    const full = Array.from({ length: 12 }, (_, index) => photo(`p${index}`, 'autre'));
    expect(canAddMore(full)).toBe(false);
    expect(addPhoto(full, photo('z', 'autre'))).toEqual({ ok: false, reason: 'full' });
    expect(canAddMore(full.slice(1))).toBe(true);
  });
});

describe('droits de l’employé', () => {
  it('employé : ajoute seulement', () => {
    expect(photoRights('employee')).toEqual({ canAdd: true, canManage: false });
  });
  it('propriétaire et responsable : tout', () => {
    expect(photoRights('owner')).toEqual({ canAdd: true, canManage: true });
    expect(photoRights('manager')).toEqual({ canAdd: true, canManage: true });
  });
  it('rôle inconnu (pas encore chargé) : rien', () => {
    expect(photoRights(undefined)).toEqual({ canAdd: false, canManage: false });
  });
});
