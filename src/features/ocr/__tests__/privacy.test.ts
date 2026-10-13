// Garde-fous statiques de confidentialité : l'OCR ne doit jamais appeler un service externe
// ni écrire le texte lu dans les journaux. Ils échouent si quelqu'un réintroduit un tel appel.
declare const __dirname: string;
declare function require(name: string): any;
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(__dirname, '../../..');
const OCR_FILES = [
  'features/ocr/local-ocr.ts',
  'features/ocr/text.ts',
  'features/ocr/labeled.ts',
  'features/ocr/licence-parser.ts',
  'features/ocr/registration-parser.ts',
  'features/customers/licence-ocr.ts',
  'features/vehicles/ocr.ts',
];
const FORBIDDEN_NETWORK = /fetch\s*\(|XMLHttpRequest|WebSocket|functions\.invoke|@\/lib\/supabase|axios/;
const FORBIDDEN_PROVIDERS = /gemini|generativelanguage|anthropic|openai|googleapis|vision\.google|(?<![a-z])textract|azure|cognitive|mistral/i;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry: { name: string; isDirectory: () => boolean }) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("confidentialité de l'OCR", () => {
  it.each(OCR_FILES)("%s : aucun appel réseau, aucun journal", (file) => {
    const code = fs.readFileSync(path.join(SRC, file), 'utf8');
    expect(code).not.toMatch(FORBIDDEN_NETWORK);
    expect(code).not.toMatch(/console\./);
  });

  it("aucune référence à un fournisseur d'OCR ou d'IA externe dans le code de l'app", () => {
    const offenders = walk(SRC).filter((file) => FORBIDDEN_PROVIDERS.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('aucune fonction serveur de lecture de documents ne subsiste', () => {
    const functionsDir = path.resolve(SRC, '../supabase/functions');
    const names = fs.readdirSync(functionsDir);
    expect(names.filter((name: string) => /scan|ocr|vision/i.test(name))).toEqual([]);
  });

  it("l'app n'invoque aucune fonction serveur de lecture de documents", () => {
    const offenders = walk(SRC).filter((file) => /scan-(customer|vehicle)-document/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
