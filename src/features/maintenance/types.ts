export type MaintenanceType = 'vidange' | 'assurance' | 'visite_technique' | 'freins' | 'pneus' | 'autre';
export type MaintenanceStatus = 'a_venir' | 'due' | 'en_retard' | 'effectuee';

export const MAINTENANCE_TYPES: MaintenanceType[] = [
  'vidange',
  'assurance',
  'visite_technique',
  'freins',
  'pneus',
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
  createdAt: string;
};

export type MaintenanceInput = {
  vehicleId: string;
  type: MaintenanceType;
  echeanceDate: string | null;
  echeanceKm: number | null;
  notes: string | null;
};
