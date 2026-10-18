/**
 * Signature manuscrite = quelques tracés vectoriels (jamais une image ni du code) :
 * { v: 1, width, height, paths: ["M x y L x y …", …] }. Tout fichier relu depuis le stockage est
 * revalidé strictement avant d'être affiché ou inséré dans un PDF.
 */
export type HandwrittenSignature = {
  v: 1;
  width: number;
  height: number;
  paths: string[];
};

export const SIGNATURE_MAX_PATHS = 120;
export const SIGNATURE_MAX_PATH_LENGTH = 6000;
export const SIGNATURE_MAX_DIMENSION = 2000;
/** En dessous, c'est un simple point ou un trait accidentel : on demande de signer vraiment. */
export const SIGNATURE_MIN_POINTS = 12;

const PATH_PATTERN = /^M[0-9. -]+( L[0-9. -]+)*$/;

export type Point = { x: number; y: number };

const round = (n: number) => Math.round(n * 10) / 10;

/** Un tracé (liste de points) → « M x y L x y … ». Un point isolé devient un minuscule trait pour rester visible. */
export function strokeToPath(points: Point[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  const coords = points.length === 1 ? [first, { x: first.x + 0.1, y: first.y + 0.1 }] : points;
  return coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ');
}

export function pointCount(paths: string[]): number {
  return paths.reduce((sum, path) => sum + (path.match(/[ML]/g)?.length ?? 0), 0);
}

export function isSignatureDrawn(paths: string[]): boolean {
  return pointCount(paths) >= SIGNATURE_MIN_POINTS;
}

export function buildSignature(paths: string[], width: number, height: number): HandwrittenSignature {
  return { v: 1, width: Math.round(width), height: Math.round(height), paths: paths.filter(Boolean) };
}

/** Valide un contenu inconnu (fichier relu, réponse réseau). Renvoie null si quoi que ce soit est suspect. */
export function parseSignature(value: unknown): HandwrittenSignature | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const { v, width, height, paths } = candidate;
  if (v !== 1) return null;
  if (typeof width !== 'number' || typeof height !== 'number') return null;
  if (!(width > 0 && width <= SIGNATURE_MAX_DIMENSION && height > 0 && height <= SIGNATURE_MAX_DIMENSION)) return null;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > SIGNATURE_MAX_PATHS) return null;
  for (const path of paths) {
    if (typeof path !== 'string' || path.length > SIGNATURE_MAX_PATH_LENGTH || !PATH_PATTERN.test(path)) return null;
  }
  return { v: 1, width, height, paths: paths as string[] };
}

export function parseSignatureJson(text: string): HandwrittenSignature | null {
  try {
    return parseSignature(JSON.parse(text));
  } catch {
    return null;
  }
}

/** SVG autonome pour le PDF. Les chemins sont validés (chiffres, M, L uniquement) : rien d'exécutable ne peut y entrer. */
export function signatureToSvg(signature: HandwrittenSignature, heightPx = 60): string {
  const valid = parseSignature(signature);
  if (!valid) return '';
  const widthPx = Math.round((valid.width / valid.height) * heightPx);
  const d = valid.paths.join(' ');
  return `<svg class="sig" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${valid.width} ${valid.height}" width="${widthPx}" height="${heightPx}"><path d="${d}" fill="none" stroke="#111111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
