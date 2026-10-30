import ar from '../locales/ar.json';
import fr from '../locales/fr.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const placeholders = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).map((p) => p.replace(/\s/g, '')).sort();

describe('traductions fr / ar', () => {
  const frFlat = flatten(fr as Tree);
  const arFlat = flatten(ar as Tree);

  // Périmètre des modules clients / conducteurs / départ / invitations : aucune chaîne en dur ni clé manquante.
  const scoped = (key: string) =>
    /^(customer\.(create|ocr|documentForm|documentsManager|notes|documentTypes|driver)|entreprise\.(ocr|departurePolicy)|locations\.(drivers|departureCheck)|equipe\.invite)/.test(key);

  it("chaque clé française du périmètre existe en arabe, et inversement", () => {
    const missingInAr = Object.keys(frFlat).filter((k) => scoped(k) && !(k in arFlat));
    const missingInFr = Object.keys(arFlat).filter((k) => scoped(k) && !(k in frFlat));
    expect(missingInAr).toEqual([]);
    expect(missingInFr).toEqual([]);
  });

  it('les variables {{…}} sont identiques dans les deux langues', () => {
    const mismatched = Object.keys(frFlat).filter(
      (k) => scoped(k) && k in arFlat && placeholders(frFlat[k]).join() !== placeholders(arFlat[k]).join()
    );
    expect(mismatched).toEqual([]);
  });

  it('aucune traduction du périmètre n’est vide', () => {
    const empty = [...Object.entries(frFlat), ...Object.entries(arFlat)].filter(([k, v]) => scoped(k) && v.trim() === '');
    expect(empty).toEqual([]);
  });
});
