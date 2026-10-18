import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useAgencyDetails, useMyAgency } from '@/features/agency/hooks';
import { generateBlankContractPdf, generateContractPdf } from '@/features/contracts/contract-pdf';
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
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const BLOCK_ICON: Record<Block['type'], IconName> = {
  heading: 'text-outline',
  paragraph: 'reorder-three-outline',
  list: 'list-outline',
  fields: 'grid-outline',
  columns: 'albums-outline',
  header: 'business-outline',
  box: 'create-outline',
  vehicleDiagram: 'car-outline',
  fuelGauge: 'speedometer-outline',
  signatures: 'finger-print-outline',
  rule: 'remove-outline',
  spacer: 'resize-outline',
  pageBreak: 'document-outline',
};

/** Résumé d'une ligne pour la liste repliée : l'utilisateur reconnaît sa rubrique sans l'ouvrir. */
function summary(block: Block): string {
  const cut = (text: string) => (text.replace(/\s+/g, ' ').trim().slice(0, 48) || '—') + (text.length > 48 ? '…' : '');
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return cut(block.text);
    case 'list':
      return cut(block.items[0] ?? '');
    case 'box':
      return cut(block.title ?? block.text ?? block.rows[0]?.label ?? '');
    case 'fields':
      return cut(block.rows.map((row) => row.label).join(', '));
    case 'columns':
      return cut(block.cells[0]?.title ?? block.cells[0]?.text ?? '');
    case 'header':
      return cut(block.center ?? block.left ?? block.right ?? '');
    case 'vehicleDiagram':
      return cut(block.title);
    case 'fuelGauge':
      return cut(block.title ?? '');
    case 'signatures':
      return cut(block.boxes.map((box) => box.label).join(' / '));
    default:
      return '';
  }
}

function SmallIcon({ name, label, onPress, disabled, danger }: { name: IconName; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={6}
      className="h-9 w-9 items-center justify-center rounded-full border border-[#EAE5F2] bg-white"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <Ionicons name={name} size={18} color={danger ? M3akPalette.danger : '#211A2E'} />
    </Pressable>
  );
}

function fieldContentLabel(value: string, t: T): string {
  const auto = /^\{\{([a-z0-9_]+)\}\}$/.exec(value.trim())?.[1];
  if (auto && (PLACEHOLDERS as readonly string[]).includes(auto)) return t(`contractTemplate.placeholders.${auto}`);
  return value.trim() ? value : t('contractTemplate.editor.byHand');
}

