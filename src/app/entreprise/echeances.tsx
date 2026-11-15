import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField, InfoBanner, SAVE_BAR_SPACE, SaveBar, SectionLabel } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedView } from '@/components/themed-view';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { HText } from '@/features/dashboard/home-ui';
import { useDueRules, useSaveDueRules } from '@/features/due-rules/hooks';
import { changedKinds, draftFromRules, toRule, validateRuleDraft, type RuleDraft } from '@/features/due-rules/logic';
import { LEGAL_RULE_KINDS, MAINTENANCE_RULE_KINDS, type DueRule, type DueRuleKind } from '@/features/due-rules/types';
import { useLanguage } from '@/i18n/use-language';

function Switch({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <Pressable onPress={() => onChange(!on)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} style={{ minHeight: 44, minWidth: 56, justifyContent: 'center' }}>
      <View style={{ width: 52, height: 30, borderRadius: 15, backgroundColor: on ? Brand.orange : Palette.border, padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.white }} />
      </View>
    </Pressable>
  );
}

/**
 * Règles d'échéances de l'agence : quoi surveiller et à quel rythme. Les entretiens activés sont créés « À compléter » à l'ajout d'un véhicule
 * (jamais de date inventée). Les valeurs proposées sont INDICATIVES : les préconisations du constructeur et l'état réel du véhicule priment.
 * Propriétaire et responsables seulement ; une seule barre d'enregistrement.
 */
export default function DueRulesScreen() {
  const { t } = useLanguage();
  const { rules, isLoading } = useDueRules();
  if (isLoading) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('dueRules.title')} showBack />
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={Palette.primary} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }
  return <DueRulesForm rules={rules} />;
}

function DueRulesForm({ rules }: { rules: DueRule[] }) {
  const { t } = useLanguage();
  const agency = useMyAgency();
  const save = useSaveDueRules();
  const canEdit = agency.data?.role === 'owner' || agency.data?.role === 'manager';
  const [initial, setInitial] = useState<RuleDraft>(() => draftFromRules(rules));
  const [draft, setDraft] = useState<RuleDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validateRuleDraft(draft);
  const changed = changedKinds(initial, draft);
  const set = (kind: DueRuleKind, patch: Partial<RuleDraft[DueRuleKind]>) => setDraft({ ...draft, [kind]: { ...draft[kind], ...patch } });

  function persist() {
    setSubmitted(true);
    setError(null);
    if (Object.keys(errors).length > 0 || !agency.data || !draft) return;
    const current = draft;
    save.mutate(
      { agencyId: agency.data.agencyId, rules: changed.map((kind) => toRule(kind, current)) },
      { onSuccess: () => { setInitial(current); setSubmitted(false); }, onError: () => setError(t('dueRules.saveError')) }
    );
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('dueRules.title')} showBack />
        <ScrollView contentContainerStyle={{ gap: 20, paddingHorizontal: 24, paddingBottom: SAVE_BAR_SPACE + 24 }} keyboardShouldPersistTaps="handled">
          <InfoBanner strong={t('dueRules.bannerStrong')} muted={t('dueRules.bannerMuted')} />
          {!canEdit ? (
            <HText size={13} color={Palette.textSecondary}>
              {t('dueRules.readOnly')}
            </HText>
          ) : null}

          <View style={{ gap: 12 }}>
            <SectionLabel>{t('dueRules.maintenance')}</SectionLabel>
            {MAINTENANCE_RULE_KINDS.map((kind) => (
              <View key={kind} style={{ gap: 12, borderRadius: 20, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <HText weight="bold" size={16} style={{ flex: 1 }}>
                    {t(`maintenance.types.${kind}`)}
                  </HText>
                  {canEdit ? <Switch on={draft[kind].enabled} onChange={(on) => set(kind, { enabled: on })} label={t(`dueRules.switch`, { name: t(`maintenance.types.${kind}`) })} /> : <HText size={13}>{t(draft[kind].enabled ? 'common.yes' : 'common.no')}</HText>}
                </View>
                {draft[kind].enabled ? (
                  <>
                    <FormField label={t('dueRules.everyKm')} value={draft[kind].km} onChangeText={(value) => set(kind, { km: value.replace(/\D/g, '') })} thousands unit="km" placeholder={t('dueRules.none')} locked={!canEdit} lockedReason={t('dueRules.readOnly')} error={submitted && errors[kind] === 'invalid_km' ? t('dueRules.errKm') : undefined} showError={submitted} />
                    <FormField label={t('dueRules.everyMonths')} value={draft[kind].months} onChangeText={(value) => set(kind, { months: value.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" unit={t('dueRules.months')} placeholder={t('dueRules.none')} locked={!canEdit} lockedReason={t('dueRules.readOnly')} error={submitted && errors[kind] === 'invalid_months' ? t('dueRules.errMonths') : undefined} showError={submitted} />
                  </>
                ) : (
                  <HText size={12} color={Palette.textSecondary}>
                    {t('dueRules.off')}
                  </HText>
                )}
              </View>
            ))}
          </View>

          <View style={{ gap: 12 }}>
            <SectionLabel>{t('dueRules.legal')}</SectionLabel>
            <HText size={12} color={Palette.textSecondary}>
              {t('dueRules.legalHint')}
            </HText>
            {LEGAL_RULE_KINDS.map((kind) => (
              <View key={kind} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, paddingHorizontal: 16, paddingVertical: 8 }}>
                <HText weight="bold" size={15} style={{ flex: 1 }}>
                  {t(`vehicleDetail.compliance.kind.${kind}`)}
                </HText>
                {canEdit ? <Switch on={draft[kind].enabled} onChange={(on) => set(kind, { enabled: on })} label={t('dueRules.switch', { name: t(`vehicleDetail.compliance.kind.${kind}`) })} /> : <HText size={13}>{t(draft[kind].enabled ? 'common.yes' : 'common.no')}</HText>}
              </View>
            ))}
          </View>

          {error ? (
            <HText size={13} weight="semibold" color={Palette.error} accessibilityRole="alert">
              {error}
            </HText>
          ) : null}
        </ScrollView>
        {canEdit ? (
          <SaveBar
            changes={changed.map((kind) => (MAINTENANCE_RULE_KINDS.includes(kind) ? t(`maintenance.types.${kind}`) : t(`vehicleDetail.compliance.kind.${kind}`)))}
            onSave={persist}
            onCancel={() => { setDraft(initial); setSubmitted(false); setError(null); }}
            busy={save.isPending}
          />
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}
