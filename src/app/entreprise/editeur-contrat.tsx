import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { AGENCY_ASSETS_BUCKET } from '@/features/agency/api';
import { useAgencyDetails, useMyAgency } from '@/features/agency/hooks';
import {
  CLIENT_FIELD_KEYS,
  defaultOptions,
  LIMITS_OPTIONS,
  SECTION_KEYS,
  templateFromOptions,
  type ClientFieldKey,
  type ContractOptions,
  type SectionKey,
} from '@/features/contracts/contract-options';
import { generateBlankContractPdf, generateContractPdf } from '@/features/contracts/contract-pdf';
import { sampleContract } from '@/features/contracts/sample-contract';
import { downloadImageAsDataUri } from '@/features/storage/api';
import { useContractTemplate, useRemoveContractTemplate, useSaveContractOptions } from '@/features/contracts/template-hooks';
import { useLanguage } from '@/i18n/use-language';

const PREVIEW_LINES = ['{{agence_nom}}', '{{agence_adresse}}'];

function SwitchRow({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View className="flex-row items-center gap-3 py-2">
      <View style={{ flex: 1 }}>
        <ThemedText type="default">{label}</ThemedText>
        {help ? (
          <ThemedText type="small" themeColor="textSecondary">
            {help}
          </ThemedText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: M3akPalette.mauve, false: '#D9D2E6' }} />
    </View>
  );
}

function Section({ number, title, help, children }: { number: number; title: string; help?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-[#7C3AED]">
          <ThemedText type="smallBold" style={{ color: '#fff' }}>
            {number}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={{ flex: 1 }}>
          {title}
        </ThemedText>
      </View>
      {help ? (
        <ThemedText type="small" themeColor="textSecondary">
          {help}
        </ThemedText>
      ) : null}
      {children}
    </Card>
  );
}

/** Attend les réglages de l'agence (ou ceux de M3ak) avant d'ouvrir l'écran. */
export default function ReglagesContratScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const stored = useContractTemplate(agencyQuery.data?.agencyId);

  if (agencyQuery.data && agencyQuery.data.role !== 'owner') return <Redirect href="/entreprise" />;
  if (agencyQuery.isLoading || stored.isLoading || !agencyQuery.data) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('contractTemplate.simple.title')} showBack />
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }
  return <Settings agencyId={agencyQuery.data.agencyId} agencyName={agencyQuery.data.agencyName} initial={stored.data?.options ?? defaultOptions()} />;
}

