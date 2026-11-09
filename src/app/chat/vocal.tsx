import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Palette } from '@/constants/theme';
import { DataCardView } from '@/features/chat/chat-bubble';
import { LIVE_VOICES } from '@/features/chat/live/api';
import { EngineView, type EngineHandle } from '@/features/chat/live/engine-view';
import type { EngineCommand } from '@/features/chat/live/protocol';
import { displayPhase, type LiveFailure, type LivePhase } from '@/features/chat/live/state';
import { useLiveSession } from '@/features/chat/live/use-live-session';
import type { ChatCardItem } from '@/features/chat/types';
import { formatDuration } from '@/features/chat/voice-utils';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

const KEEP_AWAKE_TAG = 'bibip-live-voice';
const VOICE_KEY = 'bibip.chat.live.voice.v1';
const CAPTIONS_KEY = 'bibip.chat.live.captions.v1';

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** Message clair pour chaque panne (jamais de texte technique). */
function failureKey(failure: LiveFailure, limitReason: string | null): string {
  switch (failure) {
    case 'mic_denied':
      return 'chat.voice.permBody';
    case 'mic_unavailable':
      return 'chat.live.errors.micUnavailable';
    case 'connect_failed':
      return 'chat.live.errors.connect';
    case 'closed':
      return 'chat.live.errors.closed';
    case 'live_limit':
      return limitReason === 'agency_daily' ? 'chat.live.errors.limitAgency' : 'chat.live.errors.limitUser';
    case 'not_configured':
    case 'disabled':
      return 'chat.errors.inactive';
    case 'engine':
      return 'chat.live.errors.engine';
    case 'timeout':
      return 'chat.errors.timeout';
    default:
      return 'chat.live.errors.unavailable';
  }
}

