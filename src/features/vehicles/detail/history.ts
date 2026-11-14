/**
 * Historique d'un véhicule : locations, inspections et entretiens effectués, du plus récent au plus ancien. Les montants ne sont
 * mis dans les événements que pour le propriétaire (`showAmounts`) : un employé ne les reçoit jamais.
 */
import type { ComplianceKind, ComplianceRecord } from '@/features/compliance/types';
import type { Customer } from '@/features/customers/types';
import type { Inspection } from '@/features/inspections/types';
import type { MaintenanceItem, MaintenanceType } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';

import { customerShortName } from '../fleet-card';

export type VehicleInspection = Inspection & { damageCount: number };

export type HistoryEvent =
  | { kind: 'rental'; key: string; at: string; rentalId: string; name: string | null; from: string; to: string; days: number | null; amount: number | null }
  | { kind: 'inspection'; key: string; at: string; rentalId: string; type: 'depart' | 'retour'; damageCount: number }
  | { kind: 'compliance'; key: string; at: string; complianceKind: ComplianceKind; validUntil: string; amount: number | null }
  | { kind: 'maintenance'; key: string; at: string; maintenanceId: string; type: MaintenanceType; garage: string | null; amount: number | null };

export function buildHistory(input: {
  rentals: Rental[];
  inspections: VehicleInspection[];
  maintenance: MaintenanceItem[];
  compliance?: ComplianceRecord[];
  customers: Map<string, Customer>;
  showAmounts: boolean;
  limit?: number;
}): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (const rental of input.rentals) {
    if (rental.statut !== 'en_cours' && rental.statut !== 'terminee') continue;
    const from = rental.dateDepartReel ?? rental.dateDebutPrevue;
    events.push({
      kind: 'rental',
      key: `rental:${rental.id}`,
      at: from,
      rentalId: rental.id,
      name: customerShortName(input.customers.get(rental.customerId)?.nomComplet),
      from,
      to: rental.dateRetourReel ?? rental.dateFinPrevue,
      days: rental.dureeJours,
      amount: input.showAmounts ? (rental.prixTotal ?? null) : null,
    });
  }
  for (const inspection of input.inspections) {
    if (inspection.skipped || (inspection.statut !== 'terminee' && inspection.statut !== 'validee')) continue;
    events.push({ kind: 'inspection', key: `inspection:${inspection.id}`, at: inspection.dateInspection, rentalId: inspection.rentalId, type: inspection.type, damageCount: inspection.damageCount });
  }
  // Renouvellements : l'entretien « assurance » / « visite technique » fait n'est pas répété (la période l'est déjà).
  for (const record of input.compliance ?? []) {
    events.push({ kind: 'compliance', key: `compliance:${record.id}`, at: record.createdAt, complianceKind: record.kind, validUntil: record.validUntil, amount: input.showAmounts ? record.amount : null });
  }
  for (const entry of input.maintenance) {
    if (entry.statut !== 'effectuee') continue;
    if (entry.type === 'assurance' || entry.type === 'visite_technique') continue;
    events.push({ kind: 'maintenance', key: `maintenance:${entry.id}`, at: entry.dateIntervention ?? entry.createdAt, maintenanceId: entry.id, type: entry.type, garage: entry.garage, amount: input.showAmounts ? entry.cout : null });
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return input.limit ? events.slice(0, input.limit) : events;
}
