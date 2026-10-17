import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Redirect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useAgencyDetails, useMyAgency } from '@/features/agency/hooks';
import { generateContractPdf } from '@/features/contracts/contract-pdf';
import { sampleContract } from '@/features/contracts/sample-contract';
import type { Block, ContractTemplate } from '@/features/contracts/template';
import { analyzeContractFiles, templateErrorMessageKey, type TemplateSourceFile } from '@/features/contracts/template-api';
import { useContractTemplate, useRemoveContractTemplate, useSaveContractTemplate } from '@/features/contracts/template-hooks';
import { OcrInactiveNotice } from '@/features/ocr/ocr-inactive-notice';
import { useOcrSettings } from '@/features/ocr/hooks';
import { useLanguage } from '@/i18n/use-language';

const MAX_FILES = 6;

type EditableText = { label: string; value: string; onChange: (value: string) => void };

/** Textes modifiables d'un bloc (pour corriger une erreur de lecture avant d'enregistrer). */
function editableTexts(block: Block, update: (next: Block) => void, t: (key: string, params?: Record<string, unknown>) => string): EditableText[] {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return [{ label: block.type === 'heading' ? t('contractTemplate.fieldTitle') : t('contractTemplate.fieldText'), value: block.text, onChange: (text) => update({ ...block, text } as Block) }];
    case 'list':
      return [{ label: t('contractTemplate.fieldList'), value: block.items.join('\n'), onChange: (text) => update({ ...block, items: text.split('\n').filter((line) => line.trim()) } as Block) }];
    case 'columns':
      return block.cells.flatMap((cell, index) => [
        ...(cell.title !== undefined
          ? [{ label: t('contractTemplate.fieldColumnTitle', { n: index + 1 }), value: cell.title, onChange: (title: string) => update({ ...block, cells: block.cells.map((c, i) => (i === index ? { ...c, title } : c)) } as Block) }]
          : []),
        { label: t('contractTemplate.fieldColumn', { n: index + 1 }), value: cell.text, onChange: (text: string) => update({ ...block, cells: block.cells.map((c, i) => (i === index ? { ...c, text } : c)) } as Block) },
      ]);
    default:
      return [];
  }
}

