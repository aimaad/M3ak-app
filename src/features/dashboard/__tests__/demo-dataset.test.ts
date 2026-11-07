import { customerDocumentAlerts } from '@/features/customers/document-alerts';
import type { Customer } from '@/features/customers/types';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Payment } from '@/features/payments/types';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '@/features/vehicles/types';
import { vehicleDocumentAlerts } from '@/features/vehicles/document-alerts';

import { computeDashboardMetrics } from '../kpis';
import { buildPriorities } from '../priorities';

// Le jeu de démonstration est un module ESM pour Node (scripts/) : on en lit le texte pour le tester ici.
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('node:fs');
const path = require('node:path');
const source: string = fs
  .readFileSync(path.resolve(__dirname, '../../../../scripts/demo-seed/dataset.mjs'), 'utf8')
  .replace('export function buildDemoDataset', 'function buildDemoDataset');
const buildDemoDataset = new Function(`${source}\nreturn buildDemoDataset;`)() as (o: { now: Date; agencyId: string }) => Record<string, Record<string, unknown>[]>;

const camel = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]));

describe('jeu de données de démonstration', () => {
  const now = new Date(2026, 10, 7, 15, 0, 0);
  const data = buildDemoDataset({ now, agencyId: 'a1' });
  const vehicles = data.vehicles.map(camel) as unknown as Vehicle[];
  const rentals = data.rentals.map(camel) as unknown as Rental[];
  const payments = data.payments.map(camel) as unknown as Payment[];
  const maintenance = data.maintenance_items.map(camel) as unknown as MaintenanceItem[];
  const customers = data.customers.map((c) => ({
    ...camel(c),
    archivedAt: null,
    documents: data.customer_documents.filter((d) => d.customer_id === c.id).map((d) => ({ type: d.doc_type, expiresAt: d.expires_at })),
  })) as unknown as Customer[];
  const metrics = computeDashboardMetrics({ vehicles, rentals, payments, maintenance, customers: customers as never, now, period: 'today' });

  it('au moins 2 retours en retard', () => {
    expect(metrics.activity.lateReturns).toBeGreaterThanOrEqual(2);
  });
  it('des impayés', () => {
    expect(metrics.outstanding.count).toBeGreaterThanOrEqual(3);
    expect(metrics.outstanding.total).toBeGreaterThan(0);
  });
  it('au moins 1 entretien en retard', () => {
    expect(metrics.maintenance.overdue).toBeGreaterThanOrEqual(1);
  });
  it('des locations à venir (7 jours) et à confirmer', () => {
    expect(metrics.activity.upcoming7Days).toBeGreaterThanOrEqual(3);
    expect(metrics.activity.pendingConfirmation).toBeGreaterThanOrEqual(1);
  });
  it('au moins 1 document expiré (véhicule ou client)', () => {
    const expired = [...vehicleDocumentAlerts(vehicles, now), ...customerDocumentAlerts(customers, now)].filter((a) => a.urgency === 'expire');
    expect(expired.length).toBeGreaterThanOrEqual(1);
  });
  it('des véhicules à l’arrêt, et toutes les priorités se déclenchent', () => {
    expect(metrics.stopped.length).toBeGreaterThan(0);
    const kinds = buildPriorities({ showMoney: true, lateReturns: metrics.activity.lateReturns, unpaid: metrics.outstanding, expiredDocuments: 2, overdueMaintenance: metrics.maintenance.overdue, stoppedVehicles: metrics.stopped.length }).map((p) => p.kind);
    expect(kinds).toEqual(['late', 'unpaid', 'documents', 'maintenance', 'stopped']);
  });
});
