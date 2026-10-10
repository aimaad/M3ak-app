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
  createdAt: string;
};

export type MaintenanceInput = {
  vehicleId: string;
  type: MaintenanceType;
  echeanceDate: string | null;
  echeanceKm: number | null;
  notes: string | null;
};

export type MaintenanceCompletionInput = {
  garage: string | null;
  cout: number | null;
  piecesRemplacees: string | null;
  facturePath: string | null;
};
