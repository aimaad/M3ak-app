export type ChartPoint = { x: number; y: number };

export type AreaChartPaths = {
  /** Courbe lissée (tracé de la ligne). */
  line: string;
  /** Même courbe refermée sur le bas : surface sous la courbe, pour le dégradé. */
  area: string;
  /** Dernier point (marqué par un rond). */
  end: ChartPoint | null;
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Transforme une série de montants en courbe lissée (Catmull-Rom convertie en Bézier) dans un cadre `width × height`,
 * avec `padding` de marge. Série vide : rien à tracer. Série constante (ou un seul point) : ligne plate près du bas, jamais
 * de division par zéro. Les valeurs négatives (remboursements) sont gérées : l'échelle va du minimum au maximum.
 */
export function buildAreaPaths(values: number[], width: number, height: number, padding = 6): AreaChartPaths {
  if (values.length === 0 || width <= 0 || height <= 0) return { line: '', area: '', end: null };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const usable = Math.max(height - padding * 2, 1);
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points: ChartPoint[] = values.map((value, index) => ({
    x: values.length > 1 ? index * step : width,
    y: span === 0 ? height - padding : padding + (1 - (value - min) / span) * usable,
  }));

  let line = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    // On borne les poignées pour que la courbe ne sorte pas du cadre (pas de creux sous le bas ni de bosse au-dessus).
    const clampY = (y: number) => Math.min(Math.max(y, padding), height - padding);
    line += ` C ${round(c1.x)} ${round(clampY(c1.y))}, ${round(c2.x)} ${round(clampY(c2.y))}, ${round(p2.x)} ${round(p2.y)}`;
  }

  const last = points[points.length - 1];
  const first = points[0];
  const area = `${line} L ${round(last.x)} ${height} L ${round(first.x)} ${height} Z`;
  return { line, area, end: { x: round(last.x), y: round(last.y) } };
}
