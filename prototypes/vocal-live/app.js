// Prototype BIBIP vocal temps réel : page web de test (HTTPS obligatoire pour le micro).
// Flux : connexion → jeton éphémère (fonction chat-live-token) → WebSocket DIRECT vers Gemini Live → micro en continu,
// voix en continu, sous-titres, interruption, outil « voitures libres » (fonction chat-tools, droits de l'utilisateur).
// La clé Gemini n'est jamais dans cette page ; l'audio n'est pas enregistré.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { GoogleGenAI, Modality } from 'https://esm.sh/@google/genai@3.0.0';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';
import { base64ToInt16, estimateCostUsd, FluencyTracker, formatClock, int16ToBase64, liveErrorMessage, median, MIC_RATE, OUT_RATE, pcm16ToFloat32, resampleToPcm16, rmsLevel, summarizeUsage } from './audio.js';

const SILENCE_CUTOFF_MS = 30_000; // coupure après 30 s sans parole (ni de ma part, ni de BIBIP)

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true } });
const $ = (id) => document.getElementById(id);
const el = { login: $('login'), email: $('email'), password: $('password'), loginError: $('login-error'), panel: $('panel'), who: $('who'), logout: $('logout'), voice: $('voice'), meta: $('meta'), orb: $('orb'), status: $('status'), timer: $('timer'), start: $('start'), mute: $('mute'), stop: $('stop'), error: $('error'), captions: $('captions'), cards: $('cards'), latency: $('m-latency'), median: $('m-median'), interrupt: $('m-interrupt'), duration: $('m-duration'), tokens: $('m-tokens'), cost: $('m-cost'), debug: $('debug') };

const STATUS = { idle: 'Prêt', connecting: 'Connexion…', listening: "J'écoute…", thinking: 'BIBIP réfléchit…', tool: 'Je regarde vos voitures…', speaking: 'BIBIP parle', muted: 'Micro coupé', error: 'Erreur', ended: 'Session terminée' };
let live = null; // session en cours (null si aucune)

function setState(state) {
  el.orb.dataset.state = state === 'ended' ? 'idle' : state;
  el.status.textContent = STATUS[state] ?? state;
}

function showError(message) {
  el.error.textContent = message ?? '';
  el.error.hidden = !message;
}

// ---------------------------------------------------------------- connexion
async function authedFetch(name, body) {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return { ok: false, error: 'not_authenticated' };
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  return response.json().catch(() => ({ ok: false, error: 'invalid_response' }));
}

async function showPanel() {
  const { data } = await supabase.auth.getUser();
  el.who.textContent = data.user?.email ?? '';
  el.login.hidden = true;
  el.panel.hidden = false;
  setState('idle');
}

el.login.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.loginError.hidden = true;
  const { error } = await supabase.auth.signInWithPassword({ email: el.email.value.trim(), password: el.password.value });
  el.password.value = '';
  if (error) {
    el.loginError.textContent = 'E-mail ou mot de passe incorrect.';
    el.loginError.hidden = false;
    return;
  }
  await showPanel();
});

el.logout.addEventListener('click', async () => {
  if (live) await endSession('logout');
  await supabase.auth.signOut();
  el.panel.hidden = true;
  el.login.hidden = false;
});

supabase.auth.getSession().then(({ data }) => {
  if (data.session) void showPanel();
});

// ---------------------------------------------------------------- sous-titres et cartes
function addLine(kind) {
  for (const old of el.captions.querySelectorAll('.line:not(.old)')) if (old.dataset.kind === kind || kind === 'user') old.classList.add('old');
  const line = document.createElement('div');
  line.className = `line ${kind}`;
  line.dataset.kind = kind;
  line.setAttribute('dir', 'auto'); // darija en lettres arabes : de droite à gauche
  const label = document.createElement('small');
  label.textContent = kind === 'user' ? 'Vous' : 'BIBIP';
  const text = document.createElement('span');
  line.append(label, text);
  el.captions.append(line);
  el.captions.scrollTop = el.captions.scrollHeight;
  return text;
}

function appendCaption(kind, chunk) {
  if (!chunk) return;
  const key = kind === 'user' ? 'userLine' : 'botLine';
  if (!live[key]) live[key] = addLine(kind);
  live[key].textContent += chunk;
  el.captions.scrollTop = el.captions.scrollHeight;
}

function renderCards(cards) {
  for (const card of Array.isArray(cards) ? cards : []) {
    for (const item of card.items ?? []) {
      const row = document.createElement('div');
      row.className = 'vcard';
      const title = document.createElement('strong');
      title.textContent = String(item.title ?? '');
      const detail = document.createElement('span');
      detail.className = 'muted';
      detail.textContent = String(item.plate ?? item.customer ?? '');
      row.append(title, detail);
      el.cards.append(row);
    }
  }
}

