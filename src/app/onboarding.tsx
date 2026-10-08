import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { signOut } from '@/features/auth/api';
import { useCreateAgency, useMyAgency, useRedeemInvite } from '@/features/agency/hooks';
import { useLanguage } from '@/i18n/use-language';

type Mode = 'create' | 'join';

export default function OnboardingScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const createAgency = useCreateAgency();
  const redeemInvite = useRedeemInvite();

  const [mode, setMode] = useState<Mode>('create');
  const [nom, setNom] = useState('');
  const [ville, setVille] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    if (!nom.trim() || !ownerName.trim()) {
      setError(t('onboarding.errors.required'));
      return;
    }
    try {
      await createAgency.mutateAsync({ nom: nom.trim(), ville: ville.trim() || null, ownerName: ownerName.trim() });
      router.replace('/accueil');
    } catch {
      setError(t('onboarding.createError'));
    }
  }

  async function handleJoin() {
    setError(null);
    if (!code.trim()) {
      setError(t('onboarding.errors.required'));
      return;
    }
    try {
      await redeemInvite.mutateAsync(code.trim().toUpperCase());
      router.replace('/accueil');
    } catch {
      setError(t('onboarding.joinError'));
    }
  }

  if (agencyQuery.data) {
    return <Redirect href="/accueil" />;
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
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
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setMode('create')}
              className={`flex-1 items-center rounded-2xl border px-4 py-3 ${
                mode === 'create' ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
              }`}
            >
              <ThemedText type="smallBold" style={{ color: mode === 'create' ? '#ffffff' : '#101423' }}>
                {t('onboarding.createTab')}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setMode('join')}
              className={`flex-1 items-center rounded-2xl border px-4 py-3 ${
                mode === 'join' ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
              }`}
            >
              <ThemedText type="smallBold" style={{ color: mode === 'join' ? '#ffffff' : '#101423' }}>
                {t('onboarding.joinTab')}
              </ThemedText>
            </Pressable>
          </View>

          {mode === 'create' ? (
            <View className="gap-4">
              <TextField label={t('onboarding.ownerName')} value={ownerName} onChangeText={setOwnerName} />
              <TextField label={t('onboarding.agencyName')} value={nom} onChangeText={setNom} />
              <TextField label={t('onboarding.agencyCity')} value={ville} onChangeText={setVille} />

              {error ? (
                <ThemedText type="small" style={{ color: '#dc2626' }}>
                  {error}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={handleCreate}
                disabled={createAgency.isPending}
                className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
                  createAgency.isPending ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
                }`}
              >
                {createAgency.isPending ? <ActivityIndicator color="#ffffff" /> : null}
                <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                  {t('onboarding.createAction')}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View className="gap-4">
              <TextField
                label={t('onboarding.inviteCode')}
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                autoCapitalize="characters"
                placeholder="A1B2C3"
              />

              {error ? (
                <ThemedText type="small" style={{ color: '#dc2626' }}>
                  {error}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={handleJoin}
                disabled={redeemInvite.isPending}
                className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
                  redeemInvite.isPending ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
                }`}
              >
                {redeemInvite.isPending ? <ActivityIndicator color="#ffffff" /> : null}
                <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                  {t('onboarding.joinAction')}
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
