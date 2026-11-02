import {
  chooseMode,
  nextStatusOnArm,
  nextStatusOnEnd,
  nextStatusOnStart,
  shouldRememberFirst,
  touchSkips,
} from '../opening-state';

const normal = { reduceMotion: false, disabled: false };

describe('opening-state', () => {
  it('première ouverture seulement si elle n’a jamais été vue', () => {
    expect(chooseMode(false)).toBe('first');
    expect(chooseMode(true)).toBe('instant');
    // Mémoire illisible : jamais la version spectaculaire à chaque lancement.
    expect(chooseMode(null)).toBe('instant');
  });

  it('s’arme au premier lancement et ne se rejoue pas une fois consommée', () => {
    expect(nextStatusOnArm('idle', false, normal)).toEqual({ status: 'armed', consumed: true });
    expect(nextStatusOnArm('idle', true, normal)).toEqual({ status: 'idle', consumed: true });
    expect(nextStatusOnArm('playing', true, normal).status).toBe('playing');
  });

  it('est ignorée si les animations sont réduites ou sur écran bureau', () => {
    expect(nextStatusOnArm('idle', false, { reduceMotion: true, disabled: false }).status).toBe(
      'idle'
    );
    expect(nextStatusOnArm('idle', false, { reduceMotion: false, disabled: true }).status).toBe(
      'idle'
    );
  });

  it('démarre uniquement depuis « armed » et finit toujours en « idle »', () => {
    expect(nextStatusOnStart('armed')).toBe('playing');
    expect(nextStatusOnStart('idle')).toBe('idle');
    expect(nextStatusOnStart('playing')).toBe('playing');
    expect(nextStatusOnEnd()).toBe('idle');
  });

  it('mémorise la première ouverture seulement si elle a été vue ou passée volontairement', () => {
    expect(shouldRememberFirst('first', 'completed')).toBe(true);
    expect(shouldRememberFirst('first', 'skipped')).toBe(true);
    expect(shouldRememberFirst('first', 'aborted')).toBe(false);
    expect(shouldRememberFirst('instant', 'completed')).toBe(false);
  });

  it('un toucher ne passe que la première introduction', () => {
    expect(touchSkips('first', 'playing')).toBe(true);
    expect(touchSkips('first', 'armed')).toBe(true);
    expect(touchSkips('first', 'idle')).toBe(false);
    expect(touchSkips('instant', 'playing')).toBe(false);
  });
});
