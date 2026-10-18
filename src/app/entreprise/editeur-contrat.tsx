import { Redirect, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from 'react-native';
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
import { defaultEditableTemplate } from '@/features/contracts/default-template';
import { sampleContract } from '@/features/contracts/sample-contract';
import { ensureSignatures, PLACEHOLDERS, type Block, type ContractTemplate, type FieldRow } from '@/features/contracts/template';
import {
  ADDABLE_BLOCKS,
  addBlock,
  addRow,
  hasRows,
  moveBlock,
  moveRow,
  pruneEmptyBoxes,
  removeBlock,
  removeRow,
  updateBlock,
  updateRow,
} from '@/features/contracts/template-edit';
import { useContractTemplate, useSaveContractTemplate } from '@/features/contracts/template-hooks';
import { useLanguage } from '@/i18n/use-language';

type T = (key: string, params?: Record<string, unknown>) => string;

function IconButton({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className="h-8 w-8 items-center justify-center rounded-full border border-[#EAE5F2] bg-white"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <ThemedText type="smallBold" style={{ color: danger ? M3akPalette.danger : '#211A2E' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function RowEditor({ row, index, count, onChange, onMove, onRemove, onPickField, t }: {
  row: FieldRow;
  index: number;
  count: number;
  onChange: (patch: Partial<FieldRow>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onPickField: () => void;
  t: T;
}) {
  const auto = /^\{\{([a-z0-9_]+)\}\}$/.exec(row.value.trim())?.[1];
  return (
    <View className="gap-2 rounded-2xl border border-[#EAE5F2] p-3">
      <TextField label={t('contractTemplate.editor.fieldName')} value={row.label} onChangeText={(label) => onChange({ label })} />
      <View className="gap-1">
        <ThemedText type="small" themeColor="textSecondary">
          {t('contractTemplate.editor.fieldFilledWith')}
        </ThemedText>
        <ThemedText type="smallBold">
          {auto && (PLACEHOLDERS as readonly string[]).includes(auto)
            ? t(`contractTemplate.placeholders.${auto}`)
            : row.value.trim()
              ? row.value
              : t('contractTemplate.editor.byHand')}
        </ThemedText>
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        <Button label={t('contractTemplate.editor.chooseField')} variant="secondary" size="sm" onPress={onPickField} />
        <IconButton label="▲" onPress={() => onMove(-1)} disabled={index === 0} />
        <IconButton label="▼" onPress={() => onMove(1)} disabled={index === count - 1} />
        <IconButton label="✕" onPress={onRemove} danger />
      </View>
    </View>
  );
}

/** Attend le modèle de l'agence (ou le modèle standard) avant d'ouvrir l'éditeur. */
export default function EditeurContratScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const stored = useContractTemplate(agencyQuery.data?.agencyId);

  if (agencyQuery.data && agencyQuery.data.role !== 'owner') return <Redirect href="/entreprise" />;
  if (agencyQuery.isLoading || stored.isLoading || !agencyQuery.data) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('contractTemplate.editor.title')} showBack />
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }
  return <EditorBody agencyId={agencyQuery.data.agencyId} agencyName={agencyQuery.data.agencyName} initial={stored.data?.template ?? defaultEditableTemplate()} />;
}

function EditorBody({ agencyId, agencyName, initial }: { agencyId: string; agencyName: string; initial: ContractTemplate }) {
  const { t } = useLanguage();
  const detailsQuery = useAgencyDetails(agencyId);
  const save = useSaveContractTemplate(agencyId);

  const [template, setTemplate] = useState<ContractTemplate | null>(initial);
  const [picker, setPicker] = useState<{ block: number; row: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change(next: ContractTemplate | ((current: ContractTemplate) => ContractTemplate)) {
    setTemplate((current) => (current ? (typeof next === 'function' ? next(current) : next) : current));
  }

  function confirmRemoveBlock(index: number) {
    Alert.alert(t('contractTemplate.editor.removeBlockTitle'), t('contractTemplate.editor.removeBlockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('contractTemplate.editor.remove'), style: 'destructive', onPress: () => change((current) => removeBlock(current, index)) },
    ]);
  }

  function handleReset() {
    Alert.alert(t('contractTemplate.editor.resetTitle'), t('contractTemplate.editor.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('contractTemplate.editor.reset'), style: 'destructive', onPress: () => setTemplate(defaultEditableTemplate()) },
    ]);
  }

  async function handlePreview() {
    if (!template) return;
    setPreviewing(true);
    try {
      const details = detailsQuery.data;
      const uri = await generateContractPdf(
        sampleContract(),
        { nom: details?.nom ?? agencyName, raisonSociale: details?.raisonSociale, adresse: details?.adresse, ville: details?.ville, telephone: details?.telephone, email: details?.email },
        {},
        pruneEmptyBoxes(template),
        { kmDepart: 12000, carburantDepart: 100 }
      );
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch {
      Alert.alert(t('common.appName'), t('contract.pdfError'));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    if (!template) return;
    setError(null);
    try {
      await save.mutateAsync({ template: ensureSignatures(pruneEmptyBoxes(template)), sourceName: t('contractTemplate.editor.sourceName') });
      Alert.alert(t('common.appName'), t('contractTemplate.saved'), [{ text: t('profil.signature.ok'), onPress: () => router.back() }]);
    } catch {
      setError(t('contractTemplate.saveError'));
    }
  }

  function renderBlock(block: Block, index: number, current: ContractTemplate) {
    const set = (next: Block) => change((tpl) => updateBlock(tpl, index, next));
    const fields: React.ReactNode[] = [];

    if (block.type === 'heading' || block.type === 'paragraph') {
      fields.push(<TextField key="t" label={t('contractTemplate.fieldText')} value={block.text} onChangeText={(text) => set({ ...block, text })} multiline />);
    }
    if (block.type === 'list') {
      fields.push(<TextField key="l" label={t('contractTemplate.fieldList')} value={block.items.join('\n')} onChangeText={(text) => set({ ...block, items: text.split('\n').filter((line) => line.trim()) })} multiline />);
    }
    if (block.type === 'box') {
      fields.push(<TextField key="bt" label={t('contractTemplate.editor.boxTitle')} value={block.title ?? ''} onChangeText={(title) => set({ ...block, title })} />);
    }
    if (hasRows(block)) {
      block.rows.forEach((row, rowIndex) =>
        fields.push(
          <RowEditor
            key={`r${rowIndex}`}
            row={row}
            index={rowIndex}
            count={block.rows.length}
            t={t}
            onChange={(patch) => set(updateRow(block, rowIndex, patch))}
            onMove={(direction) => set(moveRow(block, rowIndex, direction))}
            onRemove={() => set(removeRow(block, rowIndex))}
            onPickField={() => setPicker({ block: index, row: rowIndex })}
          />
        )
      );
      fields.push(<Button key="ar" label={t('contractTemplate.editor.addField')} variant="secondary" size="sm" onPress={() => set(addRow(block))} />);
    }
    if (block.type === 'box') {
      fields.push(<TextField key="bx" label={t('contractTemplate.editor.boxText')} value={block.text ?? ''} onChangeText={(text) => set({ ...block, text })} multiline />);
    }
    if (block.type === 'columns') {
      block.cells.forEach((cell, cellIndex) => {
        fields.push(<TextField key={`ct${cellIndex}`} label={t('contractTemplate.fieldColumnTitle', { n: cellIndex + 1 })} value={cell.title ?? ''} onChangeText={(title) => set({ ...block, cells: block.cells.map((c, i) => (i === cellIndex ? { ...c, title } : c)) })} />);
        fields.push(<TextField key={`cx${cellIndex}`} label={t('contractTemplate.fieldColumn', { n: cellIndex + 1 })} value={cell.text} onChangeText={(text) => set({ ...block, cells: block.cells.map((c, i) => (i === cellIndex ? { ...c, text } : c)) })} multiline />);
      });
    }
    if (block.type === 'header') {
      for (const side of ['left', 'center', 'right'] as const) {
        fields.push(<TextField key={side} label={t(`contractTemplate.editor.header.${side}`)} value={block[side] ?? ''} onChangeText={(text) => set({ ...block, [side]: text })} multiline />);
      }
    }
    if (block.type === 'vehicleDiagram') {
      fields.push(<TextField key="vt" label={t('contractTemplate.editor.boxTitle')} value={block.title} onChangeText={(title) => set({ ...block, title })} />);
      fields.push(<TextField key="vl" label={t('contractTemplate.editor.legend')} value={block.legend ?? ''} onChangeText={(legend) => set({ ...block, legend })} multiline />);
    }
    if (block.type === 'fuelGauge') {
      fields.push(<TextField key="ft" label={t('contractTemplate.editor.boxTitle')} value={block.title ?? ''} onChangeText={(title) => set({ ...block, title })} />);
    }
    if (block.type === 'signatures') {
      block.boxes.forEach((box, boxIndex) =>
        fields.push(<TextField key={`s${boxIndex}`} label={t(`contractTemplate.editor.signature.${box.role}`)} value={box.label} onChangeText={(label) => set({ ...block, boxes: block.boxes.map((b, i) => (i === boxIndex ? { ...b, label } : b)) })} />)
      );
    }
    if ((block.type === 'box' || block.type === 'fuelGauge') && true) {
      fields.push(
        <Pressable key="w" onPress={() => set({ ...block, width: block.width === 'half' ? 'full' : 'half' })} className="self-start rounded-full border border-[#EAE5F2] bg-white px-4 py-2">
          <ThemedText type="small">{block.width === 'half' ? t('contractTemplate.editor.widthHalf') : t('contractTemplate.editor.widthFull')}</ThemedText>
        </Pressable>
      );
    }

    return (
      <Card key={index} className="gap-3">
        <View className="flex-row items-center justify-between gap-2">
          <ThemedText type="smallBold" style={{ flex: 1 }}>
            {t(`contractTemplate.blockTypes.${block.type}`)}
          </ThemedText>
          <View className="flex-row gap-2">
            <IconButton label="▲" onPress={() => change((tpl) => moveBlock(tpl, index, -1))} disabled={index === 0} />
            <IconButton label="▼" onPress={() => change((tpl) => moveBlock(tpl, index, 1))} disabled={index === current.blocks.length - 1} />
            <IconButton label="✕" onPress={() => confirmRemoveBlock(index)} danger />
          </View>
        </View>
        {fields}
      </Card>
    );
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('contractTemplate.editor.title')} subtitle={t('contractTemplate.editor.subtitle')} showBack />
        {template === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-4 px-6 pb-16" keyboardShouldPersistTaps="handled">
            <ThemedText type="small" themeColor="textSecondary">
              {t('contractTemplate.editor.help')}
            </ThemedText>
            <View className="flex-row flex-wrap gap-2">
              <Button label={t('contractTemplate.preview')} variant="secondary" size="sm" onPress={handlePreview} loading={previewing} disabled={previewing} />
              <Button label={t('contractTemplate.editor.reset')} variant="ghost" size="sm" onPress={handleReset} />
            </View>

            {template.blocks.map((block, index) => renderBlock(block, index, template))}

            <Button label={t('contractTemplate.editor.addBlock')} variant="secondary" onPress={() => setAddOpen(true)} />
            {error ? (
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {error}
              </ThemedText>
            ) : null}
            <Button label={t('contractTemplate.save')} onPress={handleSave} disabled={save.isPending} loading={save.isPending} />
          </ScrollView>
        )}

        <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
          <View className="flex-1 justify-end bg-black/40">
            <View className="max-h-[75%] rounded-t-3xl bg-white p-5">
              <ThemedText type="smallBold" className="mb-3">
                {t('contractTemplate.editor.chooseField')}
              </ThemedText>
              <ScrollView>
                <Pressable
                  className="border-b border-[#EAE5F2] py-3"
                  onPress={() => {
                    if (picker) change((tpl) => { const b = tpl.blocks[picker.block]; return hasRows(b) ? updateBlock(tpl, picker.block, updateRow(b, picker.row, { value: '' })) : tpl; });
                    setPicker(null);
                  }}
                >
                  <ThemedText type="smallBold">{t('contractTemplate.editor.byHand')}</ThemedText>
                </Pressable>
                {PLACEHOLDERS.map((key) => (
                  <Pressable
                    key={key}
                    className="border-b border-[#EAE5F2] py-3"
                    onPress={() => {
                      if (picker) change((tpl) => { const b = tpl.blocks[picker.block]; return hasRows(b) ? updateBlock(tpl, picker.block, updateRow(b, picker.row, { value: `{{${key}}}` })) : tpl; });
                      setPicker(null);
                    }}
                  >
                    <ThemedText type="default">{t(`contractTemplate.placeholders.${key}`)}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
              <Button label={t('common.cancel')} variant="ghost" onPress={() => setPicker(null)} />
            </View>
          </View>
        </Modal>

        <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
          <View className="flex-1 justify-end bg-black/40">
            <View className="rounded-t-3xl bg-white p-5">
              <ThemedText type="smallBold" className="mb-3">
                {t('contractTemplate.editor.addBlock')}
              </ThemedText>
              {ADDABLE_BLOCKS.map((type) => (
                <Pressable
                  key={type}
                  className="border-b border-[#EAE5F2] py-3"
                  onPress={() => {
                    change((tpl) => addBlock(tpl, type));
                    setAddOpen(false);
                  }}
                >
                  <ThemedText type="default">{t(`contractTemplate.blockTypes.${type}`)}</ThemedText>
                </Pressable>
              ))}
              <Button label={t('common.cancel')} variant="ghost" onPress={() => setAddOpen(false)} />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}
