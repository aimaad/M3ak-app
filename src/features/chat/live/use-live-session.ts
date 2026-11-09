import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { makeTitle } from '../titles';
import { newId } from '../uuid';
import { endLiveSession, LiveError, requestLiveToken, runLiveTool, saveLiveConversation } from './api';
import { parseEngineMessage, sumUsage, type EngineCommand, type EngineMessage } from './protocol';
import { initialLiveState, linesForSave, reduceLive } from './state';

const SILENCE_CUTOFF_MS = 30_000; // coupure polie après 30 s sans parole (ni de l'utilisateur, ni de BIBIP)
const ENGINE_LOAD_TIMEOUT_MS = 15_000;

type Run = { sessionId: string; startedAt: number; lastActivity: number; ended: boolean };

/**
 * Une conversation vocale temps réel : jeton (serveur), moteur vocal (fenêtre web interne), outils avec les droits de l'utilisateur,
 * sous-titres, limites (durée, silence) et enregistrement dans l'historique du chat. Toute la logique de l'écran est ici.
 */
export function useLiveSession({ existingConversationId, voice, send }: { existingConversationId: string | null; voice: string; send: (command: EngineCommand) => void }) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reduceLive, initialLiveState);
  const [engineReady, setEngineReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(600);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const [limitReason, setLimitReason] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draftId] = useState(() => newId());
  const conversationId = existingConversationId ?? draftId;

  const run = useRef<Run | null>(null);
  const latest = useRef(state);
  const maxRef = useRef(maxSeconds);
  const started = useRef(false);
  useEffect(() => {
    latest.current = state;
    maxRef.current = maxSeconds;
  }, [state, maxSeconds]);

  /** Clôture la session (une seule fois) : durée et tokens pour les limites, puis sous-titres dans l'historique. Rend vrai si enregistrée. */
  const finish = useCallback(
    async (reason: string): Promise<boolean> => {
      const current = run.current;
      if (!current || current.ended) return false;
      current.ended = true;
      setEndedReason(reason);
      const totals = sumUsage(latest.current.usage);
      void endLiveSession({ sessionId: current.sessionId, seconds: Math.round((Date.now() - current.startedAt) / 1000), inputTokens: totals.inputTokens, outputTokens: totals.outputTokens, reason });
      const lines = linesForSave(latest.current.lines);
      const first = lines.find((line) => line.role === 'user');
      if (!first || !lines.some((line) => line.role === 'assistant')) return false;
      const ok = await saveLiveConversation({ conversationId, title: makeTitle(first.content), lines });
      if (ok) {
        setSaved(true);
        void queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        void queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      }
      return ok;
    },
    [conversationId, queryClient]
  );

  const stop = useCallback(
    (reason: string) => {
      send({ t: 'stop' });
      dispatch({ type: 'ended' });
      return finish(reason);
    },
    [finish, send]
  );

  const begin = useCallback(async (voiceName: string) => {
    dispatch({ type: 'reset' });
    setElapsed(0);
    setEndedReason(null);
    setLimitReason(null);
    try {
      const token = await requestLiveToken(voiceName);
      run.current = { sessionId: token.sessionId, startedAt: Date.now(), lastActivity: Date.now(), ended: false };
      setMaxSeconds(token.maxSeconds);
      send({ t: 'start', token: token.token, model: token.model, voice: token.voice, thinkingLevel: token.thinkingLevel });
    } catch (error) {
      const failure = error instanceof LiveError ? error : new LiveError('unavailable');
      setLimitReason(failure.reason ?? null);
      dispatch({ type: 'fail', failure: failure.failure });
    }
  }, [send]);

  const handleTool = useCallback(async (message: Extract<EngineMessage, { t: 'toolcall' }>) => {
    const out = await runLiveTool(message.name, message.args);
    if (!run.current || run.current.ended) return;
    if (out && out.cards.length > 0) dispatch({ type: 'cards', cards: out.cards });
    send({ t: 'tool', id: message.id, name: message.name, response: out ? { output: out.result } : { error: 'Outil indisponible pour le moment.' } });
  }, [send]);

  const onEngineMessage = useCallback(
    (raw: string) => {
      const message = parseEngineMessage(raw);
      if (!message) return;
      if (message.t === 'ready') {
        setEngineReady(true);
        return;
      }
      const current = run.current;
      // Fin tardive d'une ancienne session (changement de voix, reprise) : ignorée, elle ne doit pas couper la nouvelle.
      if (message.t === 'ended' && (!current || current.ended)) return;
      if (current && (message.t === 'user' || message.t === 'bot' || (message.t === 'level' && (message.mic > 0.15 || message.bot > 0.05)))) current.lastActivity = Date.now();
      if (message.t === 'toolcall') void handleTool(message);
      dispatch({ type: 'engine', message });
      if (message.t === 'ended') void finish(message.reason || 'user');
      if (message.t === 'error') void finish('error');
    },
    [finish, handleTool]
  );

  /** La fenêtre web n'a pas pu charger le moteur (pas d'internet, adresse injoignable). */
  const onLoadError = useCallback(() => dispatch({ type: 'fail', failure: 'engine' }), []);

  // Démarrage automatique dès que le moteur est prêt (mains libres).
  useEffect(() => {
    if (!engineReady || started.current) return;
    started.current = true;
    const timer = setTimeout(() => void begin(voice), 0);
    return () => clearTimeout(timer);
  }, [engineReady, begin, voice]);

  // Moteur jamais prêt : panne claire plutôt qu'une attente infinie.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!started.current) dispatch({ type: 'fail', failure: 'engine' });
    }, ENGINE_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // Minuteur : durée maximale de la session et coupure après un long silence.
  useEffect(() => {
    const timer = setInterval(() => {
      const current = run.current;
      if (!current || current.ended) return;
      const seconds = (Date.now() - current.startedAt) / 1000;
      setElapsed(Math.floor(seconds));
      if (seconds >= maxRef.current) void stop('time_limit');
      else if (Date.now() - current.lastActivity > SILENCE_CUTOFF_MS) void stop('silence');
    }, 500);
    return () => clearInterval(timer);
  }, [stop]);

  // Quitter l'écran : le micro s'arrête et la conversation est enregistrée.
  useEffect(() => {
    return () => {
      send({ t: 'stop' });
      void finish('left');
    };
  }, [finish, send]);

  const mute = useCallback((on: boolean) => {
    dispatch({ type: 'mute', on });
    send({ t: 'mute', on });
  }, [send]);

  /** Nouvelle session (après une fin, une erreur ou un changement de voix). */
  const restart = useCallback(
    async (voiceName: string) => {
      if (run.current && !run.current.ended) await stop('restart');
      run.current = null;
      await begin(voiceName);
    },
    [begin, stop]
  );

  return { state, elapsed, maxSeconds, endedReason, limitReason, saved, conversationId, onEngineMessage, onLoadError, mute, stop, restart };
}
