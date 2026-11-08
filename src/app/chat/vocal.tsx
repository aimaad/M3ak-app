import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Palette } from '@/constants/theme';
import { useSession } from '@/features/auth/session-context';
import { chatErrorMessageKey, transcribeAudio, uploadVoiceMessage } from '@/features/chat/api';
import { useAskChat } from '@/features/chat/hooks';
import { Endpointer } from '@/features/chat/endpoint';
import { detectMessageLanguage } from '@/features/chat/language';
import { VoiceQueue } from '@/features/chat/natural-voice';
import { takeSentences } from '@/features/chat/stream';
import { makeTitle } from '@/features/chat/titles';
import { openMicrophoneSettings, useVoiceRecorder } from '@/features/chat/use-voice-recorder';
import { newId } from '@/features/chat/uuid';
import { audioContentType, audioExtension, formatDuration, MAX_RECORD_MS, MIN_RECORD_MS, pushLevel, voicePath, WAVE_BARS } from '@/features/chat/voice-utils';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

const SPEAK_KEY = 'bibip.chat.voice.speak.v1';
type Stage = 'idle' | 'listening' | 'paused' | 'transcribing' | 'thinking' | 'speaking' | 'error';
type Hint = 'auto' | 'darija' | 'fr';
const HINTS: Hint[] = ['auto', 'darija', 'fr'];

/**
 * Mode vocal plein écran : l'utilisateur parle, envoie, BIBIP transcrit (côté serveur), répond (lue à voix haute si
 * l'interrupteur est actif, en darija écrite en lettres arabes), puis l'écoute reprend. Le message vocal et la réponse sont ajoutés
 * à la conversation. Pas de texte en direct : la transcription apparaît après l'envoi.
 */
