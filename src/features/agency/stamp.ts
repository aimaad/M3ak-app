/**
 * Cachet de l'agence généré par M3ak : un vrai tampon dessiné en vectoriel (anneaux, texte en arc, lignes centrées,
 * léger angle, encre bleue/rouge/noire), pas une simple photo. Il reste net à l'impression et sur le PDF.
 *
 * La configuration est enregistrée dans `agencies.stamp_config` ; ses textes sont courts et nettoyés ici, et tout texte
 * est échappé avant d'entrer dans le SVG : aucun contenu saisi ne peut ajouter de balise.
 */
export type StampShape = 'round' | 'rect' | 'oval';
export type StampColor = 'blue' | 'red' | 'black';

export const STAMP_SHAPES: StampShape[] = ['round', 'rect', 'oval'];
export const STAMP_COLORS: StampColor[] = ['blue', 'red', 'black'];
export const STAMP_INK: Record<StampColor, string> = { blue: '#1D3FA8', red: '#B91C1C', black: '#1F2937' };

export const STAMP_LIMITS = { title: 36, line: 34, bottom: 28, lines: 3 } as const;

export type StampConfig = {
  v: 1;
  shape: StampShape;
  color: StampColor;
  /** Nom de l'agence : lu en arc en haut (cachet rond), sinon en gros en haut. */
  title: string;
  /** Jusqu'à 3 lignes au centre : raison sociale, ICE / RC / patente, téléphone… */
  lines: string[];
  /** Ville : en arc en bas (cachet rond), sinon en bas. */
  bottom: string;
};

const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Valide une configuration inconnue (colonne relue, saisie). Renvoie null si elle est inutilisable. */
export function parseStampConfig(raw: unknown): StampConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (c.v !== 1 || !STAMP_SHAPES.includes(c.shape as StampShape) || !STAMP_COLORS.includes(c.color as StampColor)) return null;
  const title = clean(c.title, STAMP_LIMITS.title);
  if (!title) return null;
  const lines = (Array.isArray(c.lines) ? c.lines : []).map((line) => clean(line, STAMP_LIMITS.line)).filter(Boolean).slice(0, STAMP_LIMITS.lines);
  return { v: 1, shape: c.shape as StampShape, color: c.color as StampColor, title, lines, bottom: clean(c.bottom, STAMP_LIMITS.bottom) };
}

/** Cachet proposé au départ, à partir des informations de l'entreprise. */
export function defaultStampConfig(agency: { nom: string; raisonSociale?: string | null; ville?: string | null; telephone?: string | null }): StampConfig {
  const lines = [
    agency.raisonSociale && agency.raisonSociale.trim() && agency.raisonSociale.trim() !== agency.nom.trim() ? agency.raisonSociale : '',
    agency.telephone ? `Tél : ${agency.telephone}` : '',
  ].filter(Boolean);
  return {
    v: 1,
    shape: 'round',
    color: 'blue',
    title: clean(agency.nom, STAMP_LIMITS.title).toUpperCase() || 'AGENCE',
    lines: lines.map((line) => clean(line, STAMP_LIMITS.line)),
    bottom: clean(agency.ville ?? '', STAMP_LIMITS.bottom).toUpperCase(),
  };
}

export function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Taille de police réduite pour qu'un texte long tienne sur `width` (≈ 0,6 em par lettre en gras). */
function fit(text: string, base: number, width: number): number {
  return Math.max(6, Math.min(base, Math.floor((width / Math.max(1, text.length)) / 0.62)));
}

function centerLines(lines: string[], cx: number, middle: number, width: number, base: number, ink: string): string {
  const step = base + 4;
  const top = middle - ((lines.length - 1) * step) / 2;
  return lines
    .map((line, index) => `<text x="${cx}" y="${top + index * step + base * 0.35}" text-anchor="middle" font-size="${fit(line, base, width)}" font-weight="bold" fill="${ink}">${escapeXml(line)}</text>`)
    .join('');
}

/**
 * SVG du cachet (chaîne prête pour le PDF ou react-native-svg). `size` = largeur en px ; le cachet est légèrement penché,
 * comme un tampon posé à la main.
 */
