import type { ChatCard } from '../types';
import type { EngineErrorCode, EngineMessage, UsageMeta } from './protocol';

export type LivePhase = 'connecting' | 'listening' | 'thinking' | 'tool' | 'speaking' | 'muted' | 'error' | 'ended';
export type LiveLine = { id: number; role: 'user' | 'assistant'; text: string; cards: ChatCard[] };
export type LiveFailure = EngineErrorCode | 'live_limit' | 'not_configured' | 'disabled' | 'unavailable' | 'timeout' | 'engine';

export type LiveState = {
  /** Phase du moteur (sans le micro coupé) ; l'écran affiche `displayPhase`. */
  phase: Exclude<LivePhase, 'muted'>;
  muted: boolean;
  lines: LiveLine[];
  /** Cartes de données reçues des outils, rattachées à la prochaine réponse de BIBIP. */
  pendingCards: ChatCard[];
  micLevel: number;
  botLevel: number;
  failure: LiveFailure | null;
  gestureNeeded: boolean;
  usage: UsageMeta[];
  latencies: number[];
  lastInterruptMs: number | null;
  nextId: number;
};

export type LiveAction =
  | { type: 'engine'; message: EngineMessage }
  | { type: 'cards'; cards: ChatCard[] }
  | { type: 'mute'; on: boolean }
  | { type: 'fail'; failure: LiveFailure }
  | { type: 'ended' }
  | { type: 'reset' };

export const initialLiveState: LiveState = {
  phase: 'connecting',
  muted: false,
  lines: [],
  pendingCards: [],
  micLevel: 0,
  botLevel: 0,
  failure: null,
  gestureNeeded: false,
  usage: [],
  latencies: [],
  lastInterruptMs: null,
  nextId: 1,
};

export function displayPhase(state: LiveState): LivePhase {
  if (state.failure) return 'error';
  return state.muted && state.phase === 'listening' ? 'muted' : state.phase;
}

/** Ajoute du texte à la dernière ligne du même rôle, sinon ouvre une nouvelle ligne (la parole suit l'alternance utilisateur / BIBIP). */
function appendText(state: LiveState, role: LiveLine['role'], text: string): LiveState {
  const last = state.lines[state.lines.length - 1];
  if (last && last.role === role) {
    return { ...state, lines: [...state.lines.slice(0, -1), { ...last, text: last.text + text }] };
  }
  // Une nouvelle réponse de BIBIP reçoit les cartes des outils appelés juste avant.
  const cards = role === 'assistant' ? state.pendingCards : [];
  const line: LiveLine = { id: state.nextId, role, text: text.replace(/^\s+/, ''), cards };
  return { ...state, lines: [...state.lines, line], nextId: state.nextId + 1, pendingCards: role === 'assistant' ? [] : state.pendingCards };
}

export function reduceLive(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case 'reset':
      return initialLiveState;
    case 'mute':
      return { ...state, muted: action.on };
    case 'fail':
      return { ...state, failure: action.failure, micLevel: 0, botLevel: 0 };
    case 'ended':
      return { ...state, phase: 'ended', micLevel: 0, botLevel: 0 };
    case 'cards':
      // Les cartes s'attachent à la réponse en cours si BIBIP a déjà commencé à parler, sinon à la prochaine.
      return state.lines[state.lines.length - 1]?.role === 'assistant' && state.phase === 'speaking'
        ? { ...state, lines: [...state.lines.slice(0, -1), { ...state.lines[state.lines.length - 1], cards: [...state.lines[state.lines.length - 1].cards, ...action.cards].slice(0, 3) }] }
        : { ...state, pendingCards: [...state.pendingCards, ...action.cards].slice(0, 3) };
    case 'engine': {
      const message = action.message;
      switch (message.t) {
        case 'state':
          return { ...state, phase: message.s };
        case 'level':
          return { ...state, micLevel: message.mic, botLevel: message.bot };
        case 'user':
          return appendText(state, 'user', message.text);
        case 'bot':
          return appendText(state, 'assistant', message.text);
        case 'interrupted':
          return { ...state, lastInterruptMs: message.ms ?? state.lastInterruptMs };
        case 'latency':
          return { ...state, latencies: [...state.latencies, message.ms].slice(-20) };
        case 'usage':
          return { ...state, usage: [...state.usage, message.usage].slice(-200) };
        case 'needs_gesture':
          return { ...state, gestureNeeded: true };
        case 'gesture_ok':
          return { ...state, gestureNeeded: false };
        case 'error':
          return { ...state, failure: message.code };
        case 'ended':
          return state.failure ? state : { ...state, phase: 'ended', micLevel: 0, botLevel: 0 };
        default:
          return state;
      }
    }
  }
}

/** Phrases à enregistrer dans l'historique du chat (texte seulement). */
export function linesForSave(lines: LiveLine[]): { role: 'user' | 'assistant'; content: string; cards: ChatCard[] }[] {
  return lines.flatMap((line) => {
    const content = line.text.replace(/\s+/g, ' ').trim();
    return content ? [{ role: line.role, content, cards: line.cards }] : [];
  });
}
