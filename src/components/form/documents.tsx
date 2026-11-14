import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { filledCount } from './logic';

type IconName = keyof typeof Ionicons.glyphMap;

/** Rapport d'une carte (carte grise, permis) : 1,586. */
export const CARD_RATIO = 1.586;

// ------------------------------------------------------------------ menu « … »

function ActionSheet({ visible, onClose, actions }: { visible: boolean; onClose: () => void; actions: { key: string; label: string; onPress: () => void; danger?: boolean }[] }) {
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: Palette.overlay }} onPress={onClose} accessibilityLabel={t('form.close')} />
      <View style={{ backgroundColor: Brand.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingBottom: 32, gap: 8 }}>
        {actions.map((action) => (
          <Pressable key={action.key} onPress={() => { onClose(); action.onPress(); }} accessibilityRole="button" style={{ minHeight: 52, borderRadius: 16, backgroundColor: Palette.surface, paddingHorizontal: 16, justifyContent: 'center' }}>
            <HText weight="semibold" size={15} color={action.danger ? Palette.error : Palette.textPrimary}>
              {action.label}
            </HText>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ------------------------------------------------------------------ document (carte grise, permis…)

/**
 * Case au format carte (1,586) avec son libellé dessous (« Recto », « Verso · à ajouter »).
 *  - vide : pointillés orange, fond orange très clair, cadre + « Scanner » : UN seul geste (la caméra s'ouvre avec le cadre ; la galerie y est proposée) ;
 *  - rempli : la vignette, le badge vert « ✓ 9 champs lus » quand l'IA a lu le document, et « … » (Voir · Remplacer · Supprimer).
 */
export function DocumentSlot({ label, hint, uri, readCount, onScan, onView, onReplace, onRemove }: { label: string; hint?: string; uri: string | null; readCount?: number; onScan: () => void; onView?: () => void; onReplace?: () => void; onRemove?: () => void }) {
  const { t } = useLanguage();
  const [menu, setMenu] = useState(false);
  const caption = hint ? `${label} · ${hint}` : label;
  return (
    <View style={{ flex: 1, gap: 8 }}>
      {uri ? (
        <View style={{ aspectRatio: CARD_RATIO, borderRadius: 14, overflow: 'hidden', backgroundColor: Brand.graphite }}>
          <Image source={{ uri }} accessibilityLabel={label} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
          {readCount !== undefined ? (
            <View style={{ position: 'absolute', start: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Palette.success }}>
              <Ionicons name="checkmark" size={12} color={Brand.white} />
              <HText weight="bold" size={11} color={Brand.white}>
                {readCount === 1 ? t('form.fieldsReadOne') : t('form.fieldsRead', { count: readCount })}
              </HText>
            </View>
          ) : null}
          <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel={`${t('form.moreActions')} : ${label}`} hitSlop={6} style={{ position: 'absolute', end: 6, top: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="ellipsis-horizontal" size={16} color={Brand.white} />
            </View>
          </Pressable>
          <ActionSheet
            visible={menu}
            onClose={() => setMenu(false)}
            actions={[
              ...(onView ? [{ key: 'view', label: t('form.view'), onPress: onView }] : []),
              ...(onReplace ? [{ key: 'replace', label: t('form.replace'), onPress: onReplace }] : []),
              ...(onRemove ? [{ key: 'remove', label: t('form.remove'), onPress: onRemove, danger: true }] : []),
            ]}
          />
        </View>
      ) : (
        <Pressable onPress={onScan} accessibilityRole="button" accessibilityLabel={`${t('form.scan')} : ${label}`} style={{ aspectRatio: CARD_RATIO, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Brand.orange, backgroundColor: Brand.suggestFill, alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 88 }}>
          <Ionicons name="scan-outline" size={26} color={Brand.orangeUrgentText} />
          <HText weight="bold" size={13} color={Brand.orangeUrgentText}>
            {t('form.scan')}
          </HText>
        </Pressable>
      )}
      <HText weight="semibold" size={13} color={Palette.textSecondary}>
        {caption}
      </HText>
    </View>
  );
}

// ------------------------------------------------------------------ photo (états)

function Ring({ progress, size }: { progress: number; size: number }) {
  const radius = (size - 6) / 2;
  const length = 2 * Math.PI * radius;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={Brand.white} strokeOpacity={0.3} strokeWidth={4} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={Brand.white} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={[length * Math.min(1, Math.max(0, progress)), length]} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

export type PhotoState = 'uploading' | 'added' | 'rejected';

/**
 * Une photo et son état : envoi en cours (photo assombrie, anneau de progression), ajoutée, inutilisable (bordure rouge, raison, « Réessayer »
 * — la photo n'est pas enregistrée). `main` : badge « PRINCIPALE ».
 */
export function PhotoTile({ uri, state, progress = 0, main = false, reason, label, onRetry, onPress }: { uri: string | null; state: PhotoState; progress?: number; main?: boolean; reason?: string; label: string; onRetry?: () => void; onPress?: () => void }) {
  const { t } = useLanguage();
  const rejected = state === 'rejected';
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'image'} accessibilityLabel={`${label}${rejected && reason ? `. ${reason}` : state === 'uploading' ? `. ${t('form.uploading')} ${Math.round(progress * 100)} %` : ''}`} style={{ flex: 1, aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: Brand.graphite, borderWidth: rejected ? 2 : 0, borderColor: Palette.error }}>
      {uri ? <Image source={{ uri }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: state === 'uploading' ? 0.5 : 1 }} resizeMode="cover" /> : null}
      {state === 'uploading' ? (
        <View style={{ ...{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }, alignItems: 'center', justifyContent: 'center' }}>
          <Ring progress={progress} size={48} />
        </View>
      ) : null}
      {main && !rejected ? (
        <View style={{ position: 'absolute', start: 8, top: 8, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Brand.warningOnDark }}>
          <HText weight="bold" size={11} color={Brand.graphite}>
            {t('form.main')}
          </HText>
        </View>
      ) : null}
      {state === 'added' ? (
        <View style={{ position: 'absolute', end: 8, bottom: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={14} color={Brand.white} />
        </View>
      ) : null}
      {rejected ? (
        <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, top: 0, backgroundColor: 'rgba(196,43,75,0.88)', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 }}>
          <HText weight="bold" size={13} color={Brand.white} style={{ textAlign: 'center' }}>
            {reason ?? t('form.photoTooSmall')}
          </HText>
          {onRetry ? (
            <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={t('form.retry')} style={{ minHeight: 44, minWidth: 44, borderRadius: 22, paddingHorizontal: 14, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' }}>
              <HText weight="bold" size={12} color={Palette.error}>
                {t('form.retry')}
              </HText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

// ------------------------------------------------------------------ photos par angle

export type AngleSlot = { key: string; label: string; icon: IconName; uri: string | null; main?: boolean; state?: PhotoState; progress?: number; reason?: string };

/** Grille de 3 colonnes d'angles guidés (Avant, Arrière, Côté gauche, Côté droit, Intérieur, Compteur) et barre « 1 sur 6 ». */
export function AngleGrid({ slots, onPress, onRetry }: { slots: AngleSlot[]; onPress: (key: string) => void; onRetry?: (key: string) => void }) {
  const { t } = useLanguage();
  const done = filledCount(slots);
  const rows: AngleSlot[][] = [];
  for (let i = 0; i < slots.length; i += 3) rows.push(slots.slice(i, i + 3));
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: Palette.border, overflow: 'hidden' }}>
          <View style={{ width: `${slots.length ? (done / slots.length) * 100 : 0}%`, height: 6, borderRadius: 3, backgroundColor: Palette.success }} />
        </View>
        <HText weight="semibold" size={12} color={Palette.textSecondary}>
          {t('form.angleProgress', { n: done, total: slots.length })}
        </HText>
      </View>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map((slot) =>
            slot.uri ? (
              <View key={slot.key} style={{ flex: 1, gap: 6 }}>
                <PhotoTile uri={slot.uri} state={slot.state ?? 'added'} progress={slot.progress} main={slot.main} reason={slot.reason} label={slot.label} onPress={() => onPress(slot.key)} onRetry={onRetry ? () => onRetry(slot.key) : undefined} />
                <HText weight="semibold" size={12} color={Palette.textSecondary} numberOfLines={1}>
                  {slot.label}
                </HText>
              </View>
            ) : (
              <View key={slot.key} style={{ flex: 1, gap: 6 }}>
                <Pressable onPress={() => onPress(slot.key)} accessibilityRole="button" accessibilityLabel={t('form.addPhoto', { angle: slot.label.toLowerCase() })} style={{ aspectRatio: 1, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Palette.textMuted, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={slot.icon} size={30} color={Palette.textMuted} />
                </Pressable>
                <HText weight="semibold" size={12} color={Palette.textSecondary} numberOfLines={1}>
                  {slot.label}
                </HText>
              </View>
            ),
          )}
          {row.length < 3 ? Array.from({ length: 3 - row.length }).map((_, i) => <View key={`pad${i}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ liste compacte

export type DocumentRow = { key: string; name: string; sub: string; subTone?: 'ok' | 'muted'; thumbUri?: string | null; action: { label: string; tone?: 'neutral' | 'primary'; onPress: () => void } };

/** Liste compacte pour un formulaire : une ligne par document (vignette, nom, sous-titre vert « lue par l'IA » ou gris « Expire le … », action). */
export function DocumentList({ rows }: { rows: DocumentRow[] }) {
  return (
    <View style={{ backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, overflow: 'hidden' }}>
      {rows.map((row, index) => (
        <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: index < rows.length - 1 ? 1 : 0, borderBottomColor: Brand.listSeparator }}>
          <View style={{ width: 52, height: 34, borderRadius: 7, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: row.thumbUri ? Brand.graphite : Palette.surface, borderWidth: row.thumbUri ? 0 : 1, borderStyle: 'dashed', borderColor: Palette.textMuted }}>
            {row.thumbUri ? <Image source={{ uri: row.thumbUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Ionicons name="document-text-outline" size={16} color={Palette.textMuted} />}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <HText weight="semibold" size={14}>
              {row.name}
            </HText>
            <HText size={12} color={row.subTone === 'ok' ? Palette.success : Palette.textSecondary}>
              {row.sub}
            </HText>
          </View>
          <Pressable onPress={row.action.onPress} accessibilityRole="button" accessibilityLabel={`${row.action.label} : ${row.name}`} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <HText weight="semibold" size={13} color={row.action.tone === 'primary' ? Brand.orangeUrgentText : Palette.textPrimary}>
              {row.action.label}
            </HText>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
