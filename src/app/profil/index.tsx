import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency, useMyProfile, useUpdateMyProfile, useUploadMemberAvatar } from '@/features/agency/hooks';
import type { MemberProfile } from '@/features/agency/types';
import { signOut, updateMyPassword } from '@/features/auth/api';
import { isPasswordChangeFormValid, validatePasswordChangeForm } from '@/features/auth/validation';
import { unregisterThisDevice } from '@/features/notifications/push';
import { NotificationSettings } from '@/features/notifications/notification-settings';
import { useRemoveMySignature, useSignature } from '@/features/signatures/hooks';
import { SignatureView } from '@/features/signatures/signature-pad';
import { getInitials } from '@/lib/initials';
import { useLanguage } from '@/i18n/use-language';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function pickImage(source: 'library' | 'camera'): Promise<string | null> {
  const permission =
    source === 'library'
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result =
    source === 'library'
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchCameraAsync({ quality: 0.7 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

export default function ProfilScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const profileQuery = useMyProfile(agencyQuery.data?.agencyId);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('profil.title')} showBack />

        {profileQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : !profileQuery.data ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('profil.loadError')}
            </ThemedText>
          </View>
        ) : (
          <ProfilForm agencyId={agencyQuery.data?.agencyId} profile={profileQuery.data} />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function ProfilForm({ agencyId, profile }: { agencyId: string | undefined; profile: MemberProfile }) {
  const { t } = useLanguage();
  const updateProfile = useUpdateMyProfile(agencyId);
  const uploadAvatar = useUploadMemberAvatar(agencyId);
  const signatureQuery = useSignature(profile.signaturePath);
  const removeSignature = useRemoveMySignature(agencyId);

  const [prenom, setPrenom] = useState(profile.prenom ?? '');
  const [nom, setNom] = useState(profile.nom ?? '');
  const [profileTouched, setProfileTouched] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const passwordErrors = validatePasswordChangeForm({ password, confirmPassword });

  async function handlePickAvatar(source: 'library' | 'camera') {
    const uri = await pickImage(source);
    if (!uri) return;
    try {
      await uploadAvatar.mutateAsync({ memberId: profile.id, localUri: uri });
    } catch {
      Alert.alert(t('common.appName'), t('profil.avatarError'));
    }
  }

  async function handleSaveProfile() {
    setProfileTouched(true);
    setProfileError(null);
    setProfileSuccess(false);
    if (!prenom.trim() || !nom.trim()) return;

    try {
      await updateProfile.mutateAsync({ memberId: profile.id, input: { prenom, nom } });
      setProfileSuccess(true);
    } catch {
      setProfileError(t('profil.updateError'));
    }
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!isPasswordChangeFormValid(passwordErrors)) return;

    setIsChangingPassword(true);
    try {
      await updateMyPassword(password);
      setPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
    } catch {
      setPasswordError(t('profil.passwordError'));
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <ScrollView contentContainerClassName="gap-6 px-6 pb-10" keyboardShouldPersistTaps="handled">
      <View className="items-center gap-3">
        <Avatar path={profile.photoPath} size={96} initials={getInitials(profile.nomComplet)} />
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handlePickAvatar('camera')}
            className="rounded-full border border-[#EAE5F2] bg-white px-4 py-2"
          >
            <ThemedText type="small">{t('common.camera')}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handlePickAvatar('library')}
            className="rounded-full border border-[#EAE5F2] bg-white px-4 py-2"
          >
            <ThemedText type="small">{t('common.gallery')}</ThemedText>
          </Pressable>
        </View>
        {uploadAvatar.isPending ? <ActivityIndicator color={M3akPalette.mauve} /> : null}
      </View>

      <Card padded={false} className="px-4">
        <View className="flex-row items-center justify-between border-b border-[#EAE5F2] py-3">
          <ThemedText type="default" themeColor="textSecondary">
            {t('profil.fields.type')}
          </ThemedText>
          <ThemedText type="smallBold">{t(`equipe.roles.${profile.role}`)}</ThemedText>
        </View>
        {profile.branchNom ? (
          <View className="flex-row items-center justify-between border-b border-[#EAE5F2] py-3">
            <ThemedText type="default" themeColor="textSecondary">
              {t('profil.fields.branch')}
            </ThemedText>
            <ThemedText type="smallBold">{profile.branchNom}</ThemedText>
          </View>
        ) : null}
        <View className="flex-row items-center justify-between py-3">
          <ThemedText type="default" themeColor="textSecondary">
            {t('profil.fields.startDate')}
          </ThemedText>
          <ThemedText type="smallBold">{formatDate(profile.createdAt)}</ThemedText>
        </View>
      </Card>

      <View className="gap-4">
        <ThemedText type="smallBold">{t('profil.sections.info')}</ThemedText>
        <TextField
          label={t('profil.fields.prenom')}
          value={prenom}
          onChangeText={setPrenom}
          error={profileTouched && !prenom.trim() ? t('profil.errors.required') : undefined}
        />
        <TextField
          label={t('profil.fields.nom')}
          value={nom}
          onChangeText={setNom}
          error={profileTouched && !nom.trim() ? t('profil.errors.required') : undefined}
        />
        {profileError ? (
          <ThemedText type="small" style={{ color: M3akPalette.danger }}>
            {profileError}
          </ThemedText>
        ) : null}
        {profileSuccess ? (
          <ThemedText type="small" style={{ color: M3akPalette.success }}>
            {t('profil.updateSuccess')}
          </ThemedText>
        ) : null}
        <Button
          label={updateProfile.isPending ? t('profil.saving') : t('profil.save')}
          onPress={handleSaveProfile}
          disabled={updateProfile.isPending}
          loading={updateProfile.isPending}
        />
      </View>

      <View className="gap-3">
        <ThemedText type="smallBold">{t('profil.signature.section')}</ThemedText>
        <Card className="items-center gap-3">
          {profile.signaturePath && signatureQuery.data ? (
            <SignatureView signature={signatureQuery.data} />
          ) : profile.signaturePath && signatureQuery.isLoading ? (
            <ActivityIndicator color={M3akPalette.mauve} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" className="text-center">
              {t('profil.signature.none')}
            </ThemedText>
          )}
          <Button
            label={profile.signaturePath ? t('profil.signature.change') : t('profil.signature.add')}
            variant="secondary"
            onPress={() => router.push('/profil/signature')}
          />
          {profile.signaturePath ? (
            <Button
              label={t('profil.signature.remove')}
              variant="ghost"
              size="sm"
              disabled={removeSignature.isPending}
              onPress={() => removeSignature.mutate(profile.id, { onError: () => Alert.alert(t('common.appName'), t('profil.signature.saveError')) })}
            />
          ) : null}
        </Card>
      </View>

      <View className="gap-4">
        <ThemedText type="smallBold">{t('profil.sections.password')}</ThemedText>
        <TextField
          label={t('profil.fields.newPassword')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextField
          label={t('profil.fields.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        {passwordError ? (
          <ThemedText type="small" style={{ color: M3akPalette.danger }}>
            {passwordError}
          </ThemedText>
        ) : null}
        {passwordSuccess ? (
          <ThemedText type="small" style={{ color: M3akPalette.success }}>
            {t('profil.passwordSuccess')}
          </ThemedText>
        ) : null}
        <Button
          label={isChangingPassword ? t('profil.saving') : t('profil.changePassword')}
          variant="secondary"
          onPress={handleChangePassword}
          disabled={isChangingPassword || !password}
          loading={isChangingPassword}
        />
      </View>

      <NotificationSettings agencyId={agencyId} />

      <Button label={t('auth.signOut')} variant="danger" onPress={async () => {
          await unregisterThisDevice();
          await signOut();
        }} />
    </ScrollView>
  );
}
