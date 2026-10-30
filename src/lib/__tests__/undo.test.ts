import { DEFAULT_UNDO_MS, UndoController, type ActiveUndo } from '../undo';

function setup() {
  const states: (ActiveUndo | null)[] = [];
  const controller = new UndoController((active) => states.push(active));
  return { controller, states };
}

describe('UndoController', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('affiche la phrase puis la retire après la durée prévue', () => {
    const { controller, states } = setup();
    controller.show({ message: 'Client archivé', actionLabel: 'Annuler', onUndo: jest.fn() });
    expect(states.at(-1)).toMatchObject({ message: 'Client archivé', actionLabel: 'Annuler' });
    jest.advanceTimersByTime(DEFAULT_UNDO_MS - 1);
    expect(states.at(-1)).not.toBeNull();
    jest.advanceTimersByTime(1);
    expect(states.at(-1)).toBeNull();
  });

  it('exécute l\'annulation une seule fois et masque la phrase', async () => {
    const { controller, states } = setup();
    const onUndo = jest.fn().mockResolvedValue(undefined);
    controller.show({ message: 'x', actionLabel: 'Annuler', onUndo });
    await controller.undo();
    await controller.undo();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBeNull();
  });

  it('transmet l\'échec de l\'annulation', async () => {
    const { controller } = setup();
    const onUndoError = jest.fn();
    controller.show({ message: 'x', actionLabel: 'Annuler', onUndo: () => Promise.reject(new Error('non')), onUndoError });
    await controller.undo();
    expect(onUndoError).toHaveBeenCalledTimes(1);
  });

  it('une nouvelle action remplace l\'ancienne sans l\'annuler', async () => {
    const { controller } = setup();
    const first = jest.fn();
    const second = jest.fn();
    controller.show({ message: 'a', actionLabel: 'Annuler', onUndo: first });
    controller.show({ message: 'b', actionLabel: 'Annuler', onUndo: second });
    await controller.undo();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien sans action en cours', async () => {
    const { controller } = setup();
    await expect(controller.undo()).resolves.toBeUndefined();
  });

  it('respecte une durée personnalisée', () => {
    const { controller, states } = setup();
    controller.show({ message: 'x', actionLabel: 'Annuler', onUndo: jest.fn(), durationMs: 2000 });
    jest.advanceTimersByTime(2000);
    expect(states.at(-1)).toBeNull();
  });
});
