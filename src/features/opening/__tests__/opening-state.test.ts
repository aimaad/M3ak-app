import { nextStatusOnArm, nextStatusOnEnd, nextStatusOnStart } from '../opening-state';

const normal = { reduceMotion: false, disabled: false };

describe('opening-state', () => {
  it('s’arme au premier lancement', () => {
    expect(nextStatusOnArm('idle', false, normal)).toEqual({ status: 'armed', consumed: true });
  });

  it('ne se rejoue pas une fois consommée', () => {
    expect(nextStatusOnArm('idle', true, normal)).toEqual({ status: 'idle', consumed: true });
    expect(nextStatusOnArm('playing', true, normal).status).toBe('playing');
  });

  it('est ignorée si les animations sont réduites ou sur écran bureau', () => {
    expect(nextStatusOnArm('idle', false, { reduceMotion: true, disabled: false })).toEqual({
      status: 'idle',
      consumed: true,
    });
    expect(nextStatusOnArm('idle', false, { reduceMotion: false, disabled: true })).toEqual({
      status: 'idle',
      consumed: true,
    });
  });

  it('démarre uniquement depuis « armed » et finit toujours en « idle »', () => {
    expect(nextStatusOnStart('armed')).toBe('playing');
    expect(nextStatusOnStart('idle')).toBe('idle');
    expect(nextStatusOnStart('playing')).toBe('playing');
    expect(nextStatusOnEnd()).toBe('idle');
  });
});