function Settings({ agencyId, agencyName, initial }: { agencyId: string; agencyName: string; initial: ContractOptions }) {
  const { t } = useLanguage();
  const detailsQuery = useAgencyDetails(agencyId);
  const save = useSaveContractOptions(agencyId);
  const remove = useRemoveContractTemplate(agencyId);

  const [options, setOptions] = useState<ContractOptions>(initial);
  const [dirty, setDirty] = useState(false);
  const [newField, setNewField] = useState('');
  const [newNumber, setNewNumber] = useState({ label: '', value: '' });
  const [openCondition, setOpenCondition] = useState<number | null>(null);
  const [showFranchise, setShowFranchise] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change(update: (current: ContractOptions) => ContractOptions) {
    setOptions(update);
    setDirty(true);
  }
  const setClientField = (key: ClientFieldKey, value: boolean) => change((o) => ({ ...o, clientFields: { ...o.clientFields, [key]: value } }));
  const setSection = (key: SectionKey, value: boolean) => change((o) => ({ ...o, sections: { ...o.sections, [key]: value } }));

  function addExtraField() {
    const name = newField.trim();
    if (!name) return;
    if (options.extraFields.length >= LIMITS_OPTIONS.extraFields) {
      Alert.alert(t('common.appName'), t('contractTemplate.simple.extraLimit'));
      return;
    }
    change((o) => ({ ...o, extraFields: [...o.extraFields, name.slice(0, LIMITS_OPTIONS.label)] }));
    setNewField('');
  }

  function addLegalNumber() {
    const label = newNumber.label.trim();
    const value = newNumber.value.trim();
    if (!label || !value) return;
    if (options.legal.extra.length >= LIMITS_OPTIONS.extraNumbers) {
      Alert.alert(t('common.appName'), t('contractTemplate.simple.numberLimit'));
      return;
    }
    change((o) => ({ ...o, legal: { ...o.legal, extra: [...o.legal.extra, { label, value }] } }));
    setNewNumber({ label: '', value: '' });
  }

  function updateCondition(index: number, patch: Partial<ContractOptions['conditions'][number]>) {
    change((o) => ({ ...o, conditions: o.conditions.map((condition, i) => (i === index ? { ...condition, ...patch } : condition)) }));
  }

  function removeCondition(index: number) {
    Alert.alert(t('contractTemplate.simple.removeConditionTitle'), t('contractTemplate.simple.removeConditionBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('contractTemplate.simple.remove'),
        style: 'destructive',
        onPress: () => {
          change((o) => ({ ...o, conditions: o.conditions.filter((_, i) => i !== index) }));
          setOpenCondition(null);
        },
      },
    ]);
  }

  function addCondition() {
    if (options.conditions.length >= LIMITS_OPTIONS.conditions) return;
    change((o) => ({ ...o, conditions: [...o.conditions, { titleFr: '', textFr: '', titleAr: '', textAr: '' }] }));
    setOpenCondition(options.conditions.length);
  }

  async function runPreview(kind: 'example' | 'blank') {
    setPreviewing(true);
    try {
      const details = detailsQuery.data;
      const agency = { nom: details?.nom ?? agencyName, raisonSociale: details?.raisonSociale, adresse: details?.adresse, ville: details?.ville, telephone: details?.telephone, email: details?.email };
      const template = templateFromOptions(options, PREVIEW_LINES);
      const logoDataUri = await downloadImageAsDataUri(AGENCY_ASSETS_BUCKET, details?.logoUrl).catch(() => null);
      const uri =
        kind === 'blank'
          ? await generateBlankContractPdf(agency, template, logoDataUri)
          : await generateContractPdf(sampleContract(), agency, { logoDataUri }, template, { kmDepart: 12000, carburantDepart: 100 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch {
      Alert.alert(t('common.appName'), t('contract.pdfError'));
    } finally {
      setPreviewing(false);
    }
  }

  function handlePreview() {
    Alert.alert(t('contractTemplate.previewTitle'), t('contractTemplate.previewBody'), [
      { text: t('contractTemplate.previewBlank'), onPress: () => runPreview('blank') },
      { text: t('contractTemplate.previewExample'), onPress: () => runPreview('example') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  function handleReset() {
    Alert.alert(t('contractTemplate.simple.resetTitle'), t('contractTemplate.simple.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('contractTemplate.simple.reset'),
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync();
            setOptions(defaultOptions());
            setDirty(false);
            setOpenCondition(null);
          } catch {
            setError(t('contractTemplate.saveError'));
          }
        },
      },
    ]);
  }

  async function handleSave() {
    setError(null);
    try {
      await save.mutateAsync(options);
      setDirty(false);
      Alert.alert(t('common.appName'), t('contractTemplate.saved'), [{ text: t('profil.signature.ok'), onPress: () => router.back() }]);
    } catch {
      setError(t('contractTemplate.saveError'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('contractTemplate.simple.title')} subtitle={t('contractTemplate.simple.subtitle')} showBack />

        <ScrollView contentContainerClassName="gap-4 px-6 pb-8" keyboardShouldPersistTaps="handled">
          <View className="gap-1 rounded-2xl bg-[#EDE9FE] p-4">
            <ThemedText type="smallBold">{t('contractTemplate.simple.introTitle')}</ThemedText>
            <ThemedText type="small">{t('contractTemplate.simple.intro')}</ThemedText>
          </View>

          <Section number={1} title={t('contractTemplate.simple.legalTitle')} help={t('contractTemplate.simple.legalHelp')}>
            <TextField label={t('contractTemplate.simple.patente')} value={options.legal.patente} onChangeText={(patente) => change((o) => ({ ...o, legal: { ...o.legal, patente } }))} />
            <TextField label={t('contractTemplate.simple.rc')} value={options.legal.rc} onChangeText={(rc) => change((o) => ({ ...o, legal: { ...o.legal, rc } }))} />
            <TextField label={t('contractTemplate.simple.if')} value={options.legal.if} onChangeText={(value) => change((o) => ({ ...o, legal: { ...o.legal, if: value } }))} />
            <TextField label={t('contractTemplate.simple.cnss')} value={options.legal.cnss} onChangeText={(cnss) => change((o) => ({ ...o, legal: { ...o.legal, cnss } }))} />
            {options.legal.extra.map((item, index) => (
              <View key={`${item.label}-${index}`} className="flex-row items-center gap-2 rounded-2xl border border-[#EAE5F2] bg-[#FAF9FF] px-4 py-2">
                <ThemedText type="default" style={{ flex: 1 }}>
                  {item.label} : {item.value}
                </ThemedText>
                <Pressable accessibilityLabel={t('contractTemplate.simple.remove')} hitSlop={8} onPress={() => change((o) => ({ ...o, legal: { ...o.legal, extra: o.legal.extra.filter((_, i) => i !== index) } }))}>
                  <Ionicons name="trash-outline" size={20} color={M3akPalette.danger} />
                </Pressable>
              </View>
            ))}
            <ThemedText type="smallBold">{t('contractTemplate.simple.numberTitle')}</ThemedText>
            <TextField label={t('contractTemplate.simple.numberName')} placeholder={t('contractTemplate.simple.numberNamePlaceholder')} value={newNumber.label} onChangeText={(label) => setNewNumber((current) => ({ ...current, label }))} />
            <TextField label={t('contractTemplate.simple.numberValue')} value={newNumber.value} onChangeText={(value) => setNewNumber((current) => ({ ...current, value }))} />
            <Button label={t('contractTemplate.simple.numberAdd')} variant="secondary" size="sm" icon="add" onPress={addLegalNumber} disabled={!newNumber.label.trim() || !newNumber.value.trim()} />
          </Section>

          <Section number={2} title={t('contractTemplate.simple.clientTitle')} help={t('contractTemplate.simple.clientHelp')}>
            {CLIENT_FIELD_KEYS.map((key) => (
              <SwitchRow key={key} label={t(`contractTemplate.simple.clientFields.${key}`)} value={options.clientFields[key]} onChange={(value) => setClientField(key, value)} />
            ))}
          </Section>

          <Section number={3} title={t('contractTemplate.simple.sectionsTitle')} help={t('contractTemplate.simple.sectionsHelp')}>
            {SECTION_KEYS.map((key) => (
              <View key={key}>
                <SwitchRow label={t(`contractTemplate.simple.sections.${key}`)} value={options.sections[key]} onChange={(value) => setSection(key, value)} />
                {key === 'franchise' && options.sections.franchise ? (
                  <View className="gap-2 pb-2">
                    <Pressable onPress={() => setShowFranchise((open) => !open)} className="flex-row items-center gap-2">
                      <Ionicons name="create-outline" size={16} color={M3akPalette.mauve} />
                      <ThemedText type="small" themeColor="primary">
                        {showFranchise ? t('contractTemplate.simple.hideText') : t('contractTemplate.simple.editText')}
                      </ThemedText>
                    </Pressable>
                    {showFranchise ? <TextField value={options.franchiseText} onChangeText={(franchiseText) => change((o) => ({ ...o, franchiseText }))} multiline /> : null}
                  </View>
                ) : null}
              </View>
            ))}
          </Section>

          <Section number={4} title={t('contractTemplate.simple.extraTitle')} help={t('contractTemplate.simple.extraHelp')}>
            {options.extraFields.map((name, index) => (
              <View key={`${name}-${index}`} className="flex-row items-center gap-2 rounded-2xl border border-[#EAE5F2] bg-[#FAF9FF] px-4 py-2">
                <ThemedText type="default" style={{ flex: 1 }}>
                  {name}
                </ThemedText>
                <Pressable accessibilityLabel={t('contractTemplate.simple.remove')} hitSlop={8} onPress={() => change((o) => ({ ...o, extraFields: o.extraFields.filter((_, i) => i !== index) }))}>
                  <Ionicons name="trash-outline" size={20} color={M3akPalette.danger} />
                </Pressable>
              </View>
            ))}
            <TextField label={t('contractTemplate.simple.extraName')} placeholder={t('contractTemplate.simple.extraPlaceholder')} value={newField} onChangeText={setNewField} />
            <Button label={t('contractTemplate.simple.extraAdd')} variant="secondary" size="sm" icon="add" onPress={addExtraField} disabled={!newField.trim()} />
          </Section>

          {options.sections.conditions ? (
            <Section number={5} title={t('contractTemplate.simple.conditionsTitle')} help={t('contractTemplate.simple.conditionsHelp')}>
              {options.conditions.map((condition, index) => {
                const open = openCondition === index;
                return (
                  <View key={index} className="rounded-2xl border border-[#EAE5F2] bg-white">
                    <Pressable onPress={() => setOpenCondition(open ? null : index)} className="flex-row items-center gap-3 px-4 py-3">
                      <ThemedText type="smallBold" style={{ flex: 1 }} numberOfLines={1}>
                        {`${index + 1}. ${condition.titleFr || condition.titleAr || t('contractTemplate.simple.newCondition')}`}
                      </ThemedText>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#81778F" />
                    </Pressable>
                    {open ? (
                      <View className="gap-3 border-t border-[#EAE5F2] px-4 py-4">
                        <TextField label={t('contractTemplate.simple.conditionTitleFr')} value={condition.titleFr} onChangeText={(titleFr) => updateCondition(index, { titleFr })} />
                        <TextField label={t('contractTemplate.simple.conditionTextFr')} value={condition.textFr} onChangeText={(textFr) => updateCondition(index, { textFr })} multiline />
                        <TextField label={t('contractTemplate.simple.conditionTitleAr')} value={condition.titleAr} onChangeText={(titleAr) => updateCondition(index, { titleAr })} />
                        <TextField label={t('contractTemplate.simple.conditionTextAr')} value={condition.textAr} onChangeText={(textAr) => updateCondition(index, { textAr })} multiline />
                        <Button label={t('contractTemplate.simple.removeCondition')} variant="ghost" size="sm" icon="trash-outline" onPress={() => removeCondition(index)} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
              <Button label={t('contractTemplate.simple.addCondition')} variant="secondary" size="sm" icon="add" onPress={addCondition} />
            </Section>
          ) : null}

          <Button label={t('contractTemplate.simple.reset')} variant="ghost" size="sm" onPress={handleReset} disabled={remove.isPending} />
        </ScrollView>

        <View className="gap-2 border-t border-[#EAE5F2] bg-white px-6 py-3">
          {error ? (
            <ThemedText type="small" style={{ color: M3akPalette.danger }}>
              {error}
            </ThemedText>
          ) : dirty ? (
            <ThemedText type="small" style={{ color: M3akPalette.warning }}>
              {t('contractTemplate.simple.unsaved')}
            </ThemedText>
          ) : null}
          <View className="flex-row gap-3">
            <View style={{ flex: 1 }}>
              <Button label={t('contractTemplate.preview')} variant="secondary" icon="eye-outline" onPress={handlePreview} loading={previewing} disabled={previewing} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('contractTemplate.save')} onPress={handleSave} disabled={save.isPending || !dirty} loading={save.isPending} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
