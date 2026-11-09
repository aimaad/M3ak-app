import { engineOrigin, isAllowedEngineUrl } from '../live/engine-config';

describe('moteur vocal (fenêtre web interne)', () => {
  it('extrait l’origine HTTPS de l’adresse', () => {
    expect(engineOrigin('https://bibip-vocal.netlify.app/')).toBe('https://bibip-vocal.netlify.app');
    expect(engineOrigin('https://Exemple.com/chemin?x=1')).toBe('https://exemple.com');
    expect(engineOrigin('http://exemple.com/')).toBe('');
    expect(engineOrigin('')).toBe('');
  });
  it('n’autorise que le moteur lui-même', () => {
    const origin = 'https://bibip-vocal.netlify.app';
    expect(isAllowedEngineUrl('https://bibip-vocal.netlify.app/', origin)).toBe(true);
    expect(isAllowedEngineUrl('https://bibip-vocal.netlify.app/app.js', origin)).toBe(true);
    expect(isAllowedEngineUrl('about:blank', origin)).toBe(true);
    expect(isAllowedEngineUrl('https://autre-site.com/', origin)).toBe(false);
    expect(isAllowedEngineUrl('https://bibip-vocal.netlify.app.evil.com/', origin)).toBe(false);
    expect(isAllowedEngineUrl('http://bibip-vocal.netlify.app/', origin)).toBe(false);
    expect(isAllowedEngineUrl('https://x.com/', '')).toBe(false);
  });
});
