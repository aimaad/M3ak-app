import { computeExpiryUrgency, type ExpiryUrgency } from '@/lib/expiry';

import type { Vehicle, VehicleDocumentType } from './types';

export type VehicleDocumentAlert = {
  vehicleId: string;
  vehicleLabel: string;
  type: VehicleDocumentType;
  expiresAt: string;
  urgency: Exclude<ExpiryUrgency, 'ok'>;
};

/** Documents véhicule expirés ou proches de l'expiration, triés par échéance la plus proche. */
export function vehicleDocumentAlerts(
  vehicles: Vehicle[],
  today: Date = new Date(),
  dueSoonDays = 30
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

  return alerts.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}
