import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useCreateAgencyInvite, useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { inviteErrorKey } from '@/features/agency/invite-errors';
import { InviteResultCard } from '@/features/agency/invite-result-card';
import { isInviteFormValid, validateInviteForm, type InviteFormValues } from '@/features/agency/invite-validation';
import { INVITABLE_ROLES, type AgencyRole, type InviteResult } from '@/features/agency/types';
import { useBranches } from '@/features/branches/hooks';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_VALUES: InviteFormValues = { prenom: '', nom: '', email: '', role: 'employee' };

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-2 ${
        selected ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-[#EAE5F2] bg-white'
      }`}
    >
      <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#211A2E' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function InviterScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const profileQuery = useMyProfile(agencyId);
  const branchesQuery = useBranches(agencyId);
  const createInvite = useCreateAgencyInvite();

  const [values, setValues] = useState<InviteFormValues>(EMPTY_VALUES);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const isOwner = agencyQuery.data?.role === 'owner';
  const canInvite = isOwner || agencyQuery.data?.role === 'manager';
  const profileReady = !!profileQuery.data;
  // Membre rattaché à une filiale (hors admin) : il invite uniquement dans SA filiale.
  const myBranchId = isOwner ? null : (profileQuery.data?.branchId ?? null);
  const branches = branchesQuery.data ?? [];
  const myBranchName = myBranchId ? (branches.find((b) => b.id === myBranchId)?.nom ?? null) : null;

  const errors = validateInviteForm(values);

  function update<K extends keyof InviteFormValues>(key: K, value: InviteFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setTouched(true);
    setSubmitError(null);
    if (!agencyId || !profileReady || !isInviteFormValid(errors)) return;

    try {
      const created = await createInvite.mutateAsync({
        agencyId,
        email: values.email.trim().toLowerCase(),
        prenom: values.prenom.trim(),
        nom: values.nom.trim(),
        role: values.role,
        branchId: myBranchId ?? branchId,
      });
      setResult(created);
    } catch (error) {
      setSubmitError(t(inviteErrorKey(error)));
    }
  }

  function fieldError(field: 'prenom' | 'nom' | 'email') {
    const code = errors[field];
    return touched && code ? t(`auth.errors.${code}`) : undefined;
  }

  if (agencyQuery.data && !canInvite) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('equipe.invite.title')} showBack />
          <ThemedText className="px-6" themeColor="textSecondary">
            {t('equipe.invite.notAllowed')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('equipe.invite.title')} subtitle={t('equipe.invite.subtitle')} showBack />
        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          {result ? (
            <InviteResultCard result={result} onDone={() => router.back()} />
          ) : (
            <>
              <TextField
                label={t('auth.prenom')}
                value={values.prenom}
                onChangeText={(v) => update('prenom', v)}
                autoComplete="given-name"
                error={fieldError('prenom')}
              />
              <TextField
                label={t('auth.nom')}
                value={values.nom}
                onChangeText={(v) => update('nom', v)}
                autoComplete="family-name"
                error={fieldError('nom')}
              />
              <TextField
                label={t('auth.email')}
                value={values.email}
                onChangeText={(v) => update('email', v)}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                error={fieldError('email')}
              />

              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('equipe.invite.role')}
                </ThemedText>
                <View className="flex-row flex-wrap gap-2">
                  {INVITABLE_ROLES.map((role: AgencyRole) => (
                    <Chip
                      key={role}
                      label={t(`equipe.roles.${role}`)}
                      selected={values.role === role}
                      onPress={() => update('role', role)}
                    />
                  ))}
                </View>
              </View>

              {profileReady ? (
                myBranchId ? (
                  <View className="gap-1.5">
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('equipe.invite.branch')}
                    </ThemedText>
                    <ThemedText type="small">
                      {myBranchName ?? t('equipe.invite.yourBranch')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('equipe.invite.yourBranchHint')}
                    </ThemedText>
                  </View>
                ) : branches.length > 0 ? (
                  <View className="gap-1.5">
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('equipe.invite.branch')}
                    </ThemedText>
                    <View className="flex-row flex-wrap gap-2">
                      <Chip
                        label={t('equipe.invite.allAgency')}
                        selected={branchId === null}
                        onPress={() => setBranchId(null)}
                      />
                      {branches.map((branch) => (
                        <Chip
                          key={branch.id}
                          label={branch.nom}
                          selected={branchId === branch.id}
                          onPress={() => setBranchId(branch.id)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null
              ) : null}

              <ThemedText type="small" themeColor="textSecondary">
                {t('equipe.invite.emailBinding')}
              </ThemedText>

              {submitError ? (
                <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                  {submitError}
                </ThemedText>
              ) : null}

              <Button
                label={createInvite.isPending ? t('equipe.invite.sending') : t('equipe.invite.send')}
                onPress={handleSubmit}
                disabled={createInvite.isPending || !profileReady}
                loading={createInvite.isPending}
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
