// Moteur vocal temps réel de BIBIP, SANS interface. Il tourne dans une fenêtre web interne de l'app mobile (fonctionne dans Expo Go) :
// micro en continu (annulation d'écho du navigateur), voix de BIBIP en continu, connexion directe à Gemini Live avec un jeton éphémère.
//
// L'app gère tout le reste : connexion de l'utilisateur, jeton, outils (ses droits), sous-titres, historique, écran.
// Échanges (JSON) :
//   app → moteur : {t:'start', token, model, voice, thinkingLevel} · {t:'mute', on} · {t:'stop'} · {t:'tool', id, name, response} · {t:'resume'}
//   moteur → app : {t:'ready'} · {t:'state', s} · {t:'level', mic, bot} · {t:'user', text} · {t:'bot', text} · {t:'turn'} · {t:'interrupted', ms}
//                  {t:'latency', ms} · {t:'toolcall', id, name, args} · {t:'usage', usage} · {t:'goaway'} · {t:'needs_gesture'} · {t:'gesture_ok'}
//                  {t:'error', code, message} · {t:'ended', reason}
// La clé de l'entreprise n'est jamais ici ; l'audio n'est pas enregistré.

import { GoogleGenAI, Modality } from 'https://esm.sh/@google/genai@3.0.0';

import { base64ToInt16, FluencyTracker, int16ToBase64, MIC_RATE, OUT_RATE, pcm16ToFloat32, resampleToPcm16, rmsLevel } from './audio.js';

const post = (message) => {
  const text = JSON.stringify(message);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
  else console.log('[moteur]', text);
};

let live = null; // session en cours

function setState(state) {
  if (live && live.state !== state) {
    live.state = state;
    post({ t: 'state', s: state });
  }
}

