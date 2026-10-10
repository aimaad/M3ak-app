import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TextField } from '@/components/text-field';
import { M3akPalette } from '@/constants/theme';
import { signInWithEmail } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-context';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

const LANGUAGE_LABEL_KEY: Record<SupportedLanguage, 'french' | 'arabic'> = {
  fr: 'french',
  ar: 'arabic',
};

export default function LoginScreen() {
  const { session } = useSession();
  const { language, changeLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      console.error('Échec de connexion Supabase :', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`${t('auth.invalidCredentials')} (${message})`);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (session) {
    return <Redirect href="/accueil" />;
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1 px-6">
        <View className="flex-row justify-end gap-2 pt-2">
          {SUPPORTED_LANGUAGES.map((code) => {
            const selected = code === language;
            return (
              <Pressable
                key={code}
                onPress={() => changeLanguage(code)}
                className={`rounded-full border px-3 py-1 ${
                  selected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#211A2E' }}>
                  {t(`common.${LANGUAGE_LABEL_KEY[code]}`)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-1 justify-center gap-8">
          <View className="items-center gap-2">
            <Logo size="lg" />
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('auth.subtitle')}
            </ThemedText>
          </View>

          <View className="gap-4">
            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              testID="login-email"
            />
            <TextField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              testID="login-password"
            />

            {error ? (
              <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: M3akPalette.dangerLight }}>
                <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}

            <Button
              label={isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              onPress={handleSubmit}
              disabled={isSubmitting || !email || !password}
              loading={isSubmitting}
            />

            <Pressable onPress={() => router.push('/signup')} className="items-center py-2">
              <ThemedText type="small" themeColor="primary">
                {t('auth.noAccountHint')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
