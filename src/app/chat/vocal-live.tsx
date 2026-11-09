import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Brand } from '@/constants/theme';
import { isAllowedEngineUrl, VOCAL_ENGINE_URL } from '@/features/chat/live/engine-config';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

/**
 * Test du mode vocal temps réel dans l'app (écran caché : appui long sur le titre du mode vocal).
 * Le moteur vocal (micro en continu, voix, connexion temps réel) tourne dans une fenêtre web interne : fonctionne dans Expo Go,
 * sur iPhone comme sur Android, sans module natif supplémentaire. Étape 1 : vérifier micro, écho et interruption sur le téléphone.
 */
export default function VocalLiveTestScreen() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: Brand.graphite }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('chat.voiceLive.close')} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.strokeOnDark, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={18} color={Brand.white} />
          </Pressable>
          <MicroLabel size={11} track={0.16} color={Brand.mutedOnDark}>
            {t('chat.voiceLive.title')}
          </MicroLabel>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ flex: 1 }}>
          {failed ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 }}>
              <HText size={14} color={Brand.white} style={{ textAlign: 'center' }}>
                {t('chat.voiceLive.loadFailed')}
              </HText>
              <Pressable
                onPress={() => {
                  setFailed(false);
                  setLoading(true);
                  setAttempt((n) => n + 1);
                }}
                accessibilityRole="button"
                style={{ minHeight: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}
              >
                <HText weight="semibold" size={15} color={Brand.white}>
                  {t('chat.voiceLive.retry')}
                </HText>
              </Pressable>
            </View>
          ) : (
            <WebView
              key={attempt}
              source={{ uri: VOCAL_ENGINE_URL }}
              style={{ flex: 1, backgroundColor: Brand.graphite }}
              originWhitelist={['https://*']}
              onShouldStartLoadWithRequest={(request) => isAllowedEngineUrl(request.url)}
              javaScriptEnabled
              domStorageEnabled
              // Micro et lecture sans geste supplémentaire dans la fenêtre (iOS 15 et plus : autorisation donnée à ce moteur seul).
              mediaCapturePermissionGrantType="grant"
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              setSupportMultipleWindows={false}
              allowsBackForwardNavigationGestures={false}
              onLoadEnd={() => setLoading(false)}
              onError={() => setFailed(true)}
              onHttpError={() => setFailed(true)}
            />
          )}
          {loading && !failed ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Brand.graphite }}>
              <ActivityIndicator color={Brand.orange} />
              <HText size={13} color={Brand.mutedOnDark}>
                {t('chat.voiceLive.loading')}
              </HText>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