/** Vrai quand `active` dure depuis plus de `delay` ms : « BIBIP réfléchit » ne s'affiche qu'au-delà de 600 ms. */
function useDelayedFlag(active: boolean, delay: number): boolean {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    if (!active) {
      const reset = setTimeout(() => setFlag(false), 0);
      return () => clearTimeout(reset);
    }
    const timer = setTimeout(() => setFlag(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);
  return flag;
}

/**
 * Mode vocal temps réel : une vraie conversation à voix haute avec BIBIP, sans bouton Envoyer. BIBIP répond presque tout de suite,
 * on peut l'interrompre en parlant, il consulte les données de l'agence (mêmes outils et règles que le chat écrit) et toute la
 * conversation est enregistrée dans l'historique. Le moteur audio tourne dans une fenêtre web interne invisible (Expo Go).
 */
export default function VoiceLiveScreen() {
  const { t } = useLanguage();
  const { conversation: existingConversation } = useLocalSearchParams<{ conversation?: string }>();
  const reduceMotion = useReducedMotion();

  const [voice, setVoice] = useState<string>(LIVE_VOICES[0]);
  const [captionsOn, setCaptionsOn] = useState(true);
  const prefsLoaded = useRef(false);
  // Les préférences (voix, sous-titres) sont lues avant le démarrage : la session utilise la voix choisie.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([AsyncStorage.getItem(VOICE_KEY), AsyncStorage.getItem(CAPTIONS_KEY)])
      .then(([savedVoice, savedCaptions]) => {
        if (!alive) return;
        if (savedVoice && (LIVE_VOICES as readonly string[]).includes(savedVoice)) setVoice(savedVoice);
        if (savedCaptions !== null) setCaptionsOn(savedCaptions === '1');
      })
      .catch(() => undefined)
      .finally(() => {
        prefsLoaded.current = true;
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: Brand.graphite }} />;
  return <LiveBody key="live" t={t} existing={existingConversation ?? null} voice={voice} setVoice={setVoice} captionsOn={captionsOn} setCaptionsOn={setCaptionsOn} reduceMotion={reduceMotion} />;
}

function LiveBody({ t, existing, voice, setVoice, captionsOn, setCaptionsOn, reduceMotion }: { t: (key: string, options?: Record<string, unknown>) => string; existing: string | null; voice: string; setVoice: (voice: string) => void; captionsOn: boolean; setCaptionsOn: (on: boolean) => void; reduceMotion: boolean }) {
  const engine = useRef<EngineHandle>(null);
  const send = useCallback((command: EngineCommand) => engine.current?.send(command), []);
  const session = useLiveSession({ existingConversationId: existing, voice, send });
  const { state } = session;
  const phase: LivePhase = displayPhase(state);
  const slowThinking = useDelayedFlag(phase === 'thinking', 600);
  const scroll = useRef<ScrollViewInstance>(null);

  const active = phase === 'listening' || phase === 'thinking' || phase === 'tool' || phase === 'speaking' || phase === 'muted';
  const finished = phase === 'error' || phase === 'ended';

  // L'écran reste allumé tant que la session est ouverte (connexion comprise) : on ne touche pas l'écran en parlant, il se
  // verrouillerait sinon au bout du délai de verrouillage automatique du téléphone et couperait la conversation.
  const keepAwake = !finished;
  useEffect(() => {
    if (!keepAwake) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [keepAwake]);

  // ---- Orbe : pulse au rythme du volume (voix de l'utilisateur ou de BIBIP), respiration lente pendant la connexion et la réflexion
  const pulse = useSharedValue(0);
  const breathe = phase === 'connecting' || phase === 'tool' || (phase === 'thinking' && slowThinking);
  useEffect(() => {
    cancelAnimation(pulse);
    if (reduceMotion) {
      pulse.value = 0;
      return;
    }
    if (breathe) pulse.value = withRepeat(withSequence(withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(0.1, { duration: 700, easing: Easing.inOut(Easing.quad) })), -1);
    else if (phase === 'listening') pulse.value = withTiming(state.micLevel, { duration: 90 });
    else if (phase === 'speaking') pulse.value = withTiming(state.botLevel, { duration: 90 });
    else pulse.value = withTiming(0, { duration: 200 });
  }, [phase, breathe, state.micLevel, state.botLevel, reduceMotion, pulse]);
  const ring1 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.1 }] }));
  const ring2 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.18 }] }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.12 }] }));

  const speaking = phase === 'speaking';
  const coreColor = speaking ? Brand.orangeLight : phase === 'listening' || phase === 'thinking' || phase === 'tool' ? Brand.orange : Brand.strokeOnDark;
  const ringColor = speaking ? Brand.orangeLight : phase === 'listening' ? Brand.orange : Brand.borderOnDark;
  const status = {
    connecting: t('chat.live.connecting'),
    listening: t('chat.voice.listening'),
    thinking: slowThinking ? t('chat.live.thinking') : t('chat.voice.listening'),
    tool: t('chat.live.tool'),
    speaking: t('chat.voice.speaking'),
    muted: t('chat.live.muted'),
    error: t('chat.live.ended'),
    ended: t('chat.live.ended'),
  }[phase];

  const lines = state.lines.slice(-4);
  const lastAssistant = [...state.lines].reverse().find((line) => line.role === 'assistant');
  useEffect(() => {
    const timer = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [state.lines]);

  // ---- Navigation : on termine toujours la session (enregistrée dans l'historique) avant de quitter l'écran.
  const goToConversation = useCallback(
    async (replace: boolean) => {
      const saved = await session.stop('user');
      if (replace && (saved || session.saved)) router.replace({ pathname: '/chat/[id]', params: { id: session.conversationId } });
      else if (!replace && !saved && !session.saved) router.replace({ pathname: '/chat/[id]', params: { id: 'nouveau' } });
      else router.back();
    },
    [session]
  );
  const close = async () => {
    const saved = await session.stop('user');
    if (existing || !(saved || session.saved)) router.back();
    else router.replace({ pathname: '/chat/[id]', params: { id: session.conversationId } });
  };
  const toWritten = async () => {
    const saved = await session.stop('user');
    router.replace({ pathname: '/chat/[id]', params: { id: saved || session.saved || existing ? session.conversationId : 'nouveau' } });
  };
  const openItem = async (item: ChatCardItem) => {
    await session.stop('user');
    if (item.kind === 'vehicle') router.push({ pathname: '/locations/nouveau', params: { vehicleId: item.id, date: todayKey() } });
    else router.push({ pathname: '/locations/[id]', params: { id: item.id } });
  };

  const cycleVoice = () => {
    const next = LIVE_VOICES[(LIVE_VOICES.indexOf(voice as (typeof LIVE_VOICES)[number]) + 1) % LIVE_VOICES.length];
    setVoice(next);
    AsyncStorage.setItem(VOICE_KEY, next).catch(() => undefined);
    // Nouvelle voix : la session redémarre avec elle (les phrases déjà dites sont enregistrées).
    if (active || finished) void session.restart(next);
  };
  const toggleCaptions = () => {
    const next = !captionsOn;
    setCaptionsOn(next);
    AsyncStorage.setItem(CAPTIONS_KEY, next ? '1' : '0').catch(() => undefined);
  };

  const circle = { width: 56, height: 56, borderRadius: 28, backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark, alignItems: 'center' as const, justifyContent: 'center' as const };
  const micDenied = state.failure === 'mic_denied';
  const endedNote = session.endedReason === 'silence' ? t('chat.live.silenceEnded') : session.endedReason === 'time_limit' ? t('chat.live.timeEnded') : null;

  return (
    <View style={{ flex: 1, backgroundColor: Brand.graphite }}>
      <StatusBar style="light" />
      {/* Moteur audio : fenêtre web interne invisible */}
      <EngineView ref={engine} interactive={state.gestureNeeded} onMessage={session.onEngineMessage} onLoadError={session.onLoadError} />
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 12 }} edges={['top', 'left', 'right', 'bottom']} pointerEvents={state.gestureNeeded ? 'none' : 'auto'}>
        {/* Haut */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
          <Pressable onPress={() => void close()} accessibilityRole="button" accessibilityLabel={t('chat.voice.close')} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.strokeOnDark, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={18} color={Brand.white} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <MicroLabel size={11} track={0.16} color={Brand.mutedOnDark}>
              {t('chat.voice.title')}
            </MicroLabel>
            {active ? (
              <HText size={12} color={Brand.mutedOnDark}>
                {formatDuration(session.elapsed * 1000)} / {formatDuration(session.maxSeconds * 1000)}
              </HText>
            ) : null}
          </View>
          <Pressable onPress={cycleVoice} accessibilityRole="button" accessibilityLabel={t('chat.live.voiceA11y', { voice })} style={{ height: 36, borderRadius: 18, borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: Brand.surfaceOnDark, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="volume-medium-outline" size={14} color={Brand.white} />
            <HText weight="semibold" size={12} color={Brand.white}>
              {voice}
            </HText>
          </Pressable>
        </View>

        <ScrollView ref={scroll} contentContainerStyle={{ alignItems: 'center', paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {micDenied ? (
            <View style={{ marginTop: 56, alignItems: 'center', gap: 14, paddingHorizontal: 16 }}>
              <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: Brand.orangeDeep, borderWidth: 2, borderColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="mic-off-outline" size={40} color={Brand.orangeLight} />
              </View>
              <HText font="display" weight="semibold" size={22} color={Brand.white} style={{ textAlign: 'center' }}>
                {t('chat.voice.permTitle')}
              </HText>
              <HText size={14} color={Brand.mutedOnDark} style={{ textAlign: 'center' }}>
                {t('chat.voice.permBlocked')}
              </HText>
              <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button" style={{ minHeight: 48, borderRadius: 24, backgroundColor: Brand.orange, paddingHorizontal: 24, justifyContent: 'center' }}>
                <HText weight="semibold" size={15} color={Brand.white}>
                  {t('chat.voice.openSettings')}
                </HText>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Orbe */}
              <View accessible accessibilityLabel={status} style={{ marginTop: 28, width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={[{ position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: speaking ? 2 : 1, borderColor: ringColor }, ring2]} />
                <Animated.View style={[{ position: 'absolute', width: 172, height: 172, borderRadius: 86, borderWidth: 1, borderColor: speaking ? Brand.orangeLight : Brand.strokeOnDark }, ring1]} />
                <View style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: Brand.orangeDeep, borderWidth: 2, borderColor: coreColor, alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={[{ width: 88, height: 88, borderRadius: 44, backgroundColor: coreColor, alignItems: 'center', justifyContent: 'center' }, core]}>
                    <Ionicons name={phase === 'muted' ? 'mic-off-outline' : speaking ? 'volume-high-outline' : 'mic-outline'} size={34} color={Brand.white} />
                  </Animated.View>
                </View>
              </View>

              {/* État */}
              <View accessibilityLiveRegion="polite" style={{ marginTop: 14, alignItems: 'center', gap: 6 }}>
                <HText font="display" weight="semibold" size={24} color={Brand.white}>
                  {status}
                </HText>
                {active && phase !== 'muted' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.successOnDark }} />
                    <HText size={12} color={Brand.mutedOnDark}>
                      {t('chat.live.micActive')}
                    </HText>
                  </View>
                ) : null}
                {state.gestureNeeded ? (
                  <HText size={13} color={Brand.orangeLight} style={{ marginTop: 4 }}>
                    {t('chat.live.tapToEnable')}
                  </HText>
                ) : null}
              </View>

              {state.failure ? (
                <HText size={13} color={Brand.errorOnDark} style={{ marginTop: 12, textAlign: 'center' }}>
                  {t(failureKey(state.failure, session.limitReason))}
                </HText>
              ) : endedNote ? (
                <HText size={13} color={Brand.mutedOnDark} style={{ marginTop: 12, textAlign: 'center' }}>
                  {endedNote}
                </HText>
              ) : null}

              {/* Sous-titres en direct */}
              {captionsOn ? (
                <View style={{ marginTop: 18, width: '100%', backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.borderOnDark, borderRadius: 20, padding: 16, gap: 10 }}>
                  <MicroLabel size={10} track={0.16} color={Brand.mutedOnDark}>
                    {t('chat.live.captions')}
                  </MicroLabel>
                  {lines.length === 0 ? (
                    <HText size={15} color={Brand.mutedOnDark}>
                      {t('chat.live.captionsEmpty')}
                    </HText>
                  ) : (
                    lines.map((line, index) => {
                      const current = index >= lines.length - 2;
                      return (
                        <HText key={line.id} size={line.role === 'user' ? 17 : 16} weight={line.role === 'user' ? 'medium' : 'regular'} color={current ? (line.role === 'user' ? Brand.white : '#F4F5F5') : Brand.mutedOnDark} style={{ lineHeight: 24, writingDirection: 'auto' }}>
                          {line.text}
                        </HText>
                      );
                    })
                  )}
                </View>
              ) : null}

              {/* Cartes de données : glissent depuis le bas quand BIBIP donne des voitures ou des locations */}
              {lastAssistant && lastAssistant.cards.length > 0 ? (
                <Animated.View key={lastAssistant.id} entering={reduceMotion ? undefined : FadeInDown.duration(320)} style={{ marginTop: 12, width: '100%', gap: 8 }}>
                  {lastAssistant.cards.map((card, index) => (
                    <DataCardView key={index} card={card} onOpen={(item) => void openItem(item)} />
                  ))}
                </Animated.View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* Commandes */}
        <View style={{ gap: 14 }}>
          {finished ? (
            <View style={{ gap: 10 }}>
              <Pressable onPress={() => void session.restart(voice)} accessibilityRole="button" style={{ minHeight: 52, borderRadius: 26, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
                <HText weight="semibold" size={16} color={Brand.white}>
                  {t(state.failure ? 'chat.live.retry' : 'chat.live.resume')}
                </HText>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => void toWritten()} accessibilityRole="button" style={{ flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: Brand.strokeOnDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                  <HText weight="semibold" size={13} color={Brand.white} style={{ textAlign: 'center' }}>
                    {t('chat.live.toWritten')}
                  </HText>
                </Pressable>
                {state.failure ? (
                  <Pressable onPress={() => router.replace({ pathname: '/chat/vocal-turns', params: existing ? { conversation: existing } : {} })} accessibilityRole="button" style={{ flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: Brand.strokeOnDark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                    <HText weight="semibold" size={13} color={Brand.white} style={{ textAlign: 'center' }}>
                      {t('chat.live.simpleMode')}
                    </HText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Pressable onPress={() => session.mute(!state.muted)} disabled={!active} accessibilityRole="button" accessibilityState={{ selected: state.muted }} accessibilityLabel={t(state.muted ? 'chat.live.unmute' : 'chat.live.mute')} style={[circle, { opacity: active ? 1 : 0.4, backgroundColor: state.muted ? Brand.white : Brand.surfaceOnDark }]}>
                  <Ionicons name={state.muted ? 'mic-off' : 'mic-outline'} size={22} color={state.muted ? Brand.graphite : Brand.white} />
                </Pressable>
              </View>
              <Pressable onPress={() => void goToConversation(true)} accessibilityRole="button" accessibilityLabel={t('chat.live.end')} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#C42B4B', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="call" size={26} color={Brand.white} style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
              <Pressable onPress={() => void toWritten()} accessibilityRole="button" accessibilityLabel={t('chat.live.toWritten')} style={circle}>
                <Ionicons name="create-outline" size={22} color={Brand.white} />
              </Pressable>
            </View>
          )}
          <Pressable onPress={toggleCaptions} accessibilityRole="switch" accessibilityState={{ checked: captionsOn }} accessibilityLabel={t(captionsOn ? 'chat.live.captionsHide' : 'chat.live.captionsShow')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name={captionsOn ? 'chatbox-ellipses' : 'chatbox-ellipses-outline'} size={16} color={Palette.textMuted} />
            <HText size={12} color={Brand.mutedOnDark}>
              {t('chat.live.captions')} · {captionsOn ? 'ON' : 'OFF'}
            </HText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
