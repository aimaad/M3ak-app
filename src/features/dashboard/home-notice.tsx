import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { HText } from './home-ui';

/** Ordre d'affichage : un seul bandeau à la fois (logo manquant, puis premiers pas, puis fin d'essai). */
export type NoticeKind = 'logo' | 'start' | 'trial';

export function pickNotice(candidates: { kind: NoticeKind; eligible: boolean; dismissed: boolean | null }[]): NoticeKind | null {
  for (const kind of ['logo', 'start', 'trial'] as const) {
    const candidate = candidates.find((c) => c.kind === kind);
    if (candidate?.eligible && candidate.dismissed === false) return kind;
  }
  return null;
}

/** Bandeau fin sous les pastilles de questions : fond #F6F6F5, bordure #E2E4E5, rayon 14, texte 13 px, « × » pour le refermer. */
export function HomeNotice({ text, onPress, onDismiss }: { text: string; onPress: () => void; onDismiss: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, borderRadius: 14 }}>
      <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1, minHeight: 44, justifyContent: 'center', paddingVertical: 10, paddingStart: 14 }}>
        <HText size={13} color={Palette.textPrimary}>
          {text}
        </HText>
      </Pressable>
      <Pressable onPress={onDismiss} hitSlop={4} accessibilityRole="button" accessibilityLabel={t('accueil.home.notice.dismiss')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="close" size={18} color={Palette.textSecondary} />
      </Pressable>
    </View>
  );
}
