import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { resendSignupCode, signUpWithEmail, verifySignupCode } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-context';
import {
  isSignupFormValid,
  isValidOtpCode,
  normalizeOtpCode,
  validateSignupForm,
  type SignupFormValues,
} from '@/features/auth/validation';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_VALUES: SignupFormValues = { email: '', password: '', confirmPassword: '' };

export default function SignupScreen() {
  const { session } = useSession();
  const { t } = useLanguage();
  const [values, setValues] = useState<SignupFormValues>(EMPTY_VALUES);
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

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
        setAwaitingCode(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify() {
    setVerifyError(null);
    if (!isValidOtpCode(code)) {
      setVerifyError(t('auth.invalidCode'));
      return;
    }

    setIsVerifying(true);
    try {
      await verifySignupCode(values.email.trim(), code);
      router.replace('/onboarding');
    } catch {
      setVerifyError(t('auth.invalidCode'));
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    setResendMessage(null);
    try {
      await resendSignupCode(values.email.trim());
      setResendMessage(t('auth.codeResent'));
    } catch {
      setVerifyError(t('auth.genericError'));
    }
  }

  if (session) {
    return <Redirect href="/accueil" />;
  }

  if (awaitingCode) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('auth.confirmEmailTitle')} subtitle={t('auth.confirmEmailBody')} />

          <View className="gap-4 px-6">
            <TextField
              label={t('auth.code')}
              value={code}
              onChangeText={(v) => setCode(normalizeOtpCode(v))}
              keyboardType="number-pad"
              placeholder="123456"
              error={verifyError ?? undefined}
            />

            {resendMessage ? (
              <ThemedText type="small" themeColor="primary">
                {resendMessage}
              </ThemedText>
            ) : null}

            <Pressable
              onPress={handleVerify}
              disabled={isVerifying}
              className={`flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
                isVerifying ? 'bg-[#9aa3bd]' : 'bg-[#1f5eff]'
              }`}
            >
              {isVerifying ? <ActivityIndicator color="#ffffff" /> : null}
              <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
                {isVerifying ? t('auth.verifying') : t('auth.verify')}
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleResend} className="items-center py-2">
              <ThemedText type="small" themeColor="primary">
                {t('auth.resendCode')}
              </ThemedText>
            </Pressable>
          </View>
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
