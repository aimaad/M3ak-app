/* eslint-disable @typescript-eslint/no-require-imports, import/first -- les « jest.mock » doivent précéder les imports et utilisent require */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

// ---- Faux moteur vocal : garde les commandes reçues et laisse le test lui faire « parler » l'app.
const engine: { sent: string[]; emit: (message: object) => void } = { sent: [], emit: () => undefined };
jest.mock('react-native-webview', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const WebView = ReactLocal.forwardRef((props: { onMessage: (event: { nativeEvent: { data: string } }) => void }, ref: React.Ref<unknown>) => {
    ReactLocal.useImperativeHandle(ref, () => ({ injectJavaScript: (script: string) => engine.sent.push(script) }));
    engine.emit = (message: object) => props.onMessage({ nativeEvent: { data: JSON.stringify(message) } });
    return <View testID="engine" />;
  });
  return { WebView };
});

// ---- Faux serveur : jeton, outil, enregistrement.
const calls: { name: string; body: Record<string, unknown> }[] = [];
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: {
      invoke: async (name: string, { body }: { body: Record<string, unknown> }) => {
        calls.push({ name, body });
        if (name === 'chat-live-token' && body.action === 'save') return { data: { ok: true, saved: true }, error: null };
        if (name === 'chat-live-token' && body.action === 'end') return { data: { ok: true }, error: null };
        if (name === 'chat-live-token') return { data: { ok: true, token: 'auth_tokens/x', model: 'gemini-3.1-flash-live-preview', voice: 'Aoede', sessionId: '11111111-1111-4111-8111-111111111111', maxSeconds: 600, thinkingLevel: 'LOW' }, error: null };
        if (name === 'chat-tools') return { data: { ok: true, result: [{ vehicle: 'Dacia Logan' }], cards: [{ type: 'vehicles', items: [{ kind: 'vehicle', id: '22222222-2222-4222-8222-222222222222', title: 'Dacia Logan', plate: '8921', tone: 'free' }] }] }, error: null };
        return { data: null, error: new Error('inconnu') };
      },
    },
  }),
}));
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  // Lecture différée : le routeur factice est créé après le chargement des modules.
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ t: (key: string) => key, language: 'fr' }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
// Animations : version simple (l'orbe et l'apparition des cartes ne sont pas l'objet du test).
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = { duration: () => chain };
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => true,
    cancelAnimation: () => undefined,
    withTiming: (value: number) => value,
    withRepeat: (value: number) => value,
    withSequence: (value: number) => value,
    Easing: { inOut: () => undefined, quad: undefined },
    FadeInDown: chain,
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import VoiceLiveScreen from '../../../app/chat/vocal';

/** Commandes envoyées au moteur, décodées (elles sont encodées deux fois pour ne jamais injecter de code). */
const commands = (): Record<string, unknown>[] =>
  engine.sent.map((script) => {
    const literal = script.slice(script.indexOf('data:') + 5, script.lastIndexOf('}));'));
    return JSON.parse(JSON.parse(literal) as string) as Record<string, unknown>;
  });

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe('écran du mode vocal temps réel (moteur et serveur simulés)', () => {
  beforeEach(() => {
    engine.sent = [];
    calls.length = 0;
    jest.clearAllMocks();
  });

  it('démarre tout seul, affiche les sous-titres et la carte, enregistre la conversation à la fin', async () => {
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <VoiceLiveScreen />
      </QueryClientProvider>
    );
    await flush();
    // Le moteur est prêt : l'app demande un jeton et lui ordonne de démarrer avec la voix par défaut.
    await act(async () => engine.emit({ t: 'ready' }));
    await flush();
    expect(calls.find((c) => c.name === 'chat-live-token')?.body).toMatchObject({ profile: 'app', voice: 'Aoede' });
    expect(commands()).toContainEqual({ t: 'start', token: 'auth_tokens/x', model: 'gemini-3.1-flash-live-preview', voice: 'Aoede', thinkingLevel: 'LOW' });

    // Une question, un outil, une réponse.
    await act(async () => {
      engine.emit({ t: 'state', s: 'listening' });
      engine.emit({ t: 'user', text: 'Quelles voitures sont libres ?' });
      engine.emit({ t: 'toolcall', id: 'c1', name: 'available_vehicles', args: {} });
    });
    await flush();
    expect(calls.some((c) => c.name === 'chat-tools' && c.body.tool === 'available_vehicles')).toBe(true);
    expect(commands()).toContainEqual({ t: 'tool', id: 'c1', name: 'available_vehicles', response: { output: [{ vehicle: 'Dacia Logan' }] } });
    await act(async () => {
      engine.emit({ t: 'state', s: 'speaking' });
      engine.emit({ t: 'bot', text: 'Il y a la Dacia Logan.' });
      engine.emit({ t: 'turn' });
    });
    expect(screen.getByText('Quelles voitures sont libres ?')).toBeTruthy();
    expect(screen.getByText('Il y a la Dacia Logan.')).toBeTruthy();
    expect(screen.getByText('Dacia Logan')).toBeTruthy(); // carte de données sous la réponse

    // Terminer : le moteur s'arrête, la conversation est enregistrée (texte seulement) et l'app ouvre la conversation.
    await fireEvent.press(screen.getByLabelText('chat.live.end'));
    await flush();
    expect(commands()).toContainEqual({ t: 'stop' });
    const save = calls.find((c) => c.body.action === 'save');
    expect(save?.body.lines).toEqual([
      { role: 'user', content: 'Quelles voitures sont libres ?', cards: [] },
      { role: 'assistant', content: 'Il y a la Dacia Logan.', cards: [expect.objectContaining({ type: 'vehicles' })] },
    ]);
    expect(mockRouter.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/chat/[id]' }));
  });

  it('micro refusé : message clair, bouton pour ouvrir les réglages', async () => {
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <VoiceLiveScreen />
      </QueryClientProvider>
    );
    await flush();
    await act(async () => engine.emit({ t: 'ready' }));
    await flush();
    await act(async () => engine.emit({ t: 'error', code: 'mic_denied', message: 'NotAllowedError' }));
    expect(screen.getByText('chat.voice.permTitle')).toBeTruthy();
    expect(screen.getByText('chat.voice.openSettings')).toBeTruthy();
  });
});
