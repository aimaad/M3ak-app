/**
 * « À SURVEILLER » : documents des véhicules (assurance, visite technique, carte grise…) et entretiens (vidange, freins…) qui
 * arrivent à échéance dans les 30 jours ou les 1 000 km, ou qui sont dépassés. Fonctions pures : « maintenant » est un paramètre.
 * Triés par urgence. La plus urgente (≤ 7 jours ou ≤ 500 km) est mise en avant ; une échéance dépassée s'affiche « Expirée ».
 */
import { dayKey, parseDayKey } from '@/features/dashboard/availability';
import type { MaintenanceItem, MaintenanceType } from '@/features/maintenance/types';

import { vehicleDocumentAlerts } from './document-alerts';
import { fleetName } from './fleet-model';
import type { Vehicle, VehicleDocumentType } from './types';

export const WATCH_DAYS = 30;
export const WATCH_KM = 1000;
export const HOT_DAYS = 7;
export const HOT_KM = 500;
const MS_PER_DAY = 86_400_000;

export type WatchUrgency = 'expired' | 'hot' | 'normal';
/** Section de la fiche véhicule à ouvrir au tap. */
export type WatchTarget = 'documents' | 'entretien';
export type WatchIcon = 'shield' | 'calendar' | 'wrench' | 'document';

export type WatchItem = {
  key: string;
  vehicleId: string;
  vehicleName: string;
  source: 'document' | 'maintenance';
  /** `maintenance.types.<type>` ou `vehicle.documents.<type>` pour le titre. */
  type: MaintenanceType | VehicleDocumentType;
  icon: WatchIcon;
  urgency: WatchUrgency;
  /** Échéance affichée : jours restants, kilomètres restants, ou dépassée. */
  due: { kind: 'days'; days: number } | { kind: 'km'; km: number } | { kind: 'expired' };
  /** Remplissage de la barre d'urgence (0 à 1) : d'autant plus pleine que l'échéance est proche. */
  fill: number;
  target: WatchTarget;
  /** Pour le tri : plus grand = plus urgent. */
  score: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Jours entre aujourd'hui et une date AAAA-MM-JJ (jours civils locaux) ; négatif = dépassée. */
export function daysUntil(date: string, now: Date): number {
  const target = parseDayKey(date.slice(0, 10));
  const today = parseDayKey(dayKey(now));
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

type Candidate = { due: WatchItem['due']; urgency: WatchUrgency; fill: number; score: number };

function byDays(days: number): Candidate {
  if (days < 0) return { due: { kind: 'expired' }, urgency: 'expired', fill: 1, score: 2 + Math.min(-days, 365) / 365 };
  const fill = clamp(1 - days / WATCH_DAYS, 0.06, 1);
  return { due: { kind: 'days', days }, urgency: days <= HOT_DAYS ? 'hot' : 'normal', fill, score: fill };
}

function byKm(km: number): Candidate {
  if (km < 0) return { due: { kind: 'expired' }, urgency: 'expired', fill: 1, score: 2 + Math.min(-km, 5000) / 5000 };
  const fill = clamp(1 - km / WATCH_KM, 0.06, 1);
  return { due: { kind: 'km', km }, urgency: km <= HOT_KM ? 'hot' : 'normal', fill, score: fill };
}

const ICON: Record<string, WatchIcon> = { assurance: 'shield', visite_technique: 'calendar', carte_grise: 'document', carte_grise_verso: 'document' };

export function buildWatchItems(input: { vehicles: Vehicle[]; maintenance: MaintenanceItem[]; now: Date }): WatchItem[] {
  const { vehicles, maintenance, now } = input;
  const active = new Map(vehicles.filter((vehicle) => !vehicle.archivedAt).map((vehicle) => [vehicle.id, vehicle]));
  const items: WatchItem[] = [];

  for (const alert of vehicleDocumentAlerts([...active.values()], now, WATCH_DAYS)) {
    const vehicle = active.get(alert.vehicleId);
    if (!vehicle) continue;
    const candidate = byDays(daysUntil(alert.expiresAt, now));
    items.push({ key: `doc:${alert.vehicleId}:${alert.type}`, vehicleId: alert.vehicleId, vehicleName: fleetName(vehicle), source: 'document', type: alert.type, icon: ICON[alert.type] ?? 'document', target: 'documents', ...candidate });
  }

  for (const entry of maintenance) {
    const vehicle = active.get(entry.vehicleId);
    if (!vehicle || entry.statut === 'effectuee' || entry.statut === 'en_cours') continue;
    const candidates: Candidate[] = [];
    if (entry.echeanceDate) {
      const days = daysUntil(entry.echeanceDate, now);
      if (days <= WATCH_DAYS) candidates.push(byDays(days));
    }
    if (entry.echeanceKm != null) {
      const km = entry.echeanceKm - vehicle.kilometrage;
      if (km <= WATCH_KM) candidates.push(byKm(km));
    }
    // Marqué en retard sans date ni kilométrage exploitable : dépassé quand même.
    if (candidates.length === 0 && entry.statut === 'en_retard') candidates.push(byDays(-1));
    if (candidates.length === 0) continue;
    const best = candidates.reduce((max, candidate) => (candidate.score > max.score ? candidate : max));
    items.push({ key: `maint:${entry.id}`, vehicleId: entry.vehicleId, vehicleName: fleetName(vehicle), source: 'maintenance', type: entry.type, icon: entry.type === 'assurance' ? 'shield' : entry.type === 'visite_technique' ? 'calendar' : 'wrench', target: 'entretien', ...best });
  }

  // Assurance et visite technique peuvent exister comme document ET comme entretien : on ne garde que le plus urgent.
  const unique = new Map<string, WatchItem>();
  for (const item of items) {
    const duplicateKey = item.type === 'assurance' || item.type === 'visite_technique' ? `${item.vehicleId}:${item.type}` : item.key;
    const existing = unique.get(duplicateKey);
    if (!existing || item.score > existing.score) unique.set(duplicateKey, item);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score || a.vehicleName.localeCompare(b.vehicleName));
}
