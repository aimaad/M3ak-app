const { FluencyTracker, base64ToInt16, estimateCostUsd, formatClock, int16ToBase64, liveErrorMessage, median, pcm16ToFloat32, resampleToPcm16, rmsLevel } = require('../audio.js');

describe('conversion audio', () => {
  it('48 kHz → 16 kHz : trois fois moins d’échantillons, valeurs conservées', () => {
    const input = new Float32Array(480).fill(0.5);
    const out = resampleToPcm16(input, 48000, 16000);
    expect(out.length).toBe(160);
    expect(out[0]).toBe(16384);
    expect(out[159]).toBe(16384);
  });
  it('limite à ±1 et gère le vide', () => {
    expect(resampleToPcm16(new Float32Array([2, 2, 2]), 16000, 16000)[0]).toBe(32767);
    expect(resampleToPcm16(new Float32Array([-2]), 16000, 16000)[0]).toBe(-32768);
    expect(resampleToPcm16(new Float32Array(0), 48000).length).toBe(0);
  });
  it('base64 aller-retour sans perte', () => {
    const pcm = new Int16Array([0, 1, -1, 32767, -32768, 1234]);
    expect([...base64ToInt16(int16ToBase64(pcm))]).toEqual([...pcm]);
    expect(base64ToInt16(int16ToBase64(new Int16Array(50000))).length).toBe(50000);
  });
  it('PCM → flottants entre -1 et 1', () => {
    const out = pcm16ToFloat32(new Int16Array([0, 32767, -32768]));
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(1);
    expect(out[2]).toBe(-1);
  });
  it('niveau du micro', () => {
    expect(rmsLevel(new Float32Array(100))).toBe(0);
    expect(rmsLevel(new Float32Array(100).fill(0.5))).toBe(1);
    expect(rmsLevel(new Float32Array(0))).toBe(0);
  });
});

describe('mesures de fluidité', () => {
  it('latence : de la fin de ma voix au premier son de BIBIP', () => {
    const t = new FluencyTracker();
    t.mic(0.5, 1000);
    t.mic(0.5, 1200);
    t.mic(0.01, 1300);
    t.mic(0.01, 1520); // pause de 320 ms : la phrase est finie, elle s'est terminée à 1200
    expect(t.botAudio(2000)).toBe(800);
    expect(t.botAudio(2100)).toBeNull(); // un seul calcul par phrase
    expect(t.latencies).toEqual([800]);
  });
  it('pas de latence tant que la phrase n’est pas finie', () => {
    const t = new FluencyTracker();
    t.mic(0.5, 1000);
    t.mic(0.01, 1100);
    expect(t.botAudio(1500)).toBeNull();
  });
  it('interruption : du début de ma parole pendant que BIBIP parle à l’arrêt de sa voix', () => {
    const t = new FluencyTracker();
    t.mic(0.5, 5000, true);
    expect(t.interrupted(5140)).toBe(140);
    expect(t.interrupted(5200)).toBeNull();
    expect(t.interruptions).toEqual([140]);
  });
  it('pas d’interruption si BIBIP ne parlait pas', () => {
    const t = new FluencyTracker();
    t.mic(0.5, 1000, false);
    expect(t.interrupted(1100)).toBeNull();
  });
  it('médiane', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(3);
  });
});

describe('coût, minuteur, messages', () => {
  it('coût estimé au tarif audio', () => {
    expect(estimateCostUsd(1_000_000, 1_000_000)).toBe(15);
    expect(estimateCostUsd(1500, 1500)).toBe(0.0225);
    expect(estimateCostUsd(-1, -1)).toBe(0);
  });
  it('minuteur', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(605)).toBe('10:05');
  });
  it('messages d’erreur clairs, jamais de texte technique brut', () => {
    expect(liveErrorMessage({ error: 'live_limit', reason: 'agency_daily' })).toContain('agence');
    expect(liveErrorMessage({ error: 'live_limit', reason: 'user_daily' })).toContain('Votre limite');
    expect(liveErrorMessage({ error: 'live_unavailable', detail: 'migration_0064_missing' })).toContain('0064');
    expect(liveErrorMessage({ error: 'chat_disabled' })).toContain('activé');
    expect(liveErrorMessage(null)).toContain('Impossible');
  });
});
