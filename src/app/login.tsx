import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TextField } from '@/components/text-field';
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
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (session) {
    return <Redirect href="/flotte" />;
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
                  selected ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#101423' }}>
                  {t(`common.${LANGUAGE_LABEL_KEY[code]}`)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-1 justify-center gap-6">
          <View className="items-center gap-1">
            <ThemedText type="title" themeColor="primary" className="font-cairo-bold">
              {t('common.appName')}
            </ThemedText>
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
              <View className="rounded-2xl bg-[#fee2e2] px-4 py-3">
                <ThemedText type="small" style={{ color: '#dc2626' }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting || !email || !password}
              className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
                isSubmitting || !email || !password ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
              }`}
            >
              {isSubmitting ? <ActivityIndicator color="#ffffff" /> : null}
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              </ThemedText>
            </Pressable>

            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              {t('auth.noAccountHint')}
            </ThemedText>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
