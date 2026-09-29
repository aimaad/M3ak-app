import { addToQueue, pendingForInspection, removeFromQueue } from '../queue-logic';
import type { PendingPhoto } from '../types';

function makePhoto(overrides: Partial<PendingPhoto>): PendingPhoto {
  return {
    id: 'p1',
    inspectionId: 'inspection-1',
    agencyId: 'agency-1',
    angle: 'avant',
    localUri: 'file:///tmp/avant.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('addToQueue', () => {
  it('ajoute une nouvelle photo', () => {
    const result = addToQueue([], makePhoto({}));
    expect(result).toHaveLength(1);
  });

  it('remplace la photo existante du même angle pour la même inspection (reprise)', () => {
    const existing = makePhoto({ id: 'old', localUri: 'file:///tmp/old.jpg' });
    const retake = makePhoto({ id: 'new', localUri: 'file:///tmp/new.jpg' });

    const result = addToQueue([existing], retake);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new');
  });

  it("n'écrase pas un angle différent ou une autre inspection", () => {
    const front = makePhoto({ id: 'front', angle: 'avant' });
    const back = makePhoto({ id: 'back', angle: 'arriere' });
    const otherInspection = makePhoto({ id: 'other', inspectionId: 'inspection-2' });

    const result = addToQueue(addToQueue([front], back), otherInspection);
    expect(result.map((p) => p.id).sort()).toEqual(['back', 'front', 'other']);
  });
});

describe('removeFromQueue', () => {
  it('retire uniquement la photo demandée', () => {
    const a = makePhoto({ id: 'a' });
    const b = makePhoto({ id: 'b', angle: 'arriere' });
    expect(removeFromQueue([a, b], 'a')).toEqual([b]);
  });
});

describe('pendingForInspection', () => {
  it("filtre sur l'inspection demandée", () => {
    const a = makePhoto({ id: 'a', inspectionId: 'i1' });
    const b = makePhoto({ id: 'b', inspectionId: 'i2' });
    expect(pendingForInspection([a, b], 'i1')).toEqual([a]);
  });
});
