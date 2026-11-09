import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { commandScript, type EngineCommand } from './protocol';
import { engineOrigin, isAllowedEngineUrl, VOCAL_ENGINE_URL } from './engine-config';

const HIDDEN: ViewStyle = { position: 'absolute', bottom: 0, end: 0, width: 2, height: 2, opacity: 0.01, backgroundColor: 'transparent' };
const FULL: ViewStyle = { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, opacity: 0.02, backgroundColor: 'transparent' };

export type EngineHandle = { send: (command: EngineCommand) => void };

/** Adresse de la page du moteur (sans interface) : la même que le test, fichier `engine.html`. */
export const ENGINE_PAGE_URL = `${VOCAL_ENGINE_URL.replace(/\/+$/, '')}/engine.html`;

/**
 * Fenêtre web interne INVISIBLE qui fait tourner le moteur vocal (micro en continu, voix, connexion temps réel). Fonctionne dans
 * Expo Go. `interactive` : le moteur demande un toucher pour débloquer le son ; la fenêtre couvre alors l'écran (presque
 * transparente) le temps d'un appui.
 */
export const EngineView = forwardRef<EngineHandle, { interactive: boolean; onMessage: (raw: string) => void; onLoadError: () => void }>(function EngineView({ interactive, onMessage, onLoadError }, ref) {
  const web = useRef<InstanceType<typeof WebView>>(null);
  const origin = engineOrigin(ENGINE_PAGE_URL);

  useImperativeHandle(ref, () => ({ send: (command) => web.current?.injectJavaScript(commandScript(command)) }), []);
  const handle = useCallback((event: WebViewMessageEvent) => onMessage(event.nativeEvent.data), [onMessage]);

  return (
    <WebView
      ref={web}
      source={{ uri: ENGINE_PAGE_URL }}
      style={interactive ? FULL : HIDDEN}
      originWhitelist={['https://*']}
      onShouldStartLoadWithRequest={(request) => isAllowedEngineUrl(request.url, origin)}
      javaScriptEnabled
      domStorageEnabled
      // Micro et lecture sans geste dans la fenêtre (iOS 15 et plus : autorisation donnée à ce moteur seul).
      mediaCapturePermissionGrantType="grant"
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      setSupportMultipleWindows={false}
      allowsBackForwardNavigationGestures={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onMessage={handle}
      onError={onLoadError}
      onHttpError={onLoadError}
    />
  );
});