// ---------------------------------------------------------------- voix de BIBIP (PCM 24 kHz en continu)
function playChunk(base64) {
  const pcm = base64ToInt16(base64);
  if (!pcm.length) return;
  const samples = pcm16ToFloat32(pcm);
  const buffer = live.ctx.createBuffer(1, samples.length, OUT_RATE);
  buffer.copyToChannel(samples, 0);
  const source = live.ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(live.analyser);
  const startAt = Math.max(live.ctx.currentTime + 0.02, live.nextTime);
  source.start(startAt);
  live.nextTime = startAt + buffer.duration;
  live.playing.add(source);
  source.onended = () => {
    live?.playing.delete(source);
    if (live && live.playing.size === 0 && live.turnDone) {
      live.turnDone = false;
      setState('listening');
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
function onServerMessage(message) {
  if (!live) return;
  const now = performance.now();
  if (message.setupComplete) setState('listening');
  const content = message.serverContent;
  if (content) {
    if (content.interrupted) {
      stopPlayback();
      live.turnDone = false;
      post({ t: 'interrupted', ms: live.tracker.interrupted(now) });
      setState('listening');
    }
    if (content.inputTranscription?.text) post({ t: 'user', text: content.inputTranscription.text });
    if (content.outputTranscription?.text) post({ t: 'bot', text: content.outputTranscription.text });
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) {
        const latency = live.tracker.botAudio(now);
        if (latency !== null) post({ t: 'latency', ms: Math.round(latency) });
        playChunk(part.inlineData.data);
        setState('speaking');
      }
    }
    if (content.turnComplete) {
      post({ t: 'turn' });
      live.turnDone = true;
      if (live.playing.size === 0) {
        live.turnDone = false;
        setState('listening');
      }
    }
  }
  if (message.toolCall) {
    setState('tool');
    for (const call of message.toolCall.functionCalls ?? []) post({ t: 'toolcall', id: call.id, name: call.name, args: call.args ?? {} });
  }
  if (message.usageMetadata) post({ t: 'usage', usage: message.usageMetadata });
  if (message.goAway) post({ t: 'goaway' });
}

// ---------------------------------------------------------------- session
async function start(command) {
  if (live) return;
  setStateEarly('connecting');

  // Contexte audio créé tout de suite (règle des navigateurs : il doit démarrer pendant un geste, ou avec l'autorisation de lecture automatique).
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  void ctx.resume().catch(() => undefined);

  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  } catch (error) {
    void ctx.close().catch(() => undefined);
    post({ t: 'error', code: error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'mic_denied' : 'mic_unavailable', message: String(error?.message ?? error).slice(0, 160) });
    return;
  }

  try {
    await ctx.audioWorklet.addModule('mic-worklet.js');
    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'mic-processor');
    source.connect(node);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.connect(ctx.destination);

    const current = { ctx, stream, node, analyser, session: null, muted: false, playing: new Set(), nextTime: 0, turnDone: false, state: 'connecting', tracker: new FluencyTracker(), ended: false, micLevel: 0 };
    live = current;

    // Démarrage bloqué (lecture automatique refusée) : l'app affiche « Touchez pour activer » ; un toucher dans la fenêtre débloque.
    if (ctx.state !== 'running') {
      post({ t: 'needs_gesture' });
      const unlock = () => {
        void ctx.resume().then(() => post({ t: 'gesture_ok' }));
        window.removeEventListener('pointerdown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
    }

    const ai = new GoogleGenAI({ apiKey: command.token, httpOptions: { apiVersion: 'v1alpha' } });
    current.session = await ai.live.connect({
      model: command.model,
      config: { responseModalities: [Modality.AUDIO], ...(command.thinkingLevel ? { thinkingConfig: { thinkingLevel: command.thinkingLevel } } : {}) },
      callbacks: {
        onopen: () => {},
        onmessage: onServerMessage,
        onerror: (event) => {
          post({ t: 'error', code: 'connect_failed', message: String(event?.message ?? 'erreur réseau').slice(0, 160) });
          stop('error');
        },
        onclose: (event) => {
          if (live === current && !current.ended) {
            post({ t: 'error', code: 'closed', message: String(event?.reason ?? '').slice(0, 160) });
            stop('closed');
          }
        },
      },
    });

    node.port.onmessage = (event) => {
      if (!live || live.muted) return;
      const block = event.data;
      live.micLevel = rmsLevel(block);
      live.tracker.mic(live.micLevel, performance.now(), live.playing.size > 0);
      live.session.sendRealtimeInput({ audio: { data: int16ToBase64(resampleToPcm16(block, ctx.sampleRate, MIC_RATE)), mimeType: `audio/pcm;rate=${MIC_RATE}` } });
    };

    // Niveaux pour l'orbe de l'app : micro et voix de BIBIP, environ 12 fois par seconde.
    const buffer = new Float32Array(analyser.fftSize);
    current.levelTimer = setInterval(() => {
      if (!live) return;
      analyser.getFloatTimeDomainData(buffer);
      post({ t: 'level', mic: live.muted ? 0 : Math.round(live.micLevel * 100) / 100, bot: live.playing.size > 0 ? Math.round(rmsLevel(buffer) * 100) / 100 : 0 });
      live.micLevel *= 0.6; // retombe vite quand le micro ne reçoit plus de bloc
    }, 80);
  } catch (error) {
    post({ t: 'error', code: 'connect_failed', message: String(error?.message ?? error).slice(0, 160) });
    stop('error');
    stream.getTracks().forEach((track) => track.stop());
    void ctx.close().catch(() => undefined);
  }
}

function setStateEarly(state) {
  post({ t: 'state', s: state });
}

function stop(reason) {
  const session = live;
  if (!session || session.ended) return;
  session.ended = true;
  clearInterval(session.levelTimer);
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
  post({ t: 'ended', reason });
}

// ---------------------------------------------------------------- commandes de l'app
function onNative(event) {
  let command;
  try {
    command = JSON.parse(event.data);
  } catch {
    return;
  }
  switch (command?.t) {
    case 'start':
      if (typeof command.token === 'string' && typeof command.model === 'string') void start(command);
      break;
    case 'stop':
      stop('user');
      break;
    case 'mute':
      if (live) {
        live.muted = command.on === true;
        if (live.muted) live.session?.sendRealtimeInput({ audioStreamEnd: true });
      }
      break;
    case 'tool':
      if (live && typeof command.id === 'string') {
        live.session.sendToolResponse({ functionResponses: [{ id: command.id, name: String(command.name ?? ''), response: command.response ?? { error: 'Outil indisponible.' } }] });
        setState('thinking');
      }
      break;
    case 'resume':
      if (live) void live.ctx.resume();
      break;
    default:
      break;
  }
}
window.addEventListener('message', onNative); // iOS
document.addEventListener('message', onNative); // Android

post({ t: 'ready' });
