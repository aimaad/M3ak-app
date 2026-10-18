import { useMemo } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { PAGE } from './template-render';

/**
 * Adapte le HTML du contrat (celui du PDF) à l'écran du téléphone : la page A4 entière tient en largeur, on peut pincer
 * pour agrandir, et chaque feuille est présentée comme une page posée sur un fond gris.
 */
export function viewerHtml(contractHtml: string): string {
  const head = `<meta name="viewport" content="width=${PAGE.width}, minimum-scale=0.1, maximum-scale=5, user-scalable=yes" /><style>html,body{background:#E5E7EB}.sheet{background:#fff;margin:0 auto 14px;box-shadow:0 1px 5px rgba(0,0,0,.25);page-break-after:auto}</style>`;
  return contractHtml.includes('<head>') ? contractHtml.replace('<head>', `<head>${head}`) : `<head>${head}</head>${contractHtml}`;
}

/** Prévient l'application quand le lecteur arrive en bas du document (ou quand tout tient à l'écran). */
const END_SCRIPT = `(function(){var sent=false;function check(){if(sent)return;var d=document.documentElement;if(window.innerHeight+window.scrollY>=d.scrollHeight-30){sent=true;window.ReactNativeWebView.postMessage('end');}}window.addEventListener('scroll',check,{passive:true});window.addEventListener('load',function(){setTimeout(check,500);});setTimeout(check,1200);})();true;`;

type Props = {
  visible: boolean;
  html: string | null;
  /** Vrai une fois le contrat lu jusqu'en bas. */
  reachedEnd: boolean;
  onReachEnd: () => void;
  onClose: () => void;
};

export function ContractViewer({ visible, html, reachedEnd, onReachEnd, onClose }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 8);
  const bottomInset = Math.max(insets.bottom, 12);
  const source = useMemo(() => (html ? { html: viewerHtml(html) } : null), [html]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#E5E7EB', paddingTop: topInset, paddingBottom: bottomInset }}>
        <View className="flex-row items-center justify-between bg-white px-5 pb-3 pt-1">
          <View className="flex-1 pr-3">
            <ThemedText type="smallBold">{t('contract.sign.viewerTitle')}</ThemedText>
            <ThemedText type="small" style={{ color: reachedEnd ? '#15803D' : '#B45309' }}>
              {reachedEnd ? t('contract.sign.viewerDone') : t('contract.sign.viewerHint')}
            </ThemedText>
          </View>
          <Pressable onPress={onClose} className="rounded-full px-4 py-2" style={{ backgroundColor: M3akPalette.mauve }} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: '#fff' }}>
              {t('common.close')}
            </ThemedText>
          </Pressable>
        </View>
        {source ? (
          <WebView
            originWhitelist={['*']}
            source={source}
            injectedJavaScript={END_SCRIPT}
            onMessage={(event) => {
              if (event.nativeEvent.data === 'end') onReachEnd();
            }}
            scalesPageToFit
            startInLoadingState
            renderLoading={() => (
              <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={M3akPalette.mauve} />
              </View>
            )}
            style={{ flex: 1, backgroundColor: '#E5E7EB' }}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        )}
      </View>
    </Modal>
  );
}
