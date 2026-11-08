import { Endpointer } from '../endpoint';

/** Joue une séquence : [niveau, durée en ms] par pas de 80 ms (cadence de l'enregistreur). */
function play(endpointer: Endpointer, steps: [number, number][], start = 0): { events: string[]; time: number } {
  const events: string[] = [];
  let time = start;
  for (const [level, duration] of steps) {
    for (let elapsed = 0; elapsed < duration; elapsed += 80) {
      time += 80;
      const event = endpointer.push(level, time);
      if (event !== 'none') events.push(`${event}@${time}`);
    }
  }
  return { events, time };
}

describe('Endpointer (fin de phrase automatique)', () => {
  it('envoie après la parole suivie d’un silence', () => {
    const { events } = play(new Endpointer(), [[0.1, 400], [0.7, 1500], [0.1, 2000]]);
    expect(events).toHaveLength(1);
    expect(events[0].startsWith('end@')).toBe(true);
  });
  it('n’envoie pas pendant une courte pause au milieu d’une phrase', () => {
    const { events } = play(new Endpointer(), [[0.1, 400], [0.7, 1000], [0.1, 800], [0.7, 1000], [0.1, 600]]);
    expect(events).toEqual([]);
  });
  it('s’adapte au bruit de fond (pièce bruyante)', () => {
    // Bruit à 0,35 : seuil relevé, la parole à 0,8 est détectée, le bruit seul n’est pas de la parole.
    const { events } = play(new Endpointer(), [[0.35, 400], [0.8, 1200], [0.35, 2000]]);
    expect(events[0]?.startsWith('end@')).toBe(true);
  });
  it('ne prend pas un bruit de fond constant pour de la parole', () => {
    const { events } = play(new Endpointer({ noSpeechMs: 5000 }), [[0.35, 6000]]);
    expect(events).toEqual(['no-speech@5040']);
  });
  it('abandonne si personne ne parle', () => {
    const { events } = play(new Endpointer({ noSpeechMs: 3000 }), [[0.05, 4000]]);
    expect(events).toHaveLength(1);
    expect(events[0].startsWith('no-speech@')).toBe(true);
  });
  it('ignore un claquement trop bref', () => {
    const { events } = play(new Endpointer({ noSpeechMs: 3000 }), [[0.1, 400], [0.9, 80], [0.1, 3000]]);
    expect(events.every((e) => e.startsWith('no-speech'))).toBe(true);
  });
  it('ne signale la fin qu’une seule fois', () => {
    const { events } = play(new Endpointer(), [[0.1, 400], [0.7, 1200], [0.1, 6000]]);
    expect(events).toHaveLength(1);
  });
});
