import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { requestPasswordReset, resetPasswordWithCode } from '@/features/auth/api';
import {
  isPasswordChangeFormValid,
  isValidEmail,
  isValidOtpCode,
  normalizeOtpCode,
  validatePasswordChangeForm,
} from '@/features/auth/validation';
import { useLanguage } from '@/i18n/use-language';
import { friendlyErrorKey } from '@/lib/user-errors';

/** Mot de passe oublié : 1) saisir l'e-mail, 2) saisir le code reçu et choisir un nouveau mot de passe. */
export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const passwordErrors = validatePasswordChangeForm({ password, confirmPassword });

  async function handleSendCode() {
    setError(null);
    setInfo(null);
    if (!isValidEmail(email)) {
      setError(t('auth.errors.invalid_email'));
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setStep('code');
      setInfo(t('auth.forgot.codeSent'));
    } catch (err) {
      // Message volontairement générique : on ne révèle pas si l'adresse correspond à un compte.
      setError(t(friendlyErrorKey(err, 'auth.forgot.sendError')));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setTouched(true);
    setError(null);
    setInfo(null);
    if (!isValidOtpCode(code)) {
      setError(t('auth.invalidCode'));
      return;
    }
    if (!isPasswordChangeFormValid(passwordErrors)) return;

    setBusy(true);
    try {
      await resetPasswordWithCode(email, code, password);
      router.replace('/');
    } catch {
      setError(t('auth.forgot.resetError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    try {
      await requestPasswordReset(email);
      setInfo(t('auth.codeResent'));
    } catch {
      setError(t('auth.forgot.sendError'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={t('auth.forgot.title')}
          subtitle={step === 'email' ? t('auth.forgot.subtitleEmail') : t('auth.forgot.subtitleCode')}
          showBack
        />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          {step === 'email' ? (
            <>
              <TextField
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
              {error ? (
                <ThemedText type="small" style={{ color: '#DC2626' }}>
                  {error}
                </ThemedText>
              ) : null}
              <Button
                label={busy ? t('auth.forgot.sending') : t('auth.forgot.sendCode')}
                onPress={handleSendCode}
                disabled={busy || !email}
                loading={busy}
              />
            </>
          ) : (
            <>
              {info ? (
                <ThemedText type="small" themeColor="primary">
                  {info}
                </ThemedText>
              ) : null}
              <TextField
                label={t('auth.forgot.codeLabel')}
                value={code}
                onChangeText={(v) => setCode(normalizeOtpCode(v))}
                keyboardType="number-pad"
                placeholder="123456"
              />
              <TextField
                label={t('auth.forgot.newPassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                error={touched && passwordErrors.password ? t(`auth.errors.${passwordErrors.password}`) : undefined}
              />
              <TextField
                label={t('auth.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                error={touched && passwordErrors.confirmPassword ? t(`auth.errors.${passwordErrors.confirmPassword}`) : undefined}
              />
              {error ? (
                <ThemedText type="small" style={{ color: '#DC2626' }}>
                  {error}
                </ThemedText>
              ) : null}
              <Button
                label={busy ? t('auth.forgot.resetting') : t('auth.forgot.reset')}
                onPress={handleReset}
                disabled={busy}
                loading={busy}
              />
              <View className="items-center">
                <Pressable onPress={handleResend} className="py-2">
                  <ThemedText type="small" themeColor="primary">
                    {t('auth.resendCode')}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
