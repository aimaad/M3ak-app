/**
 * Échéances de la fiche : assurance, visite technique (document ou entretien, le plus urgent), puis le prochain entretien de chaque
 * autre type. Mêmes seuils que « À surveiller » (30 jours / 1 000 km ; chaud à 7 jours / 500 km) : voir fleet-watch.ts. Contrairement
 * à « À surveiller », une échéance lointaine est affichée aussi (barre presque vide, « ok »).
 */
import type { MaintenanceItem, MaintenanceType } from '@/features/maintenance/types';

import { daysUntil, HOT_DAYS, HOT_KM, WATCH_DAYS, WATCH_KM } from '../fleet-watch';
import type { Vehicle } from '../types';

export type DueUrgency = 'expired' | 'hot' | 'normal' | 'ok' | 'none';
export type DueValue = { kind: 'days'; days: number } | { kind: 'km'; km: number } | { kind: 'expired' } | { kind: 'none' };
export type DueIcon = 'shield' | 'calendar' | 'wrench';

export type DueRow = {
  key: string;
  type: MaintenanceType;
  icon: DueIcon;
  due: DueValue;
  urgency: DueUrgency;
  /** Remplissage de la barre (0 à 1) : d'autant plus pleine que l'échéance est proche. */
  fill: number;
  /** Date d'échéance AAAA-MM-JJ et/ou kilométrage cible, pour la ligne de précision. */
  date: string | null;
  targetKm: number | null;
  /** Entretien à ouvrir au tap ; absent pour une échéance qui ne vient que d'un document. */
  maintenanceId?: string;
  /** Assurance / visite technique sans photo du document : « Ajouter la photo ». */
  missingFile: boolean;
  score: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type Candidate = { due: DueValue; urgency: DueUrgency; fill: number; score: number; date: string | null; targetKm: number | null; maintenanceId?: string };

function byDays(days: number, date: string, maintenanceId?: string): Candidate {
  if (days < 0) return { due: { kind: 'expired' }, urgency: 'expired', fill: 1, score: 2 + Math.min(-days, 365) / 365, date, targetKm: null, maintenanceId };
  const fill = clamp(1 - days / WATCH_DAYS, 0.06, 1);
  return { due: { kind: 'days', days }, urgency: days <= HOT_DAYS ? 'hot' : days <= WATCH_DAYS ? 'normal' : 'ok', fill, score: fill, date, targetKm: null, maintenanceId };
}

function byKm(km: number, targetKm: number, maintenanceId?: string): Candidate {
  if (km < 0) return { due: { kind: 'expired' }, urgency: 'expired', fill: 1, score: 2 + Math.min(-km, 5000) / 5000, date: null, targetKm, maintenanceId };
  const fill = clamp(1 - km / WATCH_KM, 0.06, 1);
  return { due: { kind: 'km', km }, urgency: km <= HOT_KM ? 'hot' : km <= WATCH_KM ? 'normal' : 'ok', fill, score: fill, date: null, targetKm, maintenanceId };
}

const best = (candidates: Candidate[]) => candidates.reduce<Candidate | null>((top, candidate) => (!top || candidate.score > top.score ? candidate : top), null);

function candidatesOf(entry: MaintenanceItem, vehicle: Vehicle, now: Date): Candidate[] {
  const list: Candidate[] = [];
  if (entry.echeanceDate) list.push({ ...byDays(daysUntil(entry.echeanceDate, now), entry.echeanceDate.slice(0, 10), entry.id) });
  if (entry.echeanceKm != null) list.push(byKm(entry.echeanceKm - vehicle.kilometrage, entry.echeanceKm, entry.id));
  if (list.length === 0 && entry.statut === 'en_retard') list.push({ ...byDays(-1, '', entry.id), date: null });
  return list;
}

const ICON: Partial<Record<MaintenanceType, DueIcon>> = { assurance: 'shield', visite_technique: 'calendar' };
const DOCUMENT_TYPES: MaintenanceType[] = ['assurance', 'visite_technique'];

export function buildDues(input: { vehicle: Vehicle; maintenance: MaintenanceItem[]; now: Date }): DueRow[] {
  const { vehicle, maintenance, now } = input;
  const open = maintenance.filter((entry) => entry.vehicleId === vehicle.id && entry.statut !== 'effectuee' && entry.statut !== 'en_cours');
  const byType = new Map<MaintenanceType, MaintenanceItem[]>();
  for (const entry of open) byType.set(entry.type, [...(byType.get(entry.type) ?? []), entry]);

  const rows: DueRow[] = [];
  const types = new Set<MaintenanceType>([...DOCUMENT_TYPES, ...byType.keys()]);
  for (const type of types) {
    const candidates = (byType.get(type) ?? []).flatMap((entry) => candidatesOf(entry, vehicle, now));
    const document = DOCUMENT_TYPES.includes(type) ? vehicle.documents.find((doc) => doc.type === type) : undefined;
    if (document?.expiresAt) candidates.push(byDays(daysUntil(document.expiresAt, now), document.expiresAt.slice(0, 10)));
    const top = best(candidates);
    const isDocumentType = DOCUMENT_TYPES.includes(type);
    if (!top && !isDocumentType) continue;
    rows.push({
      key: `due:${type}`,
      type,
      icon: ICON[type] ?? 'wrench',
      due: top?.due ?? { kind: 'none' },
      urgency: top?.urgency ?? 'none',
      fill: top?.fill ?? 0,
      date: top?.date ?? null,
      targetKm: top?.targetKm ?? null,
      maintenanceId: top?.maintenanceId,
      missingFile: isDocumentType && !document,
      score: top?.score ?? -1,
    });
  }
  return rows.sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
}