// ---------------------------------------------------------------- lecture de la voix de BIBIP (PCM 24 kHz en continu)
function playChunk(base64) {
  const pcm = base64ToInt16(base64);
  if (!pcm.length) return;
  const samples = pcm16ToFloat32(pcm);
  const buffer = live.ctx.createBuffer(1, samples.length, OUT_RATE);
  buffer.copyToChannel(samples, 0);
  const source = live.ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(live.ctx.destination);
  const startAt = Math.max(live.ctx.currentTime + 0.02, live.nextTime);
  source.start(startAt);
  live.nextTime = startAt + buffer.duration;
  live.playing.add(source);
  source.onended = () => {
    live?.playing.delete(source);
    if (live && live.playing.size === 0 && live.turnDone) {
      live.turnDone = false;
      if (!live.muted) setState('listening');
    }
  };
}

function stopPlayback() {
  if (!live) return;
  for (const source of live.playing) {
    source.onended = null;
    try {
      source.stop();
    } catch {
      // déjà arrêtée
    }
  }
  live.playing.clear();
  live.nextTime = 0;
}

// ---------------------------------------------------------------- messages de Gemini Live
async function handleToolCall(toolCall) {
  setState('tool');
  const responses = [];
  for (const call of toolCall.functionCalls ?? []) {
    let response = { error: 'Outil indisponible pour le moment.' };
    try {
      const result = await authedFetch('chat-tools', { tool: call.name, args: call.args ?? {} });
      if (result.ok) {
        response = { output: result.result };
        renderCards(result.cards);
      }
    } catch {
      // réponse d'erreur ci-dessus : le modèle l'annonce simplement à l'utilisateur
    }
    responses.push({ id: call.id, name: call.name, response });
  }
  if (live) {
    live.session.sendToolResponse({ functionResponses: responses });
    setState('thinking');
  }
}

function handleMessage(message) {
  if (!live) return;
  const now = performance.now();
  if (message.setupComplete) {
    setState('listening');
  }
  const content = message.serverContent;
  if (content) {
    if (content.interrupted) {
      stopPlayback();
      live.turnDone = false;
      live.botLine = null;
      const delay = live.tracker.interrupted(now);
      if (delay !== null) el.interrupt.textContent = `${Math.round(delay)} ms`;
      if (!live.muted) setState('listening');
    }
    if (content.inputTranscription?.text) {
      if (live.botLine) live.botLine = null; // nouvelle phrase de ma part : la prochaine réponse ouvre une nouvelle ligne
      appendCaption('user', content.inputTranscription.text);
      live.lastActivity = Date.now();
    }
    if (content.outputTranscription?.text) {
      live.userLine = null;
      appendCaption('bot', content.outputTranscription.text);
    }
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) {
        const latency = live.tracker.botAudio(now);
        if (latency !== null) {
          el.latency.textContent = `${Math.round(latency)} ms`;
          el.median.textContent = `${Math.round(median(live.tracker.latencies))} ms (${live.tracker.latencies.length} mesures)`;
        }
        live.lastActivity = Date.now();
        playChunk(part.inlineData.data);
        setState('speaking');
      }
    }
    if (content.turnComplete) {
      live.turnDone = true;
      live.userLine = null;
      if (live.playing.size === 0 && !live.muted) setState('listening');
    }
  }
  if (message.toolCall) void handleToolCall(message.toolCall);
  if (message.usageMetadata) {
    // Un relevé par tour de parole (pas des totaux cumulés) : on les additionne et on garde la liste pour comparer à la facture de Google.
    live.usages.push(message.usageMetadata);
    const total = summarizeUsage(live.usages);
    live.inputTokens = total.inputTokens;
    live.outputTokens = total.outputTokens;
    el.tokens.textContent = `${total.inputTokens} / ${total.outputTokens}`;
    el.cost.textContent = `${estimateCostUsd(total.inputTokens, total.outputTokens).toFixed(4)} $`;
    el.debug.hidden = false;
    el.debug.textContent = `${total.turns} relevé(s) de Google · entrée : texte ${total.textIn}, audio ${total.audioIn} · sortie : audio ${total.audioOut}, réflexion ${total.thoughts}\n` + live.usages.map((u, i) => `#${i + 1} ${JSON.stringify(u)}`).join('\n');
  }
  if (message.goAway) showError('Google va fermer la connexion bientôt (durée maximale atteinte).');
}

