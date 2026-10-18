import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ZoomableImage } from '@/components/zoomable-image';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

import { DocumentForm } from './document-form';
import {
  documentExpiryStatus,
  documentLabel,
  documentToFormValues,
  EMPTY_DOCUMENT_FORM,
  isDocumentFormValid,
  toDocumentInput,
  validateDocumentForm,
  type DocumentFormValues,
} from './documents';
import { CUSTOMER_DOCUMENTS_BUCKET, type DocumentOwner } from './documents-api';
import {
  useAddDocument,
  useDeleteDocument,
  useOwnerDocuments,
  useReplaceDocumentFile,
  useUpdateDocument,
} from './hooks';
import type { CustomerDocument } from './types';

type Props = {
  agencyId: string;
  owner: DocumentOwner;
  /** Suppression réservée aux responsables (vérifiée aussi côté serveur). */
  canDelete: boolean;
  /** Pour un conducteur qui est une fiche client, ses documents sont ceux du client : lecture depuis la fiche client. */
  title?: string;
};

const STATUS_COLOR = {
  expired: M3akPalette.danger,
  expiring_soon: M3akPalette.warning,
  ok: '#81778F',
  no_date: '#81778F',
} as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function pickReplacementPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

function DocumentThumbnail({ path, label }: { path: string; label?: string }) {
  const { data: url, isLoading } = useSignedUrl(CUSTOMER_DOCUMENTS_BUCKET, path);
  if (isLoading || !url) {
    return (
      <View className="h-28 flex-1 items-center justify-center rounded-2xl bg-[#FAF9FF]">
        <ActivityIndicator color={M3akPalette.mauve} />
      </View>
    );
  }
  return <ZoomableImage uri={url} label={label} style={{ borderRadius: 16 }} />;
}

