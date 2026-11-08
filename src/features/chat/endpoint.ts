/**
 * Détection de fin de phrase (comme la voix de ChatGPT) : on suit le niveau du micro (0 à 1, voir `meteringToLevel`) et on
 * envoie tout seul quand la personne a parlé puis s'est tue un moment. Le bruit de fond de la pièce est mesuré au début
 * pour que le seuil s'adapte (cuisine, voiture, agence calme).
 *
 * `push(niveau, temps)` est appelé à chaque mesure ; `temps` est la durée d'enregistrement en ms. Il rend :
 *  - 'end'       : la personne a fini de parler → envoyer ;
 *  - 'no-speech' : personne n'a parlé depuis trop longtemps → arrêter l'écoute sans envoyer ;
 *  - 'none'      : rien à signaler.
 * Chaque détecteur ne signale 'end' ou 'no-speech' qu'une seule fois.
 */
export type EndpointEvent = 'none' | 'end' | 'no-speech';

export type EndpointOptions = {
  /** Silence qui suit la parole pour considérer la phrase finie. */
  silenceMs?: number;
  /** Durée de parole continue au-dessus du seuil pour compter comme de la parole (écarte un claquement). */
  minSpeechMs?: number;
  /** Mesure du bruit de fond au début de l'enregistrement. */
  calibrationMs?: number;
  /** Sans aucune parole au bout de ce temps : abandon. */
  noSpeechMs?: number;
};

export class Endpointer {
  private readonly silenceMs: number;
  private readonly minSpeechMs: number;
  private readonly calibrationMs: number;
  private readonly noSpeechMs: number;
  private samples: number[] = [];
  private threshold = 0.3;
  private calibrated = false;
  private speaking = false;
  private loudSince: number | null = null;
  private lastLoud = 0;
  private finished = false;

  constructor(options: EndpointOptions = {}) {
    this.silenceMs = options.silenceMs ?? 1300;
    this.minSpeechMs = options.minSpeechMs ?? 220;
    this.calibrationMs = options.calibrationMs ?? 350;
    this.noSpeechMs = options.noSpeechMs ?? 9000;
  }

  /** Vrai dès que de la parole a été entendue (l'orbe peut alors réagir plus fort). */
  get heardSpeech(): boolean {
    return this.speaking;
  }

  push(level: number, timeMs: number): EndpointEvent {
    if (this.finished) return 'none';

    // 1) Bruit de fond : la moyenne du début fixe le seuil (jamais trop bas, jamais trop haut).
    if (!this.calibrated) {
      this.samples.push(level);
      if (timeMs >= this.calibrationMs) {
        const floor = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
        this.threshold = Math.max(0.3, Math.min(0.6, Math.min(floor, 0.4) + 0.18));
        this.calibrated = true;
      }
      return 'none';
    }

    // 2) Parole : au-dessus du seuil assez longtemps.
    if (level > this.threshold) {
      if (this.loudSince === null) this.loudSince = timeMs;
      if (!this.speaking && timeMs - this.loudSince >= this.minSpeechMs) this.speaking = true;
      this.lastLoud = timeMs;
      return 'none';
    }
    this.loudSince = null;

    // 3) Silence : après la parole → fin de phrase ; sans parole du tout → abandon.
    if (this.speaking && timeMs - this.lastLoud >= this.silenceMs) {
      this.finished = true;
      return 'end';
    }
    if (!this.speaking && timeMs >= this.noSpeechMs) {
      this.finished = true;
      return 'no-speech';
    }
    return 'none';
  }
}