// ---------------------------------------------------------------- session
async function startSession() {
  if (live) return;
  showError('');
  el.captions.replaceChildren();
  el.cards.replaceChildren();
  for (const field of [el.latency, el.median, el.interrupt, el.tokens, el.cost, el.duration]) field.textContent = '—';
  el.debug.hidden = true;
  setState('connecting');
  el.start.hidden = true;

  // Le contexte audio doit être créé pendant le geste de l'utilisateur (règle de Safari sur iPhone).
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  void ctx.resume();

  let stream = null;
  try {
    const token = await authedFetch('chat-live-token', { voice: el.voice.value });
    if (!token.ok) throw new Error(liveErrorMessage(token));
    el.meta.textContent = `Modèle : ${token.model} · Rôle : ${token.role} · Voix : ${token.voice}`;

    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    await ctx.audioWorklet.addModule('mic-worklet.js');
    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'mic-processor');
    source.connect(node);

    live = { ctx, stream, node, session: null, sessionId: token.sessionId, maxSeconds: token.maxSeconds, startedAt: Date.now(), lastActivity: Date.now(), muted: false, playing: new Set(), nextTime: 0, turnDone: false, userLine: null, botLine: null, inputTokens: 0, outputTokens: 0, usages: [], tracker: new FluencyTracker(), ended: false };

    const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: 'v1alpha' } });
    const current = live;
    current.session = await ai.live.connect({
      model: token.model,
      // Les modèles Live de la famille 3 exigent un niveau de réflexion (le serveur l'indique ; il est aussi verrouillé dans le jeton).
      config: { responseModalities: [Modality.AUDIO], ...(token.thinkingLevel ? { thinkingConfig: { thinkingLevel: token.thinkingLevel } } : {}) },
      callbacks: {
        onopen: () => {},
        onmessage: handleMessage,
        onerror: (event) => {
          showError(`Connexion interrompue (${String(event?.message ?? 'erreur réseau').slice(0, 120)}).`);
          void endSession('error');
        },
        onclose: () => {
          if (live === current && !current.ended) void endSession('closed');
        },
      },
    });

    node.port.onmessage = (event) => {
      if (!live || live.muted) return;
      const block = event.data;
      const level = rmsLevel(block);
      el.orb.style.setProperty('--level', String(level));
      const speaking = live.playing.size > 0;
      live.tracker.mic(level, performance.now(), speaking);
      if (level > live.tracker.threshold) live.lastActivity = Date.now();
      live.session.sendRealtimeInput({ audio: { data: int16ToBase64(resampleToPcm16(block, ctx.sampleRate, MIC_RATE)), mimeType: `audio/pcm;rate=${MIC_RATE}` } });
    };

    el.mute.hidden = false;
    el.stop.hidden = false;
    el.timer.hidden = false;
    live.tick = setInterval(() => {
      if (!live) return;
      const elapsed = (Date.now() - live.startedAt) / 1000;
      el.timer.textContent = `${formatClock(elapsed)} / ${formatClock(live.maxSeconds)}`;
      el.duration.textContent = formatClock(elapsed);
      if (elapsed >= live.maxSeconds) void endSession('time_limit');
      else if (Date.now() - live.lastActivity > SILENCE_CUTOFF_MS) void endSession('silence');
    }, 500);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Impossible de démarrer.');
    if (live) await endSession('error');
    else {
      stream?.getTracks().forEach((track) => track.stop());
      void ctx.close().catch(() => undefined);
      el.start.hidden = false;
    }
    setState('error');
  }
}

async function endSession(reason) {
  const session = live;
  if (!session || session.ended) return;
  session.ended = true;
  clearInterval(session.tick);
  stopPlayback();
  try {
    session.session?.close();
  } catch {
    // déjà fermée
  }
  session.node.port.onmessage = null;
  session.stream.getTracks().forEach((track) => track.stop());
  void session.ctx.close().catch(() => undefined);
  live = null;

  const seconds = Math.round((Date.now() - session.startedAt) / 1000);
  el.duration.textContent = formatClock(seconds);
  el.mute.hidden = true;
  el.stop.hidden = true;
  el.timer.hidden = true;
  el.start.hidden = false;
  el.orb.style.setProperty('--level', '0');
  setState('ended');
  const labels = { silence: 'Session terminée après 30 s de silence.', time_limit: 'Durée maximale de la session atteinte.', closed: 'Connexion fermée.' };
  if (labels[reason]) showError(labels[reason]);

  // Clôture côté serveur : durée et tokens, pour les limites de minutes et le coût.
  const result = await authedFetch('chat-live-token', { action: 'end', sessionId: session.sessionId, seconds, inputTokens: session.inputTokens, outputTokens: session.outputTokens, reason }).catch(() => null);
  if (result?.ok) el.cost.textContent = `${estimateCostUsd(session.inputTokens, session.outputTokens).toFixed(4)} $`;
}

el.start.addEventListener('click', () => void startSession());
el.stop.addEventListener('click', () => void endSession('user'));
el.mute.addEventListener('click', () => {
  if (!live) return;
  live.muted = !live.muted;
  el.mute.setAttribute('aria-pressed', String(live.muted));
  el.mute.textContent = live.muted ? 'Activer le micro' : 'Couper le micro';
  if (live.muted) live.session.sendRealtimeInput({ audioStreamEnd: true });
  setState(live.muted ? 'muted' : live.playing.size > 0 ? 'speaking' : 'listening');
});
