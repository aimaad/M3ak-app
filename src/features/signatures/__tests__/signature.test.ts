import {
  buildSignature,
  isSignatureDrawn,
  parseSignature,
  parseSignatureJson,
  signatureToSvg,
  strokeToPath,
} from '../signature';

const stroke = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i * 3.14159, y: 20 + (i % 5) }));

describe('signature manuscrite', () => {
  it('transforme un tracé en chemin arrondi', () => {
    expect(strokeToPath([{ x: 1.234, y: 2 }, { x: 3, y: 4.56 }])).toBe('M 1.2 2 L 3 4.6');
    expect(strokeToPath([])).toBe('');
    expect(strokeToPath([{ x: 5, y: 5 }])).toMatch(/^M 5 5 L 5\.1 5\.1$/);
  });

  it('refuse une signature trop courte (point ou trait accidentel)', () => {
    expect(isSignatureDrawn([strokeToPath(stroke(3))])).toBe(false);
    expect(isSignatureDrawn([strokeToPath(stroke(20))])).toBe(true);
    expect(isSignatureDrawn([strokeToPath(stroke(6)), strokeToPath(stroke(8))])).toBe(true);
  });

  it('accepte une signature valide et la relit à l\'identique', () => {
    const sig = buildSignature([strokeToPath(stroke(20))], 300, 150);
    expect(parseSignatureJson(JSON.stringify(sig))).toEqual(sig);
  });

  it('refuse tout contenu suspect ou mal formé', () => {
    const ok = buildSignature([strokeToPath(stroke(20))], 300, 150);
    expect(parseSignature(null)).toBeNull();
    expect(parseSignature({ ...ok, v: 2 })).toBeNull();
    expect(parseSignature({ ...ok, width: 99999 })).toBeNull();
    expect(parseSignature({ ...ok, paths: [] })).toBeNull();
    expect(parseSignature({ ...ok, paths: ['M 1 1 L 2 2"/><script>alert(1)</script>'] })).toBeNull();
    expect(parseSignature({ ...ok, paths: ['M 1 1 <svg onload=x>'] })).toBeNull();
    expect(parseSignature({ ...ok, paths: [`M ${'1 '.repeat(5000)}`] })).toBeNull();
    expect(parseSignatureJson('pas du json')).toBeNull();
  });

  it('produit un SVG sans aucun élément actif', () => {
    const svg = signatureToSvg(buildSignature([strokeToPath(stroke(20))], 300, 150));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/script|onload|href|foreignObject/i);
    expect(signatureToSvg({ v: 1, width: 1, height: 1, paths: ['<script>'] })).toBe('');
  });
});