export function stampSvg(config: StampConfig, size = 120): string {
  const ink = STAMP_INK[config.color];
  const font = 'font-family="Helvetica, Arial, sans-serif"';
  // Marge autour du dessin : le léger angle du tampon ne doit jamais couper un coin.
  const head = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 ${w + 16} ${h + 16}" width="${size}" height="${Math.round((size * (h + 16)) / (w + 16))}" ${font}>`;

  if (config.shape === 'round') {
    const lines = config.lines.slice(0, 3);
    return `${head(200, 200)}<g transform="rotate(-7 100 100)" opacity="0.92">
      <circle cx="100" cy="100" r="95" fill="none" stroke="${ink}" stroke-width="4"/>
      <circle cx="100" cy="100" r="88" fill="none" stroke="${ink}" stroke-width="1.2"/>
      <circle cx="100" cy="100" r="60" fill="none" stroke="${ink}" stroke-width="1.2"/>
      <defs><path id="stampTop" d="M 28 100 A 72 72 0 0 1 172 100"/><path id="stampBottom" d="M 22 100 A 78 78 0 0 0 178 100"/></defs>
      <text font-size="${fit(config.title, 16, 190)}" font-weight="bold" fill="${ink}" letter-spacing="1"><textPath href="#stampTop" startOffset="50%" text-anchor="middle">${escapeXml(config.title)}</textPath></text>
      ${config.bottom ? `<text font-size="${fit(config.bottom, 14, 150)}" font-weight="bold" fill="${ink}" letter-spacing="1.5"><textPath href="#stampBottom" startOffset="50%" text-anchor="middle">${escapeXml(config.bottom)}</textPath></text>` : ''}
      <text x="22" y="106" font-size="14" fill="${ink}" text-anchor="middle">★</text><text x="178" y="106" font-size="14" fill="${ink}" text-anchor="middle">★</text>
      ${centerLines(lines, 100, 100, 104, 12, ink)}
    </g></svg>`;
  }

  // Cachet rectangulaire ou ovale : titre, filet, lignes centrées, filet, ville — la hauteur suit le nombre de lignes.
  const oval = config.shape === 'oval';
  const lines = config.lines.slice(0, 3);
  const w = 240;
  const innerW = oval ? 150 : 200;
  const titleBase = 36;
  const ruleTop = titleBase + 8;
  const firstLine = ruleTop + 18;
  const lastLine = firstLine + Math.max(0, lines.length - 1) * 17;
  const ruleBottom = config.bottom ? lastLine + 9 : null;
  const bottomBase = ruleBottom !== null ? ruleBottom + 17 : lastLine;
  const frameH = (config.bottom ? bottomBase : lines.length > 0 ? lastLine : ruleTop) + 14;
  const ovalPad = oval ? Math.round(frameH * 0.14) : 0; // l'ovale a besoin de plus de place en haut et en bas
  const h = frameH + 12 + ovalPad * 2;
  const dy = 6 + ovalPad;
  const left = oval ? 62 : 28;
  const right = w - left;
  const frame = oval
    ? `<ellipse cx="120" cy="${h / 2}" rx="114" ry="${h / 2 - 5}" fill="none" stroke="${ink}" stroke-width="4"/><ellipse cx="120" cy="${h / 2}" rx="106" ry="${h / 2 - 12}" fill="none" stroke="${ink}" stroke-width="1.2"/>`
    : `<rect x="5" y="5" width="230" height="${h - 10}" rx="10" fill="none" stroke="${ink}" stroke-width="4"/><rect x="12" y="12" width="216" height="${h - 24}" rx="6" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
  const lineText = lines
    .map((line, index) => `<text x="120" y="${firstLine + index * 17 + dy}" text-anchor="middle" font-size="${fit(line, 13, innerW - 10)}" font-weight="bold" fill="${ink}">${escapeXml(line)}</text>`)
    .join('');
  return `${head(w, h)}<g transform="rotate(-4 ${w / 2} ${h / 2})" opacity="0.92">
    ${frame}
    <text x="120" y="${titleBase + dy}" text-anchor="middle" font-size="${fit(config.title, 20, innerW)}" font-weight="bold" fill="${ink}" letter-spacing="0.8">${escapeXml(config.title)}</text>
    <line x1="${left}" y1="${ruleTop + dy}" x2="${right}" y2="${ruleTop + dy}" stroke="${ink}" stroke-width="1.2"/>
    ${lineText}
    ${config.bottom && ruleBottom !== null ? `<line x1="${left}" y1="${ruleBottom + dy}" x2="${right}" y2="${ruleBottom + dy}" stroke="${ink}" stroke-width="1.2"/><text x="120" y="${bottomBase + dy}" text-anchor="middle" font-size="${fit(config.bottom, 14, innerW)}" font-weight="bold" fill="${ink}" letter-spacing="1.2">${escapeXml(config.bottom)}</text>` : ''}
  </g></svg>`;
}
