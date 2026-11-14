import { allStatuses } from '@/features/compliance/logic';
import type { ComplianceKind, ComplianceRecord } from '@/features/compliance/types';
import type { MaintenanceItem, MaintenanceType } from '@/features/maintenance/types';

import type { ArchiveBlock } from './archive-guard';
import { buildDues } from './detail/dues';
import { formatDayLabel } from './fleet-card';
import type { Vehicle } from './types';

/** Le serveur refuse un changement de statut à la main quand une location est ouverte (migration 0072). */
export function isStatusLockedError(error: unknown): boolean {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : '';
  return message.includes('vehicle_status_locked');
}

/**
 * Même règle que le serveur : avec une location ouverte, on ne passe pas à « maintenance », « en préparation » ou « indisponible » ;
 * redevenir « disponible » reste possible (ex. une panne pendant une location), sauf depuis « en location » (c'est la location qui le gère).
 */
export function statusChangeBlocked(vehicle: Pick<Vehicle, 'statut'>, next: Vehicle['statut'], block: ArchiveBlock | null): boolean {
  return block !== null && (vehicle.statut === 'en_location' || next !== 'disponible');
}

type T = (key: string, params?: Record<string, unknown>) => string;

/**
 * Le statut d'un véhicule réservé ou en location ne se change pas à la main : on dit chez QUI il est (ou par qui il est réservé) et on
 * suggère d'accorder une autre voiture à ce client. Même calcul que le blocage de l'archivage (`archiveBlock`).
 */
export function statusBlockText(block: ArchiveBlock, t: T, language: string, now: Date): string {
  const day = block.day ? formatDayLabel(block.day, language, 'short', now) : '';
  const named = block.name !== null;
  const main =
    block.kind === 'late'
      ? t(named ? 'vehicleDetail.statusBlock.late' : 'vehicleDetail.statusBlock.lateNoName', { name: block.name })
      : block.kind === 'rented'
        ? t(named ? 'vehicleDetail.statusBlock.rented' : 'vehicleDetail.statusBlock.rentedNoName', { name: block.name, day })
        : block.kind === 'reserved'
          ? t(named ? 'vehicleDetail.statusBlock.reserved' : 'vehicleDetail.statusBlock.reservedNoName', { name: block.name, day })
          : t('vehicleDetail.statusBlock.status');
  const others = block.others > 0 ? t(block.others === 1 ? 'vehicleDetail.archive.others' : 'vehicleDetail.archive.othersMany', { count: block.others }) : null;
  return [main, others].filter(Boolean).join(' ');
}

/** Une échéance en alerte au moment de rendre le véhicule disponible. */
export type AvailabilityAlert = { type: ComplianceKind | MaintenanceType; state: 'urgent' | 'expired' };

/**
 * Échéances en alerte (expirées, ou à moins de 7 jours / 500 km) : obligations légales (assurance, visite, vignette) et entretiens.
 * Ce n'est JAMAIS bloquant : l'application affiche l'alerte et laisse confirmer.
 */
export function availabilityAlerts(vehicle: Vehicle, compliance: ComplianceRecord[], maintenance: MaintenanceItem[], now: Date): AvailabilityAlert[] {
  const alerts: AvailabilityAlert[] = [];
  for (const status of allStatuses(compliance, vehicle, now)) {
    if (status.state === 'expired' || status.state === 'urgent') alerts.push({ type: status.kind, state: status.state });
  }
  for (const row of buildDues({ vehicle, maintenance, now })) {
    if (row.type === 'assurance' || row.type === 'visite_technique') continue; // déjà couverts par les obligations légales
    if (row.urgency === 'expired') alerts.push({ type: row.type, state: 'expired' });
    else if (row.urgency === 'hot') alerts.push({ type: row.type, state: 'urgent' });
  }
  return alerts;
}

/** « Assurance (expirée), Vidange (urgente) ». */
export function availabilityAlertList(alerts: AvailabilityAlert[], t: T): string {
  return alerts
    .map((alert) => {
      const name = alert.type === 'assurance' || alert.type === 'visite_technique' || alert.type === 'vignette' ? t(`vehicleDetail.compliance.kind.${alert.type}`) : t(`maintenance.types.${alert.type}`);
      return `${name} (${t(`vehicleDetail.availability.state.${alert.state}`)})`;
    })
    .join(', ');
}
