import { nextStatusOnArm, nextStatusOnEnd, nextStatusOnStart, touchSkips } from '../opening-state';

const normal = { reduceMotion: false, disabled: false };

describe('opening-state', () => {
  it('s’arme à chaque lancement à froid et ne se rejoue pas ensuite', () => {
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

  it('un toucher passe l’introduction tant qu’elle est en cours', () => {
    expect(touchSkips('armed')).toBe(true);
    expect(touchSkips('playing')).toBe(true);
    expect(touchSkips('idle')).toBe(false);
  });
});
