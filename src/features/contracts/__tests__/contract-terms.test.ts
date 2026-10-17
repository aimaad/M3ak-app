import { contractArticles } from '../contract-terms';

describe('conditions générales', () => {
  const articles = contractArticles({ caution: '2 000 MAD', city: 'Casablanca' });

  it('chaque article existe en français et en arabe, sans texte vide ni variable oubliée', () => {
    expect(articles.length).toBeGreaterThanOrEqual(12);
    for (const a of articles) {
      for (const lang of [a.fr, a.ar]) {
        expect(lang.title.length).toBeGreaterThan(2);
        expect(lang.body.length).toBeGreaterThan(40);
        expect(lang.body).not.toMatch(/\{\{|undefined|\$\{/);
      }
      expect(a.ar.body).toMatch(/[؀-ۿ]/);
    }
    expect(new Set(articles.map((a) => a.id)).size).toBe(articles.length);
  });

  it('couvre les sujets essentiels', () => {
    const ids = articles.map((a) => a.id);
    for (const id of ['objet', 'duree', 'prix', 'caution', 'conducteurs', 'usage', 'assurance', 'accident', 'infractions', 'donnees', 'litiges']) {
      expect(ids).toContain(id);
    }
  });

  it('personnalise la caution et la ville ; ville inconnue = siège de l\'agence', () => {
    expect(articles.find((a) => a.id === 'caution')?.fr.body).toContain('2 000 MAD');
    expect(articles.find((a) => a.id === 'litiges')?.fr.body).toContain('Casablanca');
    expect(contractArticles({ caution: '1 MAD', city: '' }).find((a) => a.id === 'litiges')?.fr.body).toContain('siège');
  });
});
