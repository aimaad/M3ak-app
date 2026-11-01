import { buildAreaPaths } from '../chart-path';

describe('buildAreaPaths', () => {
  it('ne trace rien sans données ou sans taille', () => {
    expect(buildAreaPaths([], 100, 50)).toEqual({ line: '', area: '', end: null });
    expect(buildAreaPaths([1, 2], 0, 50).end).toBeNull();
  });

  it('place le plus petit montant en bas et le plus grand en haut, de gauche à droite', () => {
    const { end, line } = buildAreaPaths([0, 50, 100], 200, 100, 10);
    expect(line.startsWith('M 0 90')).toBe(true);
    expect(end).toEqual({ x: 200, y: 10 });
  });

  it('série constante ou à zéro : ligne plate au bas, aucun NaN', () => {
    for (const values of [[0, 0, 0, 0], [5], [3, 3]]) {
      const { line, area, end } = buildAreaPaths(values, 120, 60, 6);
      expect(line).not.toMatch(/NaN|Infinity/);
      expect(area).not.toMatch(/NaN|Infinity/);
      expect(end?.y).toBe(54);
    }
  });

  it('un seul point : calé à droite', () => {
    expect(buildAreaPaths([7], 100, 40).end?.x).toBe(100);
  });

  it('gère les valeurs négatives (remboursements)', () => {
    const { end, line } = buildAreaPaths([-100, 0, 100], 100, 100, 0);
    expect(line).not.toMatch(/NaN/);
    expect(end).toEqual({ x: 100, y: 0 });
  });

  it("la surface est refermée sur le bas du cadre", () => {
    const { area } = buildAreaPaths([1, 3, 2], 100, 80);
    expect(area.endsWith('L 100 80 L 0 80 Z')).toBe(true);
  });

  it('les poignées de la courbe restent dans le cadre', () => {
    const { line } = buildAreaPaths([0, 1000, 0, 1000, 0], 200, 100, 6);
    const ys = [...line.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => Number(m[2]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(6);
    expect(Math.max(...ys)).toBeLessThanOrEqual(94);
  });
});