export default function VoiceModeScreen() {
  const { t, language } = useLanguage();
  const { session } = useSession();
  const { conversation: existingConversation } = useLocalSearchParams<{ conversation?: string }>();
  const recorder = useVoiceRecorder();
  const ask = useAskChat();
  const reduceMotion = useReducedMotion();

  const [stage, setStage] = useState<Stage>('idle');
  const [conversationId, setConversationId] = useState<string | null>(existingConversation ?? null);
  const [draftId] = useState(() => newId());
  const [hint, setHint] = useState<Hint>('auto');
  const [speakReplies, setSpeakReplies] = useState(true);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [permission, setPermission] = useState<'ok' | 'denied' | 'blocked'>('ok');
  const [levels, setLevels] = useState<number[]>(() => Array(WAVE_BARS).fill(0));
  const closed = useRef(false);
  // Lecture à voix naturelle, phrase par phrase ; `turn` change quand l'utilisateur interrompt BIBIP.
  const [voice] = useState(() => new VoiceQueue());
  const turn = useRef(0);
  // Détection de fin de phrase : un nouveau détecteur à chaque écoute.
  const endpointer = useRef(new Endpointer());

  useEffect(() => {
    AsyncStorage.getItem(SPEAK_KEY).then((v) => v !== null && setSpeakReplies(v === '1')).catch(() => undefined);
    return () => {
      closed.current = true;
      voice.stop();
    };
  }, [voice]);

  const startListening = useCallback(async () => {
    if (closed.current) return;
    setErrorKey(null);
    try {
      const result = await recorder.start();
      if (result !== 'ok') {
        setPermission(result);
        setStage('idle');
        return;
      }
      setPermission('ok');
      endpointer.current = new Endpointer();
      setLevels(Array(WAVE_BARS).fill(0));
      setStage('listening');
    } catch (error) {
      console.warn('Mode vocal : démarrage du micro impossible.', error instanceof Error ? error.message : error);
      setErrorKey('chat.errors.voiceFailed');
      setStage('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.start]);

  // Dès l'ouverture : on écoute.
  useEffect(() => {
    const timer = setTimeout(() => void startListening(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forme d'onde en temps réel.
  useEffect(() => {
    // Abonnement au niveau du micro (mis à jour ~12 fois par seconde par l'enregistreur) : le décalage de la forme d'onde.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stage === 'listening') setLevels((previous) => pushLevel(previous, recorder.level));
  }, [recorder.level, recorder.ms, stage]);

  const sendTurn = useCallback(async () => {
    if (stage !== 'listening' && stage !== 'paused') return;
    const file = await recorder.stop();
    if (!file || file.ms < MIN_RECORD_MS) {
      setErrorKey('chat.voice.tooShort');
      setStage('idle');
      return;
    }
    setStage('transcribing');
    setErrorKey(null);
    try {
      const userId = session?.user.id;
      if (!userId) throw new Error('no_session');
      const path = voicePath(userId, conversationId ?? draftId, audioExtension(file.uri));
      await uploadVoiceMessage(file.uri, path, audioContentType(file.uri));
      const text = await transcribeAudio({ audioPath: path, hint });
      if (closed.current) return;
      setTranscript(text);
      setReply(null);
      setStage('thinking');
      const myTurn = ++turn.current;
      // Voix par phrases : dès qu'une phrase du flux est terminée, elle est lue ; la suite se prépare pendant ce temps.
      let consumed = 0;
      let spokenPrefix = '';
      const feed = (text: string, final: boolean) => {
        if (!speakReplies || turn.current !== myTurn || detectMessageLanguage(text) === 'darija-latin') return;
        // Le serveur a recommencé la réponse (autre modèle) : on repart de zéro plutôt que de lire deux versions.
        if (!text.startsWith(spokenPrefix)) {
          voice.stop();
          consumed = 0;
        }
        const { sentences, next } = takeSentences(text, consumed, final);
        consumed = next;
        spokenPrefix = text.slice(0, consumed);
        if (sentences.length > 0) {
          sentences.forEach((sentence) => voice.enqueue(sentence));
          setStage('speaking');
        }
      };
      const answer = await ask.mutateAsync({
        message: text,
        conversationId,
        language: language === 'ar' ? 'ar' : 'fr',
        voice: true,
        audioPath: path,
        audioMs: file.ms,
        onText: (partial) => {
          if (closed.current || turn.current !== myTurn) return;
          setReply(partial);
          feed(partial, false);
        },
        ...(conversationId ? {} : { newConversationId: draftId, title: makeTitle(text) }),
      });
      if (closed.current) return;
      setConversationId(answer.conversationId);
      if (turn.current !== myTurn) return;
      setReply(answer.answer);
      if (speakReplies && detectMessageLanguage(answer.answer) !== 'darija-latin') {
        feed(answer.answer, true);
        setStage('speaking');
        await voice.idle();
        // Terminé sans interruption : l'écoute reprend toute seule.
        if (!closed.current && turn.current === myTurn) void startListening();
      } else {
        setStage('idle');
      }
    } catch (error) {
      if (closed.current) return;
      setErrorKey(chatErrorMessageKey(error));
      setStage('error');
    }
  }, [ask, conversationId, draftId, hint, language, recorder, session, speakReplies, stage, startListening, voice]);

  // Durée maximale (2 minutes) : l'envoi part tout seul.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stage === 'listening' && recorder.ms >= MAX_RECORD_MS) void sendTurn();
  }, [recorder.ms, stage, sendTurn]);

  // Fin de phrase automatique : après la parole, un court silence envoie le message (plus besoin d'appuyer).
  // Si personne ne parle pendant un moment, l'écoute s'arrête sans rien envoyer.
  useEffect(() => {
    if (stage !== 'listening') return;
    const event = endpointer.current.push(recorder.level, recorder.ms);
    if (event === 'end') {
      void Haptics.selectionAsync().catch(() => undefined);
      void sendTurn();
    } else if (event === 'no-speech') {
      void recorder.cancel();
      setStage('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.level, recorder.ms, stage]);

  const cancelRecording = useCallback(async () => {
    await recorder.cancel();
    turn.current += 1;
    voice.stop();
    setStage('idle');
    setErrorKey(null);
  }, [recorder, voice]);

  const close = useCallback(async () => {
    closed.current = true;
    voice.stop();
    await recorder.cancel();
    if (existingConversation || !conversationId) router.back();
    else router.replace({ pathname: '/chat/[id]', params: { id: conversationId } });
  }, [conversationId, existingConversation, recorder, voice]);

  const toggleSpeak = () => {
    const next = !speakReplies;
    setSpeakReplies(next);
    AsyncStorage.setItem(SPEAK_KEY, next ? '1' : '0').catch(() => undefined);
    if (!next) {
      turn.current += 1;
      voice.stop();
    }
  };

  // ---- Orbe : pulse au rythme de la voix (écoute), respiration lente pendant le traitement
  const pulse = useSharedValue(0);
  const breathe = stage === 'transcribing' || stage === 'thinking' || stage === 'speaking';
  useEffect(() => {
    cancelAnimation(pulse);
    if (reduceMotion) {
      pulse.value = 0;
      return;
    }
    if (breathe) pulse.value = withRepeat(withSequence(withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(0.1, { duration: 700, easing: Easing.inOut(Easing.quad) })), -1);
    else if (stage === 'listening') pulse.value = withTiming(recorder.level, { duration: 90 });
    else pulse.value = withTiming(0, { duration: 200 });
  }, [stage, breathe, recorder.level, reduceMotion, pulse]);
  const ring1 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.1 }] }));
  const ring2 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.18 }] }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.12 }] }));

  const status = { idle: t('chat.voice.idle'), listening: t('chat.voice.listening'), paused: t('chat.voice.paused'), transcribing: t('chat.voice.transcribing'), thinking: t('chat.voice.thinking'), speaking: t('chat.voice.speaking'), error: t('chat.voice.idle') }[stage];
  const listening = stage === 'listening' || stage === 'paused';
  const langLabel = hint === 'auto' ? t('chat.voice.langAuto') : hint === 'darija' ? `${t('chat.voice.langDarija')}` : t('chat.voice.langFr');

  const circle = { width: 56, height: 56, borderRadius: 28, backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <View style={{ flex: 1, backgroundColor: Brand.graphite }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 12 }} edges={['top', 'left', 'right', 'bottom']}>
        {/* Haut */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
          <Pressable onPress={() => void close()} accessibilityRole="button" accessibilityLabel={t('chat.voice.close')} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.strokeOnDark, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={18} color={Brand.white} />
          </Pressable>
          <MicroLabel size={11} track={0.16} color={Brand.mutedOnDark}>
            {t('chat.voice.title')}
          </MicroLabel>
          <Pressable
            onPress={() => setHint(HINTS[(HINTS.indexOf(hint) + 1) % HINTS.length])}
            accessibilityRole="button"
            accessibilityLabel={t('chat.voice.langA11y', { lang: langLabel })}
            style={{ height: 36, borderRadius: 18, borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: Brand.surfaceOnDark, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.successOnDark }} />
            <HText weight="semibold" size={12} color={Brand.white}>
              {langLabel}
            </HText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {permission !== 'ok' ? (
            <View style={{ marginTop: 56, alignItems: 'center', gap: 14, paddingHorizontal: 16 }}>
              <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: Brand.orangeDeep, borderWidth: 2, borderColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="mic-off-outline" size={40} color={Brand.orangeLight} />
              </View>
              <HText font="display" weight="semibold" size={22} color={Brand.white} style={{ textAlign: 'center' }}>
                {t('chat.voice.permTitle')}
              </HText>
              <HText size={14} color={Brand.mutedOnDark} style={{ textAlign: 'center' }}>
                {t(permission === 'blocked' ? 'chat.voice.permBlocked' : 'chat.voice.permBody')}
              </HText>
              <Pressable onPress={() => (permission === 'blocked' ? openMicrophoneSettings() : void startListening())} accessibilityRole="button" style={{ minHeight: 48, borderRadius: 24, backgroundColor: Brand.orange, paddingHorizontal: 24, justifyContent: 'center' }}>
                <HText weight="semibold" size={15} color={Brand.white}>
                  {t(permission === 'blocked' ? 'chat.voice.openSettings' : 'chat.voice.allow')}
                </HText>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Orbe */}
              <Pressable
                disabled={stage !== 'idle' && stage !== 'error'}
                onPress={() => void startListening()}
                accessibilityRole="button"
                accessibilityLabel={t('chat.voice.orb')}
                style={{ marginTop: 36, width: 260, height: 260, alignItems: 'center', justifyContent: 'center' }}
              >
                <Animated.View style={[{ position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: Brand.borderOnDark }, ring2]} />
                <Animated.View style={[{ position: 'absolute', width: 204, height: 204, borderRadius: 102, borderWidth: 1, borderColor: Brand.strokeOnDark }, ring1]} />
                <View style={{ width: 152, height: 152, borderRadius: 76, backgroundColor: Brand.orangeDeep, borderWidth: 2, borderColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={[{ width: 104, height: 104, borderRadius: 52, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }, core]}>
                    <Ionicons name="mic-outline" size={40} color={Brand.white} />
                  </Animated.View>
                </View>
              </Pressable>

              {/* Forme d'onde */}
              <View accessibilityLabel={t('chat.voice.levelA11y')} style={{ marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 3, height: 34 }}>
                {levels.map((level, index) => (
                  <View key={index} style={{ width: 4, borderRadius: 2, height: 6 + level * 28, backgroundColor: listening && index >= levels.length - 12 ? Brand.orangeLight : Palette.textSecondary }} />
                ))}
              </View>

              {/* État et durée */}
              <View accessibilityLiveRegion="polite" style={{ marginTop: 18, alignItems: 'center', gap: 4 }}>
                <HText font="display" weight="semibold" size={24} color={Brand.white}>
                  {status}
                </HText>
                {listening ? (
                  <HText size={14} color={Brand.mutedOnDark}>
                    {formatDuration(recorder.ms)}
                  </HText>
                ) : null}
              </View>

              {errorKey ? (
                <HText size={13} color={Brand.errorOnDark} style={{ marginTop: 12, textAlign: 'center' }}>
                  {t(errorKey)}
                </HText>
              ) : null}

              {/* Transcription (après l'envoi) et réponse */}
              <View style={{ marginTop: 20, width: '100%', backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.borderOnDark, borderRadius: 20, padding: 16, gap: 8 }}>
                <MicroLabel size={10} track={0.16} color={Brand.mutedOnDark}>
                  {t('chat.voice.transcriptionLabel')}
                </MicroLabel>
                <HText size={18} weight="medium" color={transcript ? Brand.white : Brand.mutedOnDark} style={{ lineHeight: 26 }}>
                  {transcript ?? t('chat.voice.transcriptionHint')}
                </HText>
              </View>
              {reply ? (
                <View style={{ marginTop: 12, width: '100%', backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.borderOnDark, borderRadius: 20, padding: 16, gap: 8 }}>
                  <MicroLabel size={10} track={0.16} color={Brand.orangeLight}>
                    {t('chat.voice.replyLabel')}
                  </MicroLabel>
                  <HText size={16} color={Brand.white} style={{ lineHeight: 24 }} selectable>
                    {reply}
                  </HText>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* Bas */}
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            <HText size={13} color={Brand.textOnDark} style={{ flex: 1 }}>
              {t('chat.voice.speakToggle')}
            </HText>
            <Pressable
              onPress={toggleSpeak}
              accessibilityRole="switch"
              accessibilityState={{ checked: speakReplies }}
              accessibilityLabel={t('chat.voice.speakToggle')}
              style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: speakReplies ? Brand.successOnDark : Brand.strokeOnDark, alignItems: speakReplies ? 'flex-end' : 'flex-start', justifyContent: 'center' }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: Brand.white }} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
            <Pressable onPress={() => void cancelRecording()} accessibilityRole="button" accessibilityLabel={t('chat.voice.cancel')} style={circle}>
              <Ionicons name="trash-outline" size={20} color={Brand.white} />
            </Pressable>
            <Pressable
              onPress={() => (listening ? void sendTurn() : stage === 'speaking' ? (turn.current++, voice.stop(), void startListening()) : stage === 'idle' || stage === 'error' ? void startListening() : undefined)}
              disabled={stage === 'transcribing' || stage === 'thinking'}
              accessibilityRole="button"
              accessibilityLabel={t('chat.voice.send')}
              accessibilityState={{ disabled: stage === 'transcribing' || stage === 'thinking' }}
              style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center', opacity: stage === 'transcribing' || stage === 'thinking' ? 0.5 : 1 }}
            >
              <Ionicons name={listening ? 'arrow-up' : 'mic-outline'} size={28} color={Brand.graphite} />
            </Pressable>
            <Pressable
              onPress={() => {
                if (stage === 'listening') {
                  recorder.pause();
                  setStage('paused');
                } else if (stage === 'paused') {
                  recorder.resume();
                  setStage('listening');
                }
              }}
              disabled={!listening}
              accessibilityRole="button"
              accessibilityLabel={t(stage === 'paused' ? 'chat.voice.resume' : 'chat.voice.pause')}
              style={[circle, { opacity: listening ? 1 : 0.4 }]}
            >
              <Ionicons name={stage === 'paused' ? 'play' : 'pause'} size={18} color={Brand.white} />
            </Pressable>
          </View>
          <HText size={12} color={Brand.mutedOnDark} style={{ textAlign: 'center' }}>
            {t('chat.voice.hint')} · {t('chat.voice.limit')}
          </HText>
        </View>
      </SafeAreaView>
    </View>
  );
}