export default function ModeleContratScreen() {
  const { t, language } = useLanguage();
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const isOwner = agencyQuery.data?.role === 'owner';
  const detailsQuery = useAgencyDetails(agencyId);
  const stored = useContractTemplate(agencyId);
  const ocr = useOcrSettings();
  const save = useSaveContractTemplate(agencyId);
  const remove = useRemoveContractTemplate(agencyId);

  const [files, setFiles] = useState<TemplateSourceFile[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<ContractTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  if (agencyQuery.data && !isOwner) return <Redirect href="/entreprise" />;

  const active = ocr.availability === 'active';

  function addFile(file: TemplateSourceFile) {
    setFiles((current) => (current.length >= MAX_FILES ? current : [...current, file]));
  }

  async function pickImage(source: 'camera' | 'library') {
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: MAX_FILES });
    if (result.canceled) return;
    for (const asset of result.assets) {
      addFile({ uri: asset.uri, mimeType: asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg', name: asset.fileName ?? undefined });
    }
  }

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    addFile({ uri: result.assets[0].uri, mimeType: 'application/pdf', name: result.assets[0].name });
  }

  async function handleAnalyze() {
    if (files.length === 0) return;
    setError(null);
    setErrorDetail(null);
    setAnalyzing(true);
    const result = await analyzeContractFiles(files);
    setAnalyzing(false);
    if (result.ok) setDraft(result.template);
    else {
      setError(t(templateErrorMessageKey(result.error)));
      setErrorDetail(result.detail ?? null);
    }
  }

  async function handlePreview() {
    if (!draft && !stored.data) return;
    setPreviewing(true);
    try {
      const details = detailsQuery.data;
      const uri = await generateContractPdf(
        sampleContract(),
        { nom: details?.nom ?? agencyQuery.data?.agencyName ?? '', raisonSociale: details?.raisonSociale, adresse: details?.adresse, ville: details?.ville, telephone: details?.telephone, email: details?.email },
        {},
        draft ?? stored.data?.template
      );
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch {
      Alert.alert(t('common.appName'), t('contract.pdfError'));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    try {
      await save.mutateAsync({ template: draft, sourceName: files[0]?.name ?? null });
      setDraft(null);
      setFiles([]);
      Alert.alert(t('common.appName'), t('contractTemplate.saved'));
    } catch {
      setError(t('contractTemplate.saveError'));
    }
  }

  function handleRemove() {
    Alert.alert(t('contractTemplate.removeTitle'), t('contractTemplate.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('contractTemplate.remove'), style: 'destructive', onPress: () => remove.mutate(undefined, { onError: () => setError(t('contractTemplate.saveError')) }) },
    ]);
  }

  function updateBlock(index: number, next: Block) {
    setDraft((current) => (current ? { ...current, blocks: current.blocks.map((block, i) => (i === index ? next : block)) } : current));
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('contractTemplate.title')} subtitle={t('contractTemplate.subtitle')} showBack />
        {stored.isLoading || agencyQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-4 px-6 pb-12" keyboardShouldPersistTaps="handled">
            <Card className="gap-2">
              <ThemedText type="smallBold">{stored.data ? t('contractTemplate.statusCustom') : t('contractTemplate.statusDefault')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {stored.data
                  ? t('contractTemplate.statusCustomHelp', {
                      name: stored.data.sourceName ?? '—',
                      date: new Date(stored.data.updatedAt).toLocaleDateString(language === 'ar' ? 'ar' : 'fr-FR'),
                    })
                  : t('contractTemplate.statusDefaultHelp')}
              </ThemedText>
              <View className="flex-row flex-wrap gap-2">
                {stored.data ? <Button label={t('contractTemplate.preview')} variant="secondary" size="sm" onPress={handlePreview} loading={previewing} disabled={previewing} /> : null}
                {stored.data ? <Button label={t('contractTemplate.remove')} variant="ghost" size="sm" onPress={handleRemove} disabled={remove.isPending} /> : null}
              </View>
            </Card>

            {!draft ? (
              <View className="gap-3">
                <ThemedText type="smallBold">{t('contractTemplate.uploadTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('contractTemplate.uploadHelp')}
                </ThemedText>
                {!active ? (
                  <OcrInactiveNotice availability={ocr.availability} />
                ) : (
                  <>
                    <View className="flex-row flex-wrap gap-2">
                      <Button label={t('contractTemplate.addPhoto')} variant="secondary" size="sm" onPress={() => pickImage('camera')} disabled={analyzing || files.length >= MAX_FILES} />
                      <Button label={t('common.gallery')} variant="secondary" size="sm" onPress={() => pickImage('library')} disabled={analyzing || files.length >= MAX_FILES} />
                      <Button label={t('contractTemplate.addPdf')} variant="secondary" size="sm" onPress={pickPdf} disabled={analyzing || files.length >= MAX_FILES} />
                    </View>
                    {files.map((file, index) => (
                      <Card key={`${file.uri}-${index}`} padded={false} className="flex-row items-center justify-between px-4 py-3">
                        <ThemedText type="small" style={{ flex: 1 }} numberOfLines={1}>
                          {file.mimeType === 'application/pdf' ? 'PDF' : t('contractTemplate.page')} {index + 1}
                          {file.name ? ` · ${file.name}` : ''}
                        </ThemedText>
                        <Button label={t('contractTemplate.removeFile')} variant="ghost" size="sm" disabled={analyzing} onPress={() => setFiles((current) => current.filter((_, i) => i !== index))} />
                      </Card>
                    ))}
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                      {t('contractTemplate.privacy')}
                    </ThemedText>
                    {analyzing ? (
                      <View className="flex-row items-center gap-3">
                        <ActivityIndicator color={M3akPalette.mauve} />
                        <ThemedText type="small" style={{ flex: 1 }}>
                          {t('contractTemplate.analyzing')}
                        </ThemedText>
                      </View>
                    ) : null}
                    <Button label={t('contractTemplate.analyze')} onPress={handleAnalyze} disabled={files.length === 0 || analyzing} loading={analyzing} />
                  </>
                )}
              </View>
            ) : (
              <View className="gap-4">
                <ThemedText type="smallBold">{t('contractTemplate.reviewTitle')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('contractTemplate.reviewHelp')}
                </ThemedText>
                <View className="flex-row flex-wrap gap-2">
                  <Button label={t('contractTemplate.preview')} variant="secondary" size="sm" onPress={handlePreview} loading={previewing} disabled={previewing} />
                </View>
                {draft.blocks.map((block, index) =>
                  editableTexts(block, (next) => updateBlock(index, next), t).map((field, fieldIndex) => (
                    <TextField key={`${index}-${fieldIndex}`} label={field.label} value={field.value} onChangeText={field.onChange} multiline />
                  ))
                )}
                <Button label={t('contractTemplate.save')} onPress={handleSave} disabled={save.isPending} loading={save.isPending} />
                <Button label={t('contractTemplate.restart')} variant="ghost" onPress={() => setDraft(null)} disabled={save.isPending} />
              </View>
            )}

            {error ? (
              <View className="gap-1">
                <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                  {error}
                </ThemedText>
                {errorDetail ? (
                  <ThemedText type="small" themeColor="textSecondary" selectable style={{ fontSize: 11 }}>
                    {t('contractTemplate.supportDetail', { detail: errorDetail.slice(0, 200) })}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
