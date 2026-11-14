export type MaintenanceType = 'vidange' | 'assurance' | 'visite_technique' | 'freins' | 'pneus' | 'panne' | 'autre';
export type MaintenanceStatus = 'a_venir' | 'due' | 'en_retard' | 'en_cours' | 'effectuee';

export const MAINTENANCE_TYPES: MaintenanceType[] = [
  'vidange',
  'assurance',
  'visite_technique',
  'freins',
  'pneus',
  'panne',
  'autre',
];

export type MaintenanceItem = {
  id: string;
  agencyId: string;
  vehicleId: string;
  type: MaintenanceType;
  echeanceDate: string | null;
  echeanceKm: number | null;
  statut: MaintenanceStatus;
  notes: string | null;
  garage: string | null;
  cout: number | null;
  piecesRemplacees: string | null;
  facturePath: string | null;
  dateIntervention: string | null;
  /** Périodicité : « tous les N km » et/ou « tous les N mois » (la suivante se crée quand celle-ci passe à « effectuée »). */
  repeatKm: number | null;
  repeatMonths: number | null;
  createdAt: string;
};

export type MaintenanceInput = {
  vehicleId: string;
  type: MaintenanceType;
  echeanceDate: string | null;
  echeanceKm: number | null;
  notes: string | null;
  repeatKm?: number | null;
  repeatMonths?: number | null;
};

export type MaintenanceCompletionInput = {
  garage: string | null;
  cout: number | null;
  piecesRemplacees: string | null;
  facturePath: string | null;
};
