import { complianceStatus, dayKey } from '@/features/compliance/logic';
import type { ComplianceRecord } from '@/features/compliance/types';
import { computeExpiryUrgency, type ExpiryUrgency } from '@/lib/expiry';

import type { Vehicle, VehicleDocumentType } from './types';

export type VehicleDocumentAlert = {
  vehicleId: string;
  vehicleLabel: string;
  type: VehicleDocumentType;
  expiresAt: string;
  urgency: Exclude<ExpiryUrgency, 'ok'>;
  /** Aucune période d'assurance / visite ne couvre aujourd'hui (seules des périodes à venir existent) : « non couverte » plutôt que « expiré le … ». */
  uncovered?: boolean;
};

/**
 * Documents véhicule expirés ou proches de l'expiration, triés par échéance la plus proche.
 * Avec les périodes (`compliance`), on y ajoute aussi l'assurance ou la visite que RIEN ne couvre aujourd'hui alors que des périodes à venir
 * existent : la date du document est alors une fin lointaine, qui ferait croire que tout va bien.
 */
export function vehicleDocumentAlerts(
  vehicles: Vehicle[],
  today: Date = new Date(),
  dueSoonDays = 30,
  compliance?: ComplianceRecord[]
): VehicleDocumentAlert[] {
  const alerts: VehicleDocumentAlert[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.archivedAt) continue;
    for (const doc of vehicle.documents) {
      const urgency = computeExpiryUrgency(doc.expiresAt, today, dueSoonDays);
      if (urgency === null || urgency === 'ok') continue;
      alerts.push({
        vehicleId: vehicle.id,
        vehicleLabel: `${vehicle.marque} ${vehicle.modele} · ${vehicle.immatriculation}`,
        type: doc.type,
        expiresAt: doc.expiresAt as string,
        urgency,
      });
    }
  }

  if (compliance) {
    const byVehicle = new Map<string, ComplianceRecord[]>();
    for (const record of compliance) byVehicle.set(record.vehicleId, [...(byVehicle.get(record.vehicleId) ?? []), record]);
    for (const vehicle of vehicles) {
      if (vehicle.archivedAt) continue;
      for (const kind of ['assurance', 'visite_technique'] as const) {
        const status = complianceStatus(kind, byVehicle.get(vehicle.id) ?? [], vehicle, today);
        if (!status.uncovered || status.record) continue;
        if (alerts.some((alert) => alert.vehicleId === vehicle.id && alert.type === kind)) continue;
        alerts.push({ vehicleId: vehicle.id, vehicleLabel: `${vehicle.marque} ${vehicle.modele} · ${vehicle.immatriculation}`, type: kind, expiresAt: dayKey(today), urgency: 'expire', uncovered: true });
      }
    }
  }

  return alerts.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}
