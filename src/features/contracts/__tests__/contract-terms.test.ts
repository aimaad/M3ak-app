import { contractArticles } from '../contract-terms';

describe('conditions générales', () => {
  const articles = contractArticles({ caution: '2 000 MAD', city: 'Casablanca' });

  it('chaque article existe en français et en arabe, sans texte vide ni variable oubliée', () => {
    expect(articles.length).toBeGreaterThanOrEqual(12);
    for (const a of articles) {
      for (const lang of [a.fr, a.ar]) {
        expect(lang.title.length).toBeGreaterThan(2);
        expect(lang.body.length).toBeGreaterThan(40);
        expect(lang.body.replace(/\{\{agence_nom\}\}/g, '')).not.toMatch(/\{\{|undefined|\$\{/);
      }
      expect(a.ar.body).toMatch(/[؀-ۿ]/);
    }
    expect(new Set(articles.map((a) => a.id)).size).toBe(articles.length);
  });

  it('reprend les conditions du carnet de location', () => {
    const ids = articles.map((a) => a.id);
    for (const id of ['conditions', 'mecanique', 'pneumatiques', 'etat', 'accident', 'parties-inferieures', 'decheance', 'caution', 'assurance-vol', 'restitution', 'amendes', 'juridiction']) {
      expect(ids).toContain(id);
    }
    const all = articles.map((a) => a.fr.body).join('\n');
    expect(all).toContain('24 heures');
    expect(all).toContain('CDW');
    expect(all).toContain('abus de confiance');
  });

  it("met le nom de l'agence en champ automatique (jamais un nom figé)", () => {
    expect(articles[0].fr.body).toContain('{{agence_nom}}');
    expect(articles[0].ar.body).toContain('{{agence_nom}}');
  });

  it('personnalise la ville ; ville inconnue = siège de l\'agence', () => {
    expect(articles.find((a) => a.id === 'juridiction')?.fr.body).toContain('Casablanca');
    expect(contractArticles({ caution: '1 MAD', city: '' }).find((a) => a.id === 'juridiction')?.fr.body).toContain('siège');
  });
});
