/**
 * Échanges entre l'app et le moteur vocal (fenêtre web interne). Tout ce que dit le moteur est traité comme une DONNÉE non fiable :
 * chaque message est revérifié (forme, types, longueurs) avant d'être utilisé.
 */

export type EngineState = 'connecting' | 'listening' | 'thinking' | 'tool' | 'speaking';
export type EngineErrorCode = 'mic_denied' | 'mic_unavailable' | 'connect_failed' | 'closed';
export type UsageMeta = Record<string, unknown>;

export type EngineMessage =
  | { t: 'ready' }
  | { t: 'state'; s: EngineState }
  | { t: 'level'; mic: number; bot: number }
  | { t: 'user'; text: string }
  | { t: 'bot'; text: string }
  | { t: 'turn' }
  | { t: 'interrupted'; ms: number | null }
  | { t: 'latency'; ms: number }
  | { t: 'toolcall'; id: string; name: string; args: Record<string, unknown> }
  | { t: 'usage'; usage: UsageMeta }
  | { t: 'goaway' }
  | { t: 'needs_gesture' }
  | { t: 'gesture_ok' }
  | { t: 'error'; code: EngineErrorCode; message: string }
  | { t: 'ended'; reason: string };

export type EngineCommand =
  | { t: 'start'; token: string; model: string; voice: string; thinkingLevel: string | null }
  | { t: 'stop' }
  | { t: 'mute'; on: boolean }
  | { t: 'tool'; id: string; name: string; response: Record<string, unknown> }
  | { t: 'resume' };

const STATES: EngineState[] = ['connecting', 'listening', 'thinking', 'tool', 'speaking'];
const ERRORS: EngineErrorCode[] = ['mic_denied', 'mic_unavailable', 'connect_failed', 'closed'];
const MAX_TEXT = 600;
const MAX_ARGS_CHARS = 1_500;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const level = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0);

/** Message du moteur (texte JSON) → message vérifié, ou null s'il est invalide. */
export function parseEngineMessage(raw: unknown): EngineMessage | null {
  if (typeof raw !== 'string' || raw.length > 20_000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value) || typeof value.t !== 'string') return null;
  switch (value.t) {
    case 'ready':
    case 'turn':
    case 'goaway':
    case 'needs_gesture':
    case 'gesture_ok':
      return { t: value.t };
    case 'state':
      return STATES.includes(value.s as EngineState) ? { t: 'state', s: value.s as EngineState } : null;
    case 'level':
      return { t: 'level', mic: level(value.mic), bot: level(value.bot) };
    case 'user':
    case 'bot':
      return typeof value.text === 'string' && value.text ? { t: value.t, text: value.text.replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').slice(0, MAX_TEXT) } : null;
    case 'interrupted':
      return { t: 'interrupted', ms: typeof value.ms === 'number' && Number.isFinite(value.ms) ? Math.max(0, Math.round(value.ms)) : null };
    case 'latency':
      return typeof value.ms === 'number' && Number.isFinite(value.ms) ? { t: 'latency', ms: Math.max(0, Math.round(value.ms)) } : null;
    case 'toolcall': {
      const args = isObject(value.args) ? value.args : {};
      if (typeof value.id !== 'string' || typeof value.name !== 'string' || !value.id || value.id.length > 120 || !/^[a-z_]{1,40}$/.test(value.name)) return null;
      return JSON.stringify(args).length <= MAX_ARGS_CHARS ? { t: 'toolcall', id: value.id, name: value.name, args } : null;
    }
    case 'usage':
      return isObject(value.usage) ? { t: 'usage', usage: value.usage } : null;
    case 'error':
      return ERRORS.includes(value.code as EngineErrorCode) ? { t: 'error', code: value.code as EngineErrorCode, message: typeof value.message === 'string' ? value.message.slice(0, 160) : '' } : null;
    case 'ended':
      return { t: 'ended', reason: typeof value.reason === 'string' ? value.reason.replace(/[^a-z_]/g, '').slice(0, 40) : '' };
    default:
      return null;
  }
}

/** Commande pour le moteur → code JavaScript à exécuter dans la fenêtre web (le texte JSON est encodé deux fois : jamais de code injecté). */
export function commandScript(command: EngineCommand): string {
  return `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(command))}}));true;`;
}

export type UsageTotals = { inputTokens: number; outputTokens: number; turns: number };

/** Totaux de la session à partir des relevés de Google (un par tour, non cumulés ; la réflexion compte en sortie). */
export function sumUsage(list: UsageMeta[]): UsageTotals {
  const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0);
  let inputTokens = 0;
  let outputTokens = 0;
  for (const usage of list) {
    inputTokens += number(usage.promptTokenCount);
    outputTokens += number(usage.responseTokenCount) + number(usage.thoughtsTokenCount);
  }
  return { inputTokens: Math.round(inputTokens), outputTokens: Math.round(outputTokens), turns: list.length };
}
