import { audioContentType, audioExtension, formatDuration, meteringToLevel, playedFraction, pushLevel, voiceBars, voicePath } from '../voice-utils';

describe('vocal : utilitaires', () => {
  it('niveau du micro entre 0 et 1', () => {
    expect(meteringToLevel(-160)).toBe(0);
    expect(meteringToLevel(0)).toBe(1);
    expect(meteringToLevel(-27.5)).toBeCloseTo(0.5, 2);
    expect(meteringToLevel(undefined)).toBe(0);
    expect(meteringToLevel(Number.NaN)).toBe(0);
  });
  it('forme d’onde : garde les 30 derniers niveaux', () => {
    let h: number[] = [];
    for (let i = 0; i < 40; i++) h = pushLevel(h, i / 40);
    expect(h).toHaveLength(30);
    expect(h[h.length - 1]).toBeCloseTo(39 / 40);
    expect(pushLevel([], 5)).toEqual([1]);
  });
  it('durée « m:ss »', () => {
    expect(formatDuration(7000)).toBe('0:07');
    expect(formatDuration(85_300)).toBe('1:25');
    expect(formatDuration(120_000)).toBe('2:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
  it('barres d’une bulle vocale : stables pour un même message, entre 6 et 28 px', () => {
    const a = voiceBars('chemin/audio.wav');
    expect(a).toHaveLength(24);
    expect(voiceBars('chemin/audio.wav')).toEqual(a);
    expect(voiceBars('autre.wav')).not.toEqual(a);
    expect(Math.min(...a)).toBeGreaterThanOrEqual(6);
    expect(Math.max(...a)).toBeLessThanOrEqual(28);
  });
  it('types de fichiers audio', () => {
    expect(audioContentType('file:///x/a.wav')).toBe('audio/wav');
    expect(audioContentType('file:///x/a.aac')).toBe('audio/aac');
    expect(audioContentType('file:///x/a.m4a')).toBe('audio/mp4');
    expect(audioExtension('file:///x/a.WAV')).toBe('wav');
    expect(audioExtension('file:///x/a.caf')).toBe('aac');
  });
  it('chemin du stockage privé : dossier de l’utilisateur puis de la conversation', () => {
    expect(voicePath('USER', 'CONV', 'wav')).toMatch(/^USER\/CONV\/[0-9a-f-]{36}\.wav$/);
  });
  it('part déjà lue', () => {
    expect(playedFraction(3.5, 7000)).toBe(0.5);
    expect(playedFraction(10, 7000)).toBe(1);
    expect(playedFraction(1, 0)).toBe(0);
  });
});
