import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { saveMyNames, signOut } from '@/features/auth/api';
import { buildFullName, readNamesFromMetadata, validatePersonName } from '@/features/auth/names';
import { useSession } from '@/features/auth/session-context';
import { useMyAgency, useRedeemInvite } from '@/features/agency/hooks';
import {
  formatInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
} from '@/features/agency/invite-code';
import { inviteErrorKey } from '@/features/agency/invite-errors';
import { errorReference, friendlyErrorKey, userErrorMessage } from '@/lib/user-errors';
import { useLanguage } from '@/i18n/use-language';

export default function OnboardingScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const redeemInvite = useRedeemInvite();

  const { session } = useSession();
  // Prénom/nom saisis à l'inscription ; sinon (ancien compte) on les demande ici.
  const savedNames = readNamesFromMetadata(session?.user.user_metadata);
  const [prenom, setPrenom] = useState('');
  const [nomFamille, setNomFamille] = useState('');
  const names = savedNames ?? { prenom, nom: nomFamille };
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function namesAreValid() {
    return !validatePersonName(names.prenom) && !validatePersonName(names.nom);
  }

  async function ensureNamesSaved() {
    if (!savedNames) await saveMyNames(names);
  }

  async function handleJoin() {
    setError(null);
    if (!isValidInviteCode(code) || !namesAreValid()) {
      setError(t('onboarding.errors.required'));
      return;
    }
    try {
      await ensureNamesSaved();
      await redeemInvite.mutateAsync(normalizeInviteCode(code));
      router.replace('/accueil');
    } catch (err) {
      console.error('Échec pour rejoindre une agence :', err);
      const general = friendlyErrorKey(err, 'errors.none');
      if (['errors.network', 'errors.rateLimit', 'errors.emailNotConfirmed', 'errors.server', 'errors.emailSend'].includes(general)) {
        setError(userErrorMessage(err, t));
      } else {
        const key = inviteErrorKey(err);
        const reference = key.endsWith('.generic') ? errorReference(err) : null;
        setError(reference ? `${t(key)} ${t('errors.reference', { reference })}` : t(key));
      }
    }
  }

  if (agencyQuery.data) {
    return <Redirect href="/accueil" />;
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={t('onboarding.title')}
          subtitle={t('onboarding.subtitle')}
          right={
            <Pressable onPress={() => signOut()} hitSlop={8}>
              <ThemedText type="small" themeColor="primary">
                {t('auth.signOut')}
              </ThemedText>
            </Pressable>
          }
        />

        <View className="gap-4 px-6">
          {savedNames ? (
            <ThemedText type="small" themeColor="textSecondary">
              {buildFullName(savedNames)}
            </ThemedText>
          ) : (
            <View className="gap-4">
              <TextField
                label={t('auth.prenom')}
                value={prenom}
                onChangeText={setPrenom}
                autoComplete="given-name"
              />
              <TextField
                label={t('auth.nom')}
                value={nomFamille}
                onChangeText={setNomFamille}
                autoComplete="family-name"
              />
            </View>
          )}

          <View className="gap-4">
            <TextField
              label={t('onboarding.inviteCode')}
              value={code}
              onChangeText={(v) => setCode(formatInviteCode(v))}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABCD-EFGH-JK23"
            />
            <ThemedText type="small" themeColor="textSecondary">
              {t('onboarding.joinHint', { email: session?.user.email ?? '' })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('onboarding.noAgencyNote')}
            </ThemedText>

            {error ? (
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {error}
              </ThemedText>
            ) : null}

            <Button
              label={t('onboarding.joinAction')}
              onPress={handleJoin}
              disabled={redeemInvite.isPending}
              loading={redeemInvite.isPending}
            />
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
