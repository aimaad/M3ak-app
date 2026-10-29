import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import type { AgencyRole } from '@/features/agency/types';
import { useLanguage } from '@/i18n/use-language';

import {
  useAddCustomerNote,
  useCustomerNotes,
  useDeleteCustomerNote,
  useNoteRevisions,
  useUpdateCustomerNote,
} from './hooks';
import { canEditNote, validateNoteBody, type CustomerNote } from './notes';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function NoteHistory({ noteId }: { noteId: string }) {
  const { t } = useLanguage();
  const { data, isLoading } = useNoteRevisions(noteId, true);

  if (isLoading) return <ActivityIndicator color={M3akPalette.mauve} />;
  if (!data || data.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {t('customer.notes.noHistory')}
      </ThemedText>
    );
  }
  return (
    <View className="gap-2 rounded-2xl bg-canvas p-3">
      {data.map((revision) => (
        <View key={revision.id} className="gap-0.5">
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
            {t('customer.notes.previousVersion', {
              name: revision.editedByName ?? t('customer.documentsManager.unknownMember'),
              date: formatDateTime(revision.editedAt),
            })}
          </ThemedText>
          <ThemedText type="small">{revision.body}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function NoteItem({
  note,
  customerId,
  role,
  userId,
}: {
  note: CustomerNote;
  customerId: string;
  role: AgencyRole | null;
  userId: string | null;
}) {
  const { t } = useLanguage();
  const updateNote = useUpdateCustomerNote(customerId);
  const deleteNote = useDeleteCustomerNote(customerId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = canEditNote(role, userId, note);

  async function handleSave() {
    setError(null);
    const problem = validateNoteBody(draft);
    if (problem) {
      setError(t(`customer.notes.errors.${problem}`));
      return;
    }
    try {
      await updateNote.mutateAsync({ id: note.id, body: draft });
      setEditing(false);
    } catch {
      setError(t('customer.notes.saveError'));
    }
  }

  function handleDelete() {
    Alert.alert(t('customer.notes.deleteConfirmTitle'), t('customer.notes.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('customer.notes.delete'),
        style: 'destructive',
        onPress: () =>
          deleteNote.mutate(note.id, {
            onError: () => Alert.alert(t('common.appName'), t('customer.notes.saveError')),
          }),
      },
    ]);
  }

  return (
    <Card className="gap-2">
      {editing ? (
        <View className="gap-2">
          <TextField value={draft} onChangeText={setDraft} multiline numberOfLines={4} className="min-h-24" error={error ?? undefined} />
          <View className="flex-row gap-2">
            <Button
              label={t('common.cancel')}
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                setDraft(note.body);
                setError(null);
                setEditing(false);
              }}
            />
            <Button
              label={updateNote.isPending ? t('customer.form.saving') : t('customer.form.save')}
              size="sm"
              style={{ flex: 1 }}
              disabled={updateNote.isPending}
              loading={updateNote.isPending}
              onPress={handleSave}
            />
          </View>
        </View>
      ) : (
        <ThemedText type="default">{note.body}</ThemedText>
      )}

      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
        {note.createdByName
          ? t('customer.notes.byOn', { name: note.createdByName, date: formatDateTime(note.createdAt) })
          : t('customer.notes.importedOn', { date: formatDateTime(note.createdAt) })}
        {note.editedAt ? ` · ${t('customer.notes.edited', { date: formatDateTime(note.editedAt) })}` : ''}
      </ThemedText>

      {!editing ? (
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          {editable ? (
            <Pressable onPress={() => setEditing(true)} hitSlop={6}>
              <ThemedText type="small" themeColor="primary">
                {t('customer.notes.edit')}
              </ThemedText>
            </Pressable>
          ) : null}
          {note.editedAt ? (
            <Pressable onPress={() => setShowHistory((prev) => !prev)} hitSlop={6}>
              <ThemedText type="small" themeColor="primary">
                {showHistory ? t('customer.notes.hideHistory') : t('customer.notes.showHistory')}
              </ThemedText>
            </Pressable>
          ) : null}
          {editable ? (
            <Pressable onPress={handleDelete} hitSlop={6} disabled={deleteNote.isPending}>
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {t('customer.notes.delete')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showHistory ? <NoteHistory noteId={note.id} /> : null}
    </Card>
  );
}

/**
 * Notes internes confidentielles : visibles seulement par l'équipe de l'agence, jamais reprises dans
 * un contrat ni un document remis au client. Aucune notation automatique du client.
 */
export function CustomerNotesSection({
  agencyId,
  customerId,
  role,
  userId,
}: {
  agencyId: string;
  customerId: string;
  role: AgencyRole | null;
  userId: string | null;
}) {
  const { t } = useLanguage();
  const notesQuery = useCustomerNotes(customerId);
  const addNote = useAddCustomerNote(customerId);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    const problem = validateNoteBody(draft);
    if (problem) {
      setError(t(`customer.notes.errors.${problem}`));
      return;
    }
    try {
      await addNote.mutateAsync({ agencyId, body: draft });
      setDraft('');
      setAdding(false);
    } catch {
      setError(t('customer.notes.saveError'));
    }
  }

  return (
    <View className="gap-3">
      <View className="gap-1">
        <ThemedText type="smallBold">{t('customer.notes.title')}</ThemedText>
        <View className="self-start rounded-full bg-[#FEF3C7] px-2.5 py-1">
          <ThemedText type="small" style={{ color: M3akPalette.warning, fontSize: 11 }}>
            {t('customer.notes.confidential')}
          </ThemedText>
        </View>
      </View>

      {notesQuery.isLoading ? (
        <ActivityIndicator color={M3akPalette.mauve} />
      ) : notesQuery.isError ? (
        <ThemedText type="small" style={{ color: M3akPalette.danger }}>
          {t('customer.notes.loadError')}
        </ThemedText>
      ) : (notesQuery.data ?? []).length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('customer.notes.empty')}
        </ThemedText>
      ) : (
        (notesQuery.data ?? []).map((note) => (
          <NoteItem key={note.id} note={note} customerId={customerId} role={role} userId={userId} />
        ))
      )}

      {adding ? (
        <Card className="gap-2">
          <TextField
            value={draft}
            onChangeText={setDraft}
            multiline
            numberOfLines={4}
            className="min-h-24"
            placeholder={t('customer.notes.placeholder')}
            error={error ?? undefined}
          />
          <View className="flex-row gap-2">
            <Button
              label={t('common.cancel')}
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                setDraft('');
                setError(null);
                setAdding(false);
              }}
            />
            <Button
              label={addNote.isPending ? t('customer.form.saving') : t('customer.notes.add')}
              size="sm"
              style={{ flex: 1 }}
              disabled={addNote.isPending}
              loading={addNote.isPending}
              onPress={handleAdd}
            />
          </View>
        </Card>
      ) : (
        <Button label={t('customer.notes.addButton')} variant="secondary" icon="create-outline" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}
