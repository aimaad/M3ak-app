/**
 * Suppression différée avec annulation : l'élément disparaît tout de suite de l'écran, mais n'est vraiment supprimé qu'après
 * `delayMs` (5 s) ; « Annuler » le remet. À la fermeture de l'écran, `flush` termine les suppressions en attente.
 * Indépendant de React pour être testé avec de faux minuteurs.
 */
export class DeferredDeleter<T> {
  private pending = new Map<string, { item: T; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly options: {
      delayMs: number;
      /** Suppression réelle (appel serveur). */
      commit: (item: T) => void;
      /** L'ensemble des éléments cachés a changé. */
      onChange: (hiddenIds: ReadonlySet<string>) => void;
    }
  ) {}

  hiddenIds(): ReadonlySet<string> {
    return new Set(this.pending.keys());
  }

  schedule(id: string, item: T): void {
    this.cancelTimer(id);
    const timer = setTimeout(() => this.commitNow(id), this.options.delayMs);
    this.pending.set(id, { item, timer });
    this.options.onChange(this.hiddenIds());
  }

  /** « Annuler » : l'élément revient. */
  undo(id: string): void {
    if (!this.pending.has(id)) return;
    this.cancelTimer(id);
    this.pending.delete(id);
    this.options.onChange(this.hiddenIds());
  }

  /** Termine toutes les suppressions en attente (fermeture de l'écran). */
  flush(): void {
    for (const id of [...this.pending.keys()]) this.commitNow(id);
  }

  private commitNow(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    this.options.commit(entry.item);
    this.options.onChange(this.hiddenIds());
  }

  private cancelTimer(id: string): void {
    const entry = this.pending.get(id);
    if (entry) clearTimeout(entry.timer);
  }
}
