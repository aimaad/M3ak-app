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

/**
 * Une tendance n'a de sens qu'avec au moins deux jours (ou mois) d'encaissements non nuls : sinon la courbe serait une
 * ligne plate ou un pic isolé, et l'écran affiche un état vide explicite à la place.
 */
export function hasTrend(values: number[]): boolean {
  return values.filter((value) => value !== 0).length >= 2;
}

export type DonutSegment = {
  key: string;
  /** Longueur de l'arc et du vide qui suit (pour `strokeDasharray`), et début de l'arc (pour `strokeDashoffset`, négatif). */
  dash: number;
  rest: number;
  offset: number;
};

/**
 * Arcs d'un anneau de rayon `radius` : un par entrée à valeur positive, séparés par un petit vide (`gap`, en px d'arc).
 * Aucune entrée positive : liste vide (l'écran dessine alors un anneau neutre). Un seul arc occupe tout l'anneau, sans vide.
 */
export function donutSegments(entries: { key: string; value: number }[], radius: number, gap = 3): DonutSegment[] {
  const positive = entries.filter((entry) => entry.value > 0);
  const total = positive.reduce((sum, entry) => sum + entry.value, 0);
  if (total === 0) return [];
  const circumference = 2 * Math.PI * radius;
  const spacing = positive.length > 1 ? gap : 0;
  let cursor = 0;
  return positive.map((entry) => {
    const share = (entry.value / total) * circumference;
    const dash = Math.max(share - spacing, 0.5);
    const segment = { key: entry.key, dash, rest: circumference - dash, offset: -cursor };
    cursor += share;
    return segment;
  });
}
