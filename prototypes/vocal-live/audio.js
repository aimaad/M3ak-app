// Fonctions pures du prototype vocal temps réel (testées avec Jest) : conversion audio, latence, coût. Sans DOM ni réseau.

export const MIC_RATE = 16000; // Gemini Live reçoit du PCM 16 bits mono à 16 kHz
export const OUT_RATE = 24000; // et renvoie du PCM 16 bits mono à 24 kHz

/** Tarif audio de Gemini Live (USD par million de tokens), appliqué à tous les tokens : estimation haute. */
export const PRICE_PER_MILLION = { input: 3, output: 12 };

export function estimateCostUsd(inputTokens, outputTokens) {
  const cost = (Math.max(0, inputTokens) * PRICE_PER_MILLION.input + Math.max(0, outputTokens) * PRICE_PER_MILLION.output) / 1_000_000;
  return Math.round(cost * 10_000) / 10_000;
}

/** Micro (Float32 à la fréquence du téléphone, ex. 48 kHz) → PCM 16 bits à `targetRate`, par moyenne des échantillons (anti-repliement simple). */
export function resampleToPcm16(input, inputRate, targetRate = MIC_RATE) {
  if (!input.length) return new Int16Array(0);
  const ratio = inputRate / targetRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    out[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return out;
}

export function pcm16ToFloat32(pcm) {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff);
  return out;
}

export function int16ToBase64(pcm) {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length - (binary.length % 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

/** Niveau du micro entre 0 et 1 (racine de la moyenne des carrés, un peu amplifiée pour l'affichage). */
export function rmsLevel(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

/**
 * Mesures de fluidité :
 *  - latence : de la FIN de ma voix (dernier moment où le micro dépasse le seuil, avant une pause de 300 ms) au premier son de BIBIP ;
 *  - interruption : du DÉBUT de ma parole, pendant que BIBIP parle, à l'arrêt effectif de sa voix.
 * Le temps est fourni par l'appelant (ms), ce qui rend la classe testable.
 */
export class FluencyTracker {
  constructor(threshold = 0.12, pauseMs = 300) {
    this.threshold = threshold;
    this.pauseMs = pauseMs;
    this.speaking = false;
    this.speechStart = null;
    this.lastVoice = null;
    this.endedAt = null;
    this.speechStartedWhilePlaying = false;
    this.latencies = [];
    this.interruptions = [];
  }

  /** À chaque mesure du micro. `botPlaying` : la voix de BIBIP est en cours de lecture. */
  mic(level, now, botPlaying = false) {
    if (level > this.threshold) {
      if (!this.speaking) {
        this.speaking = true;
        this.speechStart = now;
        this.speechStartedWhilePlaying = botPlaying;
        this.endedAt = null;
      }
      this.lastVoice = now;
    } else if (this.speaking && now - this.lastVoice >= this.pauseMs) {
      this.speaking = false;
      this.endedAt = this.lastVoice;
    }
  }

  /** Premier son de BIBIP : rend la latence en ms (ou null si ce n'est pas la réponse à une phrase de l'utilisateur). */
  botAudio(now) {
    if (this.endedAt === null) return null;
    const latency = Math.max(0, now - this.endedAt);
    this.endedAt = null;
    this.latencies.push(latency);
    return latency;
  }

  /** La voix de BIBIP vient d'être coupée : rend le délai d'interruption en ms (ou null). */
  interrupted(now) {
    if (this.speechStart === null || !this.speechStartedWhilePlaying) return null;
    const delay = Math.max(0, now - this.speechStart);
    this.speechStart = null;
    this.speechStartedWhilePlaying = false;
    this.interruptions.push(delay);
    return delay;
  }
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Message clair pour une erreur renvoyée par chat-live-token. */
export function liveErrorMessage(body) {
  switch (body?.error) {
    case 'not_authenticated':
      return 'Session expirée ou compte sans agence : reconnectez-vous.';
    case 'ocr_not_configured':
      return "Aucune clé Gemini n'est enregistrée pour votre agence (console d'administration).";
    case 'chat_disabled':
      return "Le chat n'est pas activé pour votre agence (réglage du propriétaire dans l'app).";
    case 'live_limit':
      return body.reason === 'agency_daily' ? "Limite de minutes de l'agence atteinte pour aujourd'hui." : "Votre limite de minutes est atteinte pour aujourd'hui.";
    case 'live_unavailable':
      return body.detail === 'migration_0064_missing'
        ? 'La migration 0064 n’est pas appliquée dans Supabase.'
        : body.detail === 'no_live_model'
          ? "Aucun modèle Live n'est disponible avec la clé de cette agence."
          : `Mode vocal indisponible (${String(body.detail ?? 'erreur').slice(0, 120)}).`;
    default:
      return 'Impossible de démarrer le mode vocal.';
  }
}
