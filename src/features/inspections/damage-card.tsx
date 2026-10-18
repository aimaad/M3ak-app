import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import type { DamagePatch } from './api';
import { DamageEditor, parseCost, type DamageDraft } from './damage-editor';
import { confidencePercent, effectiveCost, needsCheck, type Damage } from './damages';
import { usePhotoSignedUrl } from './hooks';

const SEVERITY_COLOR = { leger: '#B45309', modere: '#C2410C', grave: '#B91C1C' } as const;

type Props = {
  damage: Damage;
  index: number;
  photoPath?: string;
  canChooseNew: boolean;
  onPatch: (patch: DamagePatch) => Promise<unknown>;
};

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: bg }}>
      <ThemedText type="small" style={{ color, fontSize: 11 }}>
        {text}
      </ThemedText>
    </View>
  );
}

/** Un dommage : photo avec cadre, détails, décision de l'employé (confirmer / rejeter / modifier). */
export function DamageCard({ damage, index, photoPath, canChooseNew, onPatch }: Props) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: photoUrl } = usePhotoSignedUrl(photoPath);

  const percent = confidencePercent(damage);
  const check = needsCheck(damage);
  const rejected = damage.statut === 'rejete';
  const color = damage.nouveau ? '#DC2626' : '#D97706';

  async function run(patch: DamagePatch) {
    setSaving(true);
    setError(null);
    try {
      await onPatch(patch);
      setEditing(false);
    } catch {
      setError(t('inspection.analysis.damages.saveError'));
    } finally {
      setSaving(false);
    }
  }

  const initial: DamageDraft = {
    zone: damage.zone,
    type: damage.type,
    gravite: damage.gravite,
    nouveau: damage.nouveau,
    cost: String(effectiveCost(damage) || ''),
    description: damage.description ?? '',
  };

  return (
    <Card className="gap-3" style={{ opacity: rejected ? 0.55 : 1 }}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <ThemedText type="smallBold">
            {`#${index} · ${t(`inspection.analysis.zonesLabel.${damage.zone}`)}`}
          </ThemedText>
          <ThemedText type="small" style={{ color: SEVERITY_COLOR[damage.gravite] }}>
            {`${t(`inspection.analysis.types.${damage.type}`)} · ${t(`inspection.analysis.damages.severity.${damage.gravite}`)}`}
          </ThemedText>
        </View>
        <ThemedText type="smallBold">{`${effectiveCost(damage)} MAD`}</ThemedText>
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        <Badge text={t(damage.nouveau ? 'inspection.analysis.damages.new' : 'inspection.analysis.damages.existing')} color={color} bg={damage.nouveau ? '#FEE2E2' : '#FEF3C7'} />
        <Badge
          text={t(`inspection.analysis.damages.status.${damage.statut}`)}
          color={damage.statut === 'confirme' ? '#15803D' : damage.statut === 'rejete' ? '#6B7280' : '#5B21B6'}
          bg={damage.statut === 'confirme' ? '#DCFCE7' : damage.statut === 'rejete' ? '#F3F4F6' : '#EDE9FE'}
        />
        {percent !== null ? <Badge text={t('inspection.analysis.damages.confidence', { percent })} color="#1D4ED8" bg="#DBEAFE" /> : <Badge text={t('inspection.analysis.damages.manual')} color="#475569" bg="#E2E8F0" />}
        {check ? <Badge text={t('inspection.analysis.damages.toCheck')} color="#B45309" bg="#FEF3C7" /> : null}
      </View>

      {damage.description ? <ThemedText type="small">{damage.description}</ThemedText> : null}
      {damage.comparaison === 'retour_seul' && damage.source === 'ia' ? (
        <ThemedText type="small" style={{ color: '#B45309' }}>
          {t('inspection.analysis.damages.noDepartPhoto')}
        </ThemedText>
      ) : null}
      {damage.source === 'ia' && damage.coutEstime !== null && damage.coutValide !== null && damage.coutValide !== damage.coutEstime ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('inspection.analysis.damages.costEstimated', { amount: damage.coutEstime })}
        </ThemedText>
      ) : null}

      {photoUrl ? (
        <View style={{ height: 190 }}>
          <ZoomableImage
            uri={photoUrl}
            label={damage.angle ? t('inspection.analysis.damages.photoOf', { angle: t(`inspection.angles.${damage.angle}`) }) : undefined}
            boxes={damage.bbox ? [{ ...damage.bbox, label: String(index), color }] : undefined}
            style={{ borderRadius: 16 }}
          />
        </View>
      ) : null}

      {editing ? (
        <DamageEditor
          initial={initial}
          canChooseNew={canChooseNew}
          saving={saving}
          error={error}
          onCancel={() => setEditing(false)}
          onSave={(draft) =>
            run({
              zone: draft.zone,
              type: draft.type,
              gravite: draft.gravite,
              nouveau: canChooseNew ? draft.nouveau : false,
              description: draft.description.trim() || null,
              coutValide: parseCost(draft.cost) ?? 0,
              statut: 'confirme',
            })
          }
        />
      ) : (
        <>
          {error ? (
            <ThemedText type="small" style={{ color: M3akPalette.danger }}>
              {error}
            </ThemedText>
          ) : null}
          <View className="flex-row gap-2">
            {damage.statut === 'propose' ? (
              <>
                <Button label={t('inspection.analysis.damages.reject')} variant="danger" size="sm" style={{ flex: 1 }} disabled={saving} onPress={() => run({ statut: 'rejete' })} />
                <Button label={t('inspection.analysis.damages.confirm')} size="sm" style={{ flex: 1 }} loading={saving} onPress={() => run({ statut: 'confirme' })} />
              </>
            ) : (
              <Button label={t('inspection.analysis.damages.restore')} variant="secondary" size="sm" style={{ flex: 1 }} disabled={saving} onPress={() => run({ statut: 'propose' })} />
            )}
            <Button label={t('inspection.analysis.damages.edit')} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setEditing(true)} />
          </View>
        </>
      )}
    </Card>
  );
}