/** Liste de choix : « à remplir à la main » ou une information automatique. */
function FieldChoiceList({ onChoose, t }: { onChoose: (value: string) => void; t: T }) {
  return (
    <ScrollView style={{ maxHeight: 320 }}>
      <Pressable className="border-b border-[#EAE5F2] py-3" onPress={() => onChoose('')}>
        <ThemedText type="smallBold">{t('contractTemplate.editor.byHand')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('contractTemplate.editor.byHandHelp')}
        </ThemedText>
      </Pressable>
      {PLACEHOLDERS.map((key) => (
        <Pressable key={key} className="border-b border-[#EAE5F2] py-3" onPress={() => onChoose(`{{${key}}}`)}>
          <ThemedText type="default">{t(`contractTemplate.placeholders.${key}`)}</ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-white p-5" style={{ maxHeight: '85%' }}>
          {children}
        </View>
      </View>
    </Modal>
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

  const [template, setTemplate] = useState<ContractTemplate>(initial);
  const [dirty, setDirty] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [choice, setChoice] = useState<{ block: number; row: number } | null>(null);
  const [adding, setAdding] = useState<{ block: number; name: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change(next: (current: ContractTemplate) => ContractTemplate) {
    setTemplate(next);
    setDirty(true);
  }

  function confirmRemoveBlock(index: number) {
    Alert.alert(t('contractTemplate.editor.removeBlockTitle'), t('contractTemplate.editor.removeBlockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('contractTemplate.editor.remove'),
        style: 'destructive',
        onPress: () => {
          change((current) => removeBlock(current, index));
          setOpenIndex(null);
        },
      },
    ]);
  }

  function handleReset() {
    Alert.alert(t('contractTemplate.editor.resetTitle'), t('contractTemplate.editor.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('contractTemplate.editor.reset'),
        style: 'destructive',
        onPress: () => {
          setTemplate(defaultEditableTemplate());
          setDirty(true);
          setOpenIndex(null);
        },
      },
    ]);
  }

  async function runPreview(kind: 'example' | 'blank') {
    setPreviewing(true);
    try {
      const details = detailsQuery.data;
      const agency = { nom: details?.nom ?? agencyName, raisonSociale: details?.raisonSociale, adresse: details?.adresse, ville: details?.ville, telephone: details?.telephone, email: details?.email };
      const pruned = pruneEmptyBoxes(template);
      const uri =
        kind === 'blank'
          ? await generateBlankContractPdf(agency, pruned)
          : await generateContractPdf(sampleContract(), agency, {}, pruned, { kmDepart: 12000, carburantDepart: 100 });
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

  async function handleSave() {
    setError(null);
    try {
      await save.mutateAsync(ensureSignatures(pruneEmptyBoxes(template)));
      setDirty(false);
      Alert.alert(t('common.appName'), t('contractTemplate.saved'), [{ text: t('profil.signature.ok'), onPress: () => router.back() }]);
    } catch {
      setError(t('contractTemplate.saveError'));
    }
  }

  function editFields(block: Block, index: number): React.ReactNode[] {
    const set = (next: Block) => change((current) => updateBlock(current, index, next));
    const fields: React.ReactNode[] = [];

    if (block.type === 'heading' || block.type === 'paragraph') {
      fields.push(<TextField key="t" label={t('contractTemplate.editor.text')} value={block.text} onChangeText={(text) => set({ ...block, text })} multiline />);
    }
    if (block.type === 'list') {
      fields.push(<TextField key="l" label={t('contractTemplate.editor.list')} value={block.items.join('\n')} onChangeText={(text) => set({ ...block, items: text.split('\n').filter((line) => line.trim()) })} multiline />);
    }
    if (block.type === 'box') {
      fields.push(<TextField key="bt" label={t('contractTemplate.editor.boxTitle')} value={block.title ?? ''} onChangeText={(title) => set({ ...block, title })} />);
    }
    if (hasRows(block)) {
      block.rows.forEach((row: FieldRow, rowIndex: number) =>
        fields.push(
          <View key={`r${rowIndex}`} className="gap-2 rounded-2xl border border-[#EAE5F2] bg-[#FAF9FF] p-3">
            <TextField label={t('contractTemplate.editor.fieldName')} value={row.label} onChangeText={(label) => set(updateRow(block, rowIndex, { label }))} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('contractTemplate.editor.fieldFilledWith')} : <ThemedText type="smallBold">{fieldContentLabel(row.value, t)}</ThemedText>
            </ThemedText>
            <View className="flex-row flex-wrap items-center gap-2">
              <Button label={t('contractTemplate.editor.change')} variant="secondary" size="sm" onPress={() => setChoice({ block: index, row: rowIndex })} />
              <SmallIcon name="arrow-up" label={t('contractTemplate.editor.moveUp')} onPress={() => set(moveRow(block, rowIndex, -1))} disabled={rowIndex === 0} />
              <SmallIcon name="arrow-down" label={t('contractTemplate.editor.moveDown')} onPress={() => set(moveRow(block, rowIndex, 1))} disabled={rowIndex === block.rows.length - 1} />
              <SmallIcon name="trash-outline" label={t('contractTemplate.editor.removeField')} onPress={() => set(removeRow(block, rowIndex))} danger />
            </View>
          </View>
        )
      );
      fields.push(<Button key="ar" label={t('contractTemplate.editor.addField')} variant="secondary" size="sm" icon="add" onPress={() => setAdding({ block: index, name: '' })} />);
    }
    if (block.type === 'box') {
      fields.push(<TextField key="bx" label={t('contractTemplate.editor.boxText')} value={block.text ?? ''} onChangeText={(text) => set({ ...block, text })} multiline />);
    }
    if (block.type === 'columns') {
      block.cells.forEach((cell, cellIndex) => {
        fields.push(<TextField key={`ct${cellIndex}`} label={t('contractTemplate.editor.columnTitle', { n: cellIndex + 1 })} value={cell.title ?? ''} onChangeText={(title) => set({ ...block, cells: block.cells.map((c, i) => (i === cellIndex ? { ...c, title } : c)) })} />);
        fields.push(<TextField key={`cx${cellIndex}`} label={t('contractTemplate.editor.column', { n: cellIndex + 1 })} value={cell.text} onChangeText={(text) => set({ ...block, cells: block.cells.map((c, i) => (i === cellIndex ? { ...c, text } : c)) })} multiline />);
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
    if (block.type === 'box' || block.type === 'fuelGauge') {
      fields.push(
        <Pressable key="w" onPress={() => set({ ...block, width: block.width === 'half' ? 'full' : 'half' })} className="flex-row items-center gap-2 self-start rounded-full border border-[#EAE5F2] bg-white px-4 py-2">
          <Ionicons name={block.width === 'half' ? 'albums-outline' : 'tablet-landscape-outline'} size={16} color="#211A2E" />
          <ThemedText type="small">{block.width === 'half' ? t('contractTemplate.editor.widthHalf') : t('contractTemplate.editor.widthFull')}</ThemedText>
        </Pressable>
      );
    }
    return fields;
  }

  const choiceBlock = choice ? template.blocks[choice.block] : null;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('contractTemplate.editor.title')} subtitle={t('contractTemplate.editor.subtitle')} showBack />

        <ScrollView contentContainerClassName="gap-3 px-6 pb-8" keyboardShouldPersistTaps="handled">
          <View className="gap-2 rounded-2xl bg-[#EDE9FE] p-4">
            <ThemedText type="smallBold">{t('contractTemplate.editor.helpTitle')}</ThemedText>
            <ThemedText type="small">{t('contractTemplate.editor.help1')}</ThemedText>
            <ThemedText type="small">{t('contractTemplate.editor.help2')}</ThemedText>
            <ThemedText type="small">{t('contractTemplate.editor.help3')}</ThemedText>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <Button label={t('contractTemplate.preview')} variant="secondary" size="sm" icon="eye-outline" onPress={handlePreview} loading={previewing} disabled={previewing} />
            <Button label={t('contractTemplate.editor.reset')} variant="ghost" size="sm" onPress={handleReset} />
          </View>

          {template.blocks.map((block, index) => {
            const open = openIndex === index;
            const hint = summary(block);
            return (
              <View key={index} className="rounded-2xl border border-[#EAE5F2] bg-white">
                <Pressable onPress={() => setOpenIndex(open ? null : index)} className="flex-row items-center gap-3 px-4 py-3" accessibilityRole="button">
                  <Ionicons name={BLOCK_ICON[block.type]} size={20} color={M3akPalette.mauve} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{t(`contractTemplate.blockTypes.${block.type}`)}</ThemedText>
                    {hint ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {hint}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#81778F" />
                </Pressable>
                {open ? (
                  <View className="gap-3 border-t border-[#EAE5F2] px-4 py-4">
                    {editFields(block, index)}
                    <View className="flex-row flex-wrap items-center gap-2">
                      <SmallIcon name="arrow-up" label={t('contractTemplate.editor.moveUp')} onPress={() => { change((current) => moveBlock(current, index, -1)); setOpenIndex(index - 1); }} disabled={index === 0} />
                      <SmallIcon name="arrow-down" label={t('contractTemplate.editor.moveDown')} onPress={() => { change((current) => moveBlock(current, index, 1)); setOpenIndex(index + 1); }} disabled={index === template.blocks.length - 1} />
                      <Button label={t('contractTemplate.editor.removeBlock')} variant="ghost" size="sm" icon="trash-outline" onPress={() => confirmRemoveBlock(index)} />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}

          <Button label={t('contractTemplate.editor.addBlock')} variant="secondary" icon="add-circle-outline" onPress={() => setAddOpen(true)} />
        </ScrollView>

        <View className="gap-2 border-t border-[#EAE5F2] bg-white px-6 py-3">
          {error ? (
            <ThemedText type="small" style={{ color: M3akPalette.danger }}>
              {error}
            </ThemedText>
          ) : dirty ? (
            <ThemedText type="small" style={{ color: M3akPalette.warning }}>
              {t('contractTemplate.editor.unsaved')}
            </ThemedText>
          ) : null}
          <Button label={t('contractTemplate.save')} onPress={handleSave} disabled={save.isPending || !dirty} loading={save.isPending} />
        </View>

        <BottomSheet visible={choice !== null && !!choiceBlock} onClose={() => setChoice(null)}>
          <ThemedText type="smallBold" className="mb-1">
            {t('contractTemplate.editor.pickTitle')}
          </ThemedText>
          <FieldChoiceList
            t={t}
            onChoose={(value) => {
              if (choice && choiceBlock && hasRows(choiceBlock)) change((current) => updateBlock(current, choice.block, updateRow(choiceBlock, choice.row, { value })));
              setChoice(null);
            }}
          />
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setChoice(null)} />
        </BottomSheet>

        <BottomSheet visible={adding !== null} onClose={() => setAdding(null)}>
          <ThemedText type="smallBold" className="mb-2">
            {t('contractTemplate.editor.addFieldTitle')}
          </ThemedText>
          <TextField label={t('contractTemplate.editor.addFieldName')} placeholder={t('contractTemplate.editor.addFieldPlaceholder')} value={adding?.name ?? ''} onChangeText={(name) => setAdding((current) => (current ? { ...current, name } : current))} />
          <ThemedText type="small" themeColor="textSecondary" className="my-2">
            {t('contractTemplate.editor.addFieldHow')}
          </ThemedText>
          <FieldChoiceList
            t={t}
            onChoose={(value) => {
              const name = adding?.name.trim();
              const target = adding ? template.blocks[adding.block] : null;
              if (adding && name && target && hasRows(target)) {
                change((current) => updateBlock(current, adding.block, addRow(target, { label: name, value })));
                setAdding(null);
              } else {
                Alert.alert(t('common.appName'), t('contractTemplate.editor.addFieldNeedName'));
              }
            }}
          />
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setAdding(null)} />
        </BottomSheet>

        <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)}>
          <ThemedText type="smallBold" className="mb-1">
            {t('contractTemplate.editor.addBlockTitle')}
          </ThemedText>
          <ScrollView style={{ maxHeight: 420 }}>
            {ADDABLE_BLOCKS.map((type) => (
              <Pressable
                key={type}
                className="flex-row items-center gap-3 border-b border-[#EAE5F2] py-3"
                onPress={() => {
                  change((current) => addBlock(current, type));
                  setAddOpen(false);
                  setOpenIndex(null);
                }}
              >
                <Ionicons name={BLOCK_ICON[type]} size={22} color={M3akPalette.mauve} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{t(`contractTemplate.blockTypes.${type}`)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(`contractTemplate.blockHints.${type}`)}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setAddOpen(false)} />
        </BottomSheet>
      </SafeAreaView>
    </ThemedView>
  );
}
