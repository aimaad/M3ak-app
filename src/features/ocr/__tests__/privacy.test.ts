// Garde-fous statiques de confidentialité : la lecture des documents ne passe que par la fonction serveur
// `scan-document` (clé de l'entreprise + accord du propriétaire), sans autre fournisseur ni journal du contenu.
declare const __dirname: string;
declare function require(name: string): any;
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(__dirname, '../../..');
const OCR_FILES = ['features/ocr/availability.ts'];
/** Fichiers qui NOMMENT l'option Gemini (commentaires, textes) : aucun n'appelle un service autre que scan-document. */
const CLOUD_AWARE_FILES = [
  'features/ocr/cloud-ocr.ts',
  'features/ocr/settings-api.ts',
  'features/ocr/scan-cache.ts',
  'features/ocr/cached-scan.ts',
  'features/customers/licence-ocr.ts',
  'features/vehicles/ocr.ts',
  'app/entreprise/index.tsx',
  'features/dashboard/insights-api.ts',
  'features/dashboard/insights.ts',
  'features/dashboard/insights-cache.ts',
  'features/dashboard/hooks.ts',
  'features/dashboard/ai-insights-section.tsx',
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
  it("aucune bibliothèque d'OCR n'est embarquée dans l'app (la lecture passe uniquement par le serveur)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SRC, '../package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((name: string) => /ocr|text-extract|mlkit|tesseract|text-recognition/i.test(name))).toEqual([]);
  });

  it.each(OCR_FILES)("%s : aucun appel réseau, aucun journal", (file) => {
    const code = fs.readFileSync(path.join(SRC, file), 'utf8');
    expect(code).not.toMatch(FORBIDDEN_NETWORK);
    expect(code).not.toMatch(/console\./);
  });

  it("aucune référence à un fournisseur d'OCR ou d'IA dans le code de l'app, sauf le module d'analyse optionnelle", () => {
    const offenders = walk(SRC)
      .filter((file: string) => !CLOUD_AWARE_FILES.some((allowed) => file.replace(/\\/g, '/').endsWith(allowed)))
      .filter((file: string) => FORBIDDEN_PROVIDERS.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it("seul le module d'analyse optionnelle appelle le serveur, et seulement la fonction scan-document", () => {
    const callers = walk(SRC).filter((file: string) => /functions\.invoke\(\s*'scan-/.test(fs.readFileSync(file, 'utf8')));
    expect(callers.map((file: string) => file.replace(/\\/g, '/').split('/src/')[1])).toEqual(['features/ocr/cloud-ocr.ts']);
    const code = fs.readFileSync(path.join(SRC, 'features/ocr/cloud-ocr.ts'), 'utf8');
    expect(code).toContain("functions.invoke('scan-document'");
    expect(code).not.toMatch(/fetch\s*\(|console\./);
  });

  it("l'app ne lit ni n'écrit jamais la table des clés : tout passe par des fonctions serveur contrôlées", () => {
    const offenders = walk(SRC).filter((file: string) => /agency_ocr_settings|gemini_api_key|platform_admins/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it("les fonctions serveur n'utilisent que la clé de l'entreprise : pas de clé globale, pas d'autre fournisseur", () => {
    const functionsDir = path.resolve(SRC, '../supabase/functions');
    expect(fs.readdirSync(functionsDir).sort()).toEqual(['_shared', 'analyze-inspection', 'chat-m3ak', 'generate-insights', 'scan-document', 'send-invite', 'send-push']);
    const read = (file: string) => fs.readFileSync(path.join(functionsDir, file), 'utf8');

    const scan = read('scan-document/index.ts');
    expect(scan).toContain("from('agency_ocr_settings')");
    expect(scan).toContain('settings.cloud_enabled');

    const inspection = read('analyze-inspection/index.ts');
    expect(inspection).toContain("from('agency_ocr_settings')");
    expect(inspection).toContain('settings.cloud_enabled');
    expect(inspection).toContain('RLS'); // l'inspection est d'abord lue avec le droit de l'appelant
    expect(inspection).toContain("supabase.from('inspections')");

    const chat = read('chat-m3ak/index.ts');
    expect(chat).toContain("from('agency_ocr_settings')");
    expect(chat).toContain('settings.chat_enabled');
    expect(chat).toContain('supabase.rpc(call.fn'); // les outils s'exécutent avec le JWT de l'utilisateur (RLS)
    expect(chat).not.toMatch(/admin\.rpc|admin\.from\('(rentals|customers|vehicles|damages)'/);

    const insights = read('generate-insights/index.ts');
    expect(insights).toContain("from('agency_ocr_settings')");
    expect(insights).toContain('settings.insights_enabled');
    expect(insights).toContain("membership.role !== 'owner' && membership.role !== 'manager'");
    expect(insights).toContain('DAILY_LIMIT');
    // aucune donnée personnelle ne peut partir : liste blanche reconstruite côté serveur
    expect(insights).not.toMatch(/telephone|cin_ou|nom_complet|immatriculation|email/i);

    // surcharge passagère : plusieurs modèles Gemini et un nouvel essai, jamais un autre fournisseur
    const gemini = read('_shared/gemini.ts');
    expect(gemini).toMatch(/RETRYABLE_STATUSES = new Set\(\[[^\]]*503/);
    expect(gemini).toContain("LATEST_ALIAS = 'gemini-flash-latest'");
    expect(gemini).toContain('discoverModels'); // les noms de modèles ne sont pas figés : liste demandée à Google
    expect(gemini).not.toContain('gemini-2.0-flash'); // modèle retiré par Google

    for (const code of [scan, inspection, insights, gemini]) {
      expect(code).not.toMatch(/Deno\.env\.get\('(GEMINI|ANTHROPIC|OPENAI)/);
      expect(code).not.toMatch(/api\.anthropic\.com|api\.openai\.com|vision\.googleapis|textract/i);
      expect(code).not.toMatch(/console\.\w+\([^)]*(apiKey|imageBase64|payload)/);
    }
  });
});
