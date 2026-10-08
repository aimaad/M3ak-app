import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { signUpWithEmail } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-context';
import { isSignupFormValid, validateSignupForm, type SignupFormValues } from '@/features/auth/validation';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_VALUES: SignupFormValues = { email: '', password: '', confirmPassword: '' };

export default function SignupScreen() {
  const { session } = useSession();
  const { t } = useLanguage();
  const [values, setValues] = useState<SignupFormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);

  const errors = validateSignupForm(values);

  function update<K extends keyof SignupFormValues>(key: K, value: SignupFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setTouched(true);
    setError(null);
    if (!isSignupFormValid(errors)) return;

    setIsSubmitting(true);
    try {
      const hasSession = await signUpWithEmail(values.email.trim(), values.password);
      if (hasSession) {
        router.replace('/onboarding');
      } else {
        setConfirmationNeeded(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (session) {
    return <Redirect href="/accueil" />;
  }

  if (confirmationNeeded) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1 items-center justify-center gap-4 px-8" edges={['top', 'left', 'right']}>
          <ThemedText type="subtitle" className="text-center font-cairo-semibold">
            {t('auth.confirmEmailTitle')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" className="text-center">
            {t('auth.confirmEmailBody')}
          </ThemedText>
          <Pressable onPress={() => router.replace('/login')} className="mt-2 rounded-2xl bg-[#1f5eff] px-5 py-3">
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              {t('auth.backToLogin')}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')} showBack />

        <View className="gap-4 px-6">
          <TextField
            label={t('auth.email')}
            value={values.email}
            onChangeText={(v) => update('email', v)}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            error={touched && errors.email ? t(`auth.errors.${errors.email}`) : undefined}
          />
          <TextField
            label={t('auth.password')}
            value={values.password}
            onChangeText={(v) => update('password', v)}
            secureTextEntry
            autoCapitalize="none"
            error={touched && errors.password ? t(`auth.errors.${errors.password}`) : undefined}
          />
          <TextField
            label={t('auth.confirmPassword')}
            value={values.confirmPassword}
            onChangeText={(v) => update('confirmPassword', v)}
            secureTextEntry
            autoCapitalize="none"
            error={touched && errors.confirmPassword ? t(`auth.errors.${errors.confirmPassword}`) : undefined}
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
            disabled={isSubmitting}
            className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
              isSubmitting ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
            }`}
          >
            {isSubmitting ? <ActivityIndicator color="#ffffff" /> : null}
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              {isSubmitting ? t('auth.signingUp') : t('auth.signUp')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
