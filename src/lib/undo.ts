export type UndoRequest = {
  /** Phrase à afficher, ex. « Client archivé ». */
  message: string;
  /** Libellé du bouton, ex. « Annuler ». */
  actionLabel: string;
  /** Rétablit l'état d'avant. Peut échouer : l'erreur est transmise à `onUndoError`. */
  onUndo: () => Promise<unknown> | unknown;
  onUndoError?: (error: unknown) => void;
  /** Durée pendant laquelle l'annulation reste possible (5 à 30 s recommandées). */
  durationMs?: number;
};

export type ActiveUndo = Pick<UndoRequest, 'message' | 'actionLabel'> & { id: number };

export const DEFAULT_UNDO_MS = 8000;

/**
 * Gère UNE annulation à la fois : une nouvelle action remplace l'ancienne (l'ancienne reste faite, simplement non
 * annulable). Indépendant de React pour être testé avec de faux minuteurs.
 */
export class UndoController {
  private current: (ActiveUndo & { request: UndoRequest }) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private counter = 0;

  constructor(private readonly onChange: (active: ActiveUndo | null) => void) {}

  show(request: UndoRequest): void {
    this.clearTimer();
    this.counter += 1;
    this.current = { id: this.counter, message: request.message, actionLabel: request.actionLabel, request };
    this.onChange({ id: this.current.id, message: request.message, actionLabel: request.actionLabel });
    this.timer = setTimeout(() => this.dismiss(), request.durationMs ?? DEFAULT_UNDO_MS);
  }

  /** L'utilisateur touche « Annuler ». */
  async undo(): Promise<void> {
    const active = this.current;
    if (!active) return;
    this.dismiss();
    try {
      await active.request.onUndo();
    } catch (error) {
      active.request.onUndoError?.(error);
    }
  }

  dismiss(): void {
    this.clearTimer();
    this.current = null;
    this.onChange(null);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