function DocumentCard({
  doc,
  agencyId,
  owner,
  canDelete,
}: {
  doc: CustomerDocument;
  agencyId: string;
  owner: DocumentOwner;
  canDelete: boolean;
}) {
  const { t } = useLanguage();
  const updateDocument = useUpdateDocument(owner);
  const replaceFile = useReplaceDocumentFile(owner);
  const deleteDocument = useDeleteDocument(owner);

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<DocumentFormValues>(() => documentToFormValues(doc));
  const [touched, setTouched] = useState(false);

  const status = documentExpiryStatus(doc);
  const errors = validateDocumentForm(values);

  async function handleSave() {
    setTouched(true);
    if (!isDocumentFormValid(errors)) return;
    try {
      await updateDocument.mutateAsync({ id: doc.id, input: toDocumentInput(values) });
      setEditing(false);
    } catch {
      Alert.alert(t('common.appName'), t('customer.documentsManager.saveError'));
    }
  }

  function handleReplace() {
    Alert.alert(t('customer.documentsManager.replaceFile'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      ...(['camera', 'library'] as const).map((source) => ({
        text: t(source === 'camera' ? 'common.camera' : 'common.gallery'),
        onPress: async () => {
          const uri = await pickReplacementPhoto(source);
          if (!uri) return;
          try {
            await replaceFile.mutateAsync({ agencyId, doc, localUri: uri });
          } catch {
            Alert.alert(t('common.appName'), t('customer.documentsManager.uploadError'));
          }
        },
      })),
    ]);
  }

  function handleDelete() {
    Alert.alert(t('customer.documentsManager.deleteConfirmTitle'), t('customer.documentsManager.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('customer.documentsManager.delete'),
        style: 'destructive',
        onPress: () =>
          deleteDocument.mutate(doc, {
            onError: () => Alert.alert(t('common.appName'), t('customer.documentsManager.deleteError')),
          }),
      },
    ]);
  }

  return (
    <Card className="gap-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <ThemedText type="smallBold">{documentLabel(doc, t)}</ThemedText>
          {doc.reference ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('customer.documentReference', { reference: doc.reference })}
            </ThemedText>
          ) : null}
          {doc.issuingAuthority ? (
            <ThemedText type="small" themeColor="textSecondary">
              {doc.issuingAuthority}
            </ThemedText>
          ) : null}
          {doc.categories.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('customer.documentForm.categoriesValue', { list: doc.categories.join(', ') })}
            </ThemedText>
          ) : null}
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#F3F0FA' }}>
          <ThemedText type="small" style={{ color: STATUS_COLOR[status], fontSize: 11 }}>
            {status === 'no_date'
              ? t('customer.documentsManager.status.no_date')
              : status === 'expired'
                ? t('customer.documentsManager.status.expired', { date: formatDate(doc.expiresAt as string) })
                : status === 'expiring_soon'
                  ? t('customer.documentsManager.status.expiring_soon', { date: formatDate(doc.expiresAt as string) })
                  : t('customer.documentsManager.status.ok', { date: formatDate(doc.expiresAt as string) })}
          </ThemedText>
        </View>
      </View>

      {doc.path ? (
        <View className="flex-row gap-2" style={{ height: 112 }}>
          <DocumentThumbnail path={doc.path} label={doc.pathVerso ? t('vehicle.quickCreate.face.recto') : undefined} />
          {doc.pathVerso ? <DocumentThumbnail path={doc.pathVerso} label={t('vehicle.quickCreate.face.verso')} /> : null}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('customer.documentsManager.noFile')}
        </ThemedText>
      )}

      {doc.notes ? <ThemedText type="small">{doc.notes}</ThemedText> : null}

      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
        {t('customer.documentsManager.addedBy', {
          name: doc.uploadedByName ?? t('customer.documentsManager.unknownMember'),
          date: formatDate(doc.uploadedAt),
        })}
      </ThemedText>

      {editing ? (
        <View className="gap-3 border-t border-[#EAE5F2] pt-3">
          <DocumentForm
            values={values}
            onChange={setValues}
            errors={touched ? errors : {}}
            localUri={null}
            onPickFile={() => undefined}
            lockType
            hideFile
          />
          <View className="flex-row gap-2">
            <Button
              label={t('common.cancel')}
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                setValues(documentToFormValues(doc));
                setTouched(false);
                setEditing(false);
              }}
            />
            <Button
              label={updateDocument.isPending ? t('customer.form.saving') : t('customer.form.save')}
              size="sm"
              style={{ flex: 1 }}
              disabled={updateDocument.isPending}
              loading={updateDocument.isPending}
              onPress={handleSave}
            />
          </View>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-x-4 gap-y-1 pt-1">
          <Pressable onPress={() => setEditing(true)} hitSlop={6}>
            <ThemedText type="small" themeColor="primary">
              {t('customer.documentsManager.edit')}
            </ThemedText>
          </Pressable>
          <Pressable onPress={handleReplace} hitSlop={6} disabled={replaceFile.isPending}>
            <ThemedText type="small" themeColor="primary">
              {replaceFile.isPending ? t('customer.documentsManager.uploading') : t('customer.documentsManager.replaceFile')}
            </ThemedText>
          </Pressable>
          {canDelete ? (
            <Pressable onPress={handleDelete} hitSlop={6} disabled={deleteDocument.isPending}>
              <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                {t('customer.documentsManager.delete')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
    </Card>
  );
}

/**
 * Section « Documents » d'une fiche (client ou conducteur) : plusieurs documents de types
 * différents, ajout, correction, remplacement du fichier et suppression selon les permissions.
 * Aucun document n'est obligatoire pour une fiche : les exigences avant départ sont définies à part.
 */
export function CustomerDocumentsSection({ agencyId, owner, canDelete, title }: Props) {
  const { t } = useLanguage();
  const documentsQuery = useOwnerDocuments(owner);
  const addDocument = useAddDocument(owner);

  const [adding, setAdding] = useState(false);
  const [values, setValues] = useState<DocumentFormValues>(EMPTY_DOCUMENT_FORM);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validateDocumentForm(values);
  const documents = documentsQuery.data ?? [];

  function reset() {
    setValues(EMPTY_DOCUMENT_FORM);
    setLocalUri(null);
    setTouched(false);
    setError(null);
    setAdding(false);
  }

  async function handleAdd() {
    setTouched(true);
    setError(null);
    if (!isDocumentFormValid(errors)) return;
    try {
      await addDocument.mutateAsync({ agencyId, input: toDocumentInput(values), localUri });
      reset();
    } catch {
      setError(t('customer.documentsManager.saveError'));
    }
  }

  return (
    <View className="gap-3">
      <ThemedText type="smallBold">{title ?? t('customer.documentsSection')}</ThemedText>

      {documentsQuery.isLoading ? (
        <ActivityIndicator color={M3akPalette.mauve} />
      ) : documentsQuery.isError ? (
        <ThemedText type="small" style={{ color: M3akPalette.danger }}>
          {t('customer.documentsManager.loadError')}
        </ThemedText>
      ) : documents.length === 0 ? (
        <View className="items-center rounded-2xl border border-dashed border-[#EAE5F2] bg-white px-4 py-5">
          <ThemedText type="small" themeColor="textSecondary" className="text-center">
            {t('customer.documentsManager.empty')}
          </ThemedText>
        </View>
      ) : (
        documents.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} agencyId={agencyId} owner={owner} canDelete={canDelete} />
        ))
      )}

      {adding ? (
        <Card className="gap-3">
          <ThemedText type="smallBold">{t('customer.documentsManager.addTitle')}</ThemedText>
          <DocumentForm
            values={values}
            onChange={setValues}
            errors={touched ? errors : {}}
            localUri={localUri}
            onPickFile={setLocalUri}
          />
          {error ? (
            <ThemedText type="small" style={{ color: M3akPalette.danger }}>
              {error}
            </ThemedText>
          ) : null}
          <View className="flex-row gap-2">
            <Button label={t('common.cancel')} variant="secondary" size="sm" style={{ flex: 1 }} onPress={reset} />
            <Button
              label={addDocument.isPending ? t('customer.form.saving') : t('customer.documentsManager.add')}
              size="sm"
              style={{ flex: 1 }}
              disabled={addDocument.isPending}
              loading={addDocument.isPending}
              onPress={handleAdd}
            />
          </View>
        </Card>
      ) : (
        <Button
          label={t('customer.documentsManager.addButton')}
          variant="secondary"
          icon="add-circle-outline"
          onPress={() => setAdding(true)}
        />
      )}
    </View>
  );
}
