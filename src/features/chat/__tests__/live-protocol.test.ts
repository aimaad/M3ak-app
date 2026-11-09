import { commandScript, parseEngineMessage, sumUsage } from '../live/protocol';
import { displayPhase, initialLiveState, linesForSave, reduceLive, type LiveAction, type LiveState } from '../live/state';

const msg = (m: object) => JSON.stringify(m);

describe('protocole moteur → app (rien n’est cru sans vérification)', () => {
  it('accepte les messages valides', () => {
    expect(parseEngineMessage(msg({ t: 'ready' }))).toEqual({ t: 'ready' });
    expect(parseEngineMessage(msg({ t: 'state', s: 'speaking' }))).toEqual({ t: 'state', s: 'speaking' });
    expect(parseEngineMessage(msg({ t: 'user', text: 'شنو هي الطوموبيلات' }))).toEqual({ t: 'user', text: 'شنو هي الطوموبيلات' });
    expect(parseEngineMessage(msg({ t: 'interrupted', ms: 181.6 }))).toEqual({ t: 'interrupted', ms: 182 });
    expect(parseEngineMessage(msg({ t: 'toolcall', id: 'abc', name: 'available_vehicles', args: { from: '2030-01-01' } }))).toEqual({ t: 'toolcall', id: 'abc', name: 'available_vehicles', args: { from: '2030-01-01' } });
    expect(parseEngineMessage(msg({ t: 'error', code: 'mic_denied', message: 'x' }))).toEqual({ t: 'error', code: 'mic_denied', message: 'x' });
  });
  it('refuse le reste : texte invalide, type inconnu, état inconnu, outil au nom suspect, trop gros', () => {
    expect(parseEngineMessage('pas du json')).toBeNull();
    expect(parseEngineMessage(42)).toBeNull();
    expect(parseEngineMessage(msg({ t: 'inconnu' }))).toBeNull();
    expect(parseEngineMessage(msg({ t: 'state', s: 'hack' }))).toBeNull();
    expect(parseEngineMessage(msg({ t: 'user', text: '' }))).toBeNull();
    expect(parseEngineMessage(msg({ t: 'toolcall', id: 'a', name: 'drop table', args: {} }))).toBeNull();
    expect(parseEngineMessage(msg({ t: 'toolcall', id: 'a', name: 'fleet', args: { x: 'y'.repeat(2000) } }))).toBeNull();
    expect(parseEngineMessage(msg({ t: 'error', code: 'autre' }))).toBeNull();
    expect(parseEngineMessage('x'.repeat(30_000))).toBeNull();
  });
  it('borne les niveaux et la longueur du texte', () => {
    expect(parseEngineMessage(msg({ t: 'level', mic: 5, bot: -2 }))).toEqual({ t: 'level', mic: 1, bot: 0 });
    expect((parseEngineMessage(msg({ t: 'bot', text: 'a'.repeat(5000) })) as { text: string }).text).toHaveLength(600);
  });
  it('la commande est encodée deux fois : exécutée, elle livre le texte tel quel et aucun code injecté ne s’exécute', () => {
    const hostile = '"});alert(1);//';
    const script = commandScript({ t: 'tool', id: 'x', name: 'fleet', response: { error: hostile } });
    let received = '';
    let alerted = false;
    class FakeMessageEvent {
      data: string;
      constructor(_type: string, init: { data: string }) {
        this.data = init.data;
      }
    }
    const run = new Function('window', 'MessageEvent', 'alert', script);
    run({ dispatchEvent: (event: FakeMessageEvent) => (received = event.data) }, FakeMessageEvent, () => (alerted = true));
    expect(alerted).toBe(false);
    expect(JSON.parse(received).response.error).toBe(hostile);
  });
  it('totaux d’usage : un relevé par tour, réflexion en sortie', () => {
    expect(sumUsage([{ promptTokenCount: 3735, responseTokenCount: 148, thoughtsTokenCount: 405 }, { promptTokenCount: 3971, responseTokenCount: 78, thoughtsTokenCount: 92 }, {}])).toEqual({ inputTokens: 7706, outputTokens: 723, turns: 3 });
  });
});

const run = (actions: LiveAction[], from: LiveState = initialLiveState) => actions.reduce(reduceLive, from);
const eng = (message: object): LiveAction => ({ type: 'engine', message: message as never });

describe('état de l’écran vocal', () => {
  it('assemble les sous-titres en alternant utilisateur / BIBIP', () => {
    const state = run([eng({ t: 'user', text: 'شنو' }), eng({ t: 'user', text: ' هي' }), eng({ t: 'bot', text: 'كاين' }), eng({ t: 'bot', text: ' جوج' }), eng({ t: 'turn' }), eng({ t: 'user', text: 'merci' })]);
    expect(state.lines.map((l) => [l.role, l.text])).toEqual([['user', 'شنو هي'], ['assistant', 'كاين جوج'], ['user', 'merci']]);
  });
  it('les cartes d’un outil se rattachent à la réponse suivante, pas à la question', () => {
    const card = { type: 'vehicles' as const, items: [{ kind: 'vehicle' as const, id: 'v1', title: 'Logan', plate: null, customer: null, date: null, tone: 'free' as const }] };
    const state = run([eng({ t: 'user', text: 'voitures libres ?' }), eng({ t: 'state', s: 'tool' }), { type: 'cards', cards: [card] }, eng({ t: 'state', s: 'speaking' }), eng({ t: 'bot', text: 'Il y en a une.' })]);
    expect(state.lines[0].cards).toEqual([]);
    expect(state.lines[1].cards).toEqual([card]);
    expect(state.pendingCards).toEqual([]);
  });
  it('micro coupé : affiché seulement quand BIBIP écoute', () => {
    const muted = run([eng({ t: 'state', s: 'listening' }), { type: 'mute', on: true }]);
    expect(displayPhase(muted)).toBe('muted');
    expect(displayPhase(run([eng({ t: 'state', s: 'speaking' })], muted))).toBe('speaking');
  });
  it('une erreur l’emporte sur tout et remet les niveaux à zéro', () => {
    const state = run([eng({ t: 'level', mic: 0.5, bot: 0.2 }), eng({ t: 'error', code: 'mic_denied', message: '' })]);
    expect(displayPhase(state)).toBe('error');
    expect(state.failure).toBe('mic_denied');
    expect(run([{ type: 'fail', failure: 'live_limit' }], state).micLevel).toBe(0);
  });
  it('mesures : latences et interruption', () => {
    const state = run([eng({ t: 'latency', ms: 900 }), eng({ t: 'latency', ms: 1100 }), eng({ t: 'interrupted', ms: 182 }), eng({ t: 'interrupted', ms: null })]);
    expect(state.latencies).toEqual([900, 1100]);
    expect(state.lastInterruptMs).toBe(182);
  });
  it('à enregistrer : texte seulement, sans lignes vides', () => {
    const state = run([eng({ t: 'user', text: ' salut ' }), eng({ t: 'bot', text: 'Bonjour' })]);
    expect(linesForSave([...state.lines, { id: 99, role: 'user', text: '   ', cards: [] }]).map((l) => [l.role, l.content])).toEqual([['user', 'salut'], ['assistant', 'Bonjour']]);
  });
  it('ne perd pas une erreur quand le moteur annonce la fin', () => {
    const state = run([eng({ t: 'error', code: 'closed', message: '' }), eng({ t: 'ended', reason: 'closed' })]);
    expect(state.failure).toBe('closed');
    expect(state.phase).not.toBe('ended');
  });
});
