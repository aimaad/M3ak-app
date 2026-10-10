import { computeExpiryUrgency, type ExpiryUrgency } from '@/lib/expiry';

import type { Customer, DocumentType } from './types';

export type CustomerDocumentAlert = {
  customerId: string;
  customerName: string;
  type: DocumentType;
  expiresAt: string;
  urgency: Exclude<ExpiryUrgency, 'ok'>;
};

/** Documents clients expirés ou proches de l'expiration, triés par échéance la plus proche. */
export function customerDocumentAlerts(
  customers: Customer[],
  today: Date = new Date(),
  dueSoonDays = 30
): CustomerDocumentAlert[] {
  const alerts: CustomerDocumentAlert[] = [];

  for (const customer of customers) {
    if (customer.archivedAt) continue;
    for (const doc of customer.documents) {
      const urgency = computeExpiryUrgency(doc.expiresAt, today, dueSoonDays);
      if (urgency === null || urgency === 'ok') continue;
      alerts.push({
        customerId: customer.id,
        customerName: customer.nomComplet,
        type: doc.type,
        expiresAt: doc.expiresAt as string,
        urgency,
      });
    }
  }

  return alerts.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}
