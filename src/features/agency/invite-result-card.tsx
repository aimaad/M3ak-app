import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { formatInviteCode } from './invite-code';
import type { InviteResult } from './types';

/**
 * Affiche le code d'une invitation fraîchement créée / renvoyée. Le code n'est
 * stocké nulle part en clair : c'est la seule occasion de le voir.
 */
export function InviteResultCard({ result, onDone }: { result: InviteResult; onDone: () => void }) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);

  const code = formatInviteCode(result.code);
  const date = new Date(result.expiresAt).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const message = t('equipe.invite.whatsappMessage', {
    prenom: result.prenom,
    agency: result.agencyName,
    role: t(`equipe.roles.${result.role}`),
    email: result.email,
    code,
    date,
  });

  const emailLine = result.emailSent
    ? t('equipe.invite.emailSent', { email: result.email })
    : result.emailError === 'smtp_send_failed'
      ? t('equipe.invite.emailFailed')
      : t('equipe.invite.emailNotConfigured');

  return (
    <View className="gap-3 rounded-2xl border border-line bg-white p-4">
      <ThemedText type="smallBold">
        {t('equipe.invite.createdFor', { name: `${result.prenom} ${result.nom}`.trim() })}
      </ThemedText>

      <ThemedText type="small" style={{ color: result.emailSent ? M3akPalette.mauve : M3akPalette.danger }}>
        {emailLine}
      </ThemedText>

      <View className="items-center rounded-2xl bg-brand-light px-4 py-4">
        <ThemedText type="small" themeColor="textSecondary">
          {t('equipe.invite.codeLabel')}
        </ThemedText>
        <ThemedText type="subtitle" style={{ letterSpacing: 2, color: M3akPalette.mauveDeep }} selectable>
          {code}
        </ThemedText>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {t('equipe.invite.codeHint', { email: result.email, date })}
      </ThemedText>

      <View className="flex-row gap-2">
        <Button
          label={copied ? t('equipe.invite.copied') : t('equipe.invite.copy')}
          variant="secondary"
          size="sm"
          style={{ flex: 1 }}
          onPress={async () => {
            await Clipboard.setStringAsync(code);
            setCopied(true);
          }}
        />
        <Button
          label={t('equipe.invite.whatsapp')}
          icon="logo-whatsapp"
          size="sm"
          style={{ flex: 1 }}
          onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`)}
        />
      </View>

      <Button label={t('equipe.invite.done')} variant="ghost" size="sm" onPress={onDone} />
    </View>
  );
}
